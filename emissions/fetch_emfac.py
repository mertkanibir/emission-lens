"""Retrieve CARB's public project-analysis export without retaining client identifiers.

Uses Python's standard library. State stays local; shared output contains the
original rate CSV, normalized RUNEX factors, request settings and checksums.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from datetime import datetime, timezone
from pathlib import Path
import time
import urllib.request
import urllib.parse
import zipfile

ROOT = Path(__file__).resolve().parent
API = "https://emfac.arb.ca.gov/api/project-analysis/"
MEDIA = "https://emfac.arb.ca.gov/media/"


def request_json(url: str, payload: dict | None = None) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={
            "Content-Type": "application/json",
            "Referer": "https://emfac.arb.ca.gov/project-analysis/",
            "Origin": "https://emfac.arb.ca.gov",
            "User-Agent": "Mozilla/5.0",
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        try:
            value = json.load(response)
        except (ValueError, UnicodeError) as error:
            raise RuntimeError("CARB returned a non-JSON response; no factors were imported.") from error
    if not isinstance(value, dict):
        raise ValueError("Unexpected CARB response shape.")
    return value


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n")


def save_export(response: dict, config: dict, output: Path) -> None:
    from emissions.normalize_emfac import normalize

    relative = response.get("outputFile")
    if not isinstance(relative, str) or not relative or relative.startswith(("/", "http")) or ".." in relative:
        raise ValueError("Invalid CARB output path.")
    url = MEDIA + urllib.parse.quote(relative, safe="/")
    with urllib.request.urlopen(url, timeout=90) as stream:
        archive = stream.read()
    with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
        names = [name for name in zipped.namelist() if name.lower().endswith(".csv")]
        if len(names) != 1:
            raise ValueError("Expected exactly one CSV in the CARB archive.")
        raw = zipped.read(names[0])
    retrieved = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    dataset = normalize(raw, config, source_url=url, retrieved_at=retrieved)
    output.mkdir(parents=True, exist_ok=True)
    (output / "carb-source.csv").write_bytes(raw)
    write_json(output / "factors.json", dataset)
    write_json(output / "receipt.json", {
        "source": "California Air Resources Board, EMFAC Web Project Analysis",
        "request_id": response["id"],
        "source_url": url,
        "archive_sha256": hashlib.sha256(archive).hexdigest(),
        "archive_member": names[0],
        "retrieved_at": retrieved,
        "source_sha256": hashlib.sha256(raw).hexdigest(),
        "normalized_sha256": hashlib.sha256((output / "factors.json").read_bytes()).hexdigest(),
        "request": config,
        "validation": dataset["validation"],
    })
    print(f"Validated {len(dataset['factors'])} RUNEX factors; saved to {output}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=ROOT / "config/carb-la-2026.json")
    parser.add_argument("--state", type=Path, default=ROOT / ".local/request.json")
    parser.add_argument("--output", type=Path, default=ROOT / "data/la-2026")
    parser.add_argument("--timeout", type=int, default=900)
    args = parser.parse_args()
    config = json.loads(args.config.read_text())
    if args.state.exists():
        response = json.loads(args.state.read_text())
        if any(response.get(key) != value for key, value in config.items() if key != "output_format"):
            raise ValueError("Saved CARB request does not match the selected configuration.")
    else:
        response = request_json(API, config)
        # CARB responses can include client IP/user-agent. Never persist them.
        write_json(args.state, {k: v for k, v in response.items() if k not in {"ipAddress", "userAgent"}})
    start = time.monotonic()
    while True:
        response = request_json(f"{API}check/{response['id']}/{response['requestSHA1']}")
        status = response.get("status")
        print(f"CARB request {response['id']}: {status}; queue position {response.get('queuePosition')}", flush=True)
        if status == "C":
            save_export(response, config, args.output)
            return
        if status in {"E", "F"}:
            raise RuntimeError("CARB request failed or expired; no factors were imported.")
        if time.monotonic() - start >= args.timeout:
            raise TimeoutError("CARB request is still pending. Resume with the same --state path.")
        time.sleep(15)


if __name__ == "__main__":
    main()
