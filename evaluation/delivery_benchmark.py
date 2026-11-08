"""Controlled loopback I/O scheduling comparison; no camera or GPU inference."""

import argparse
from datetime import datetime, timezone
import hashlib
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from pathlib import Path
import platform
import statistics
import subprocess
import tempfile
import threading
import time
import uuid

from worker.delivery import BackgroundDelivery
from worker.publish import HttpSender, Outbox


def trial(*, background, iterations=80, publish_every=8, work_s=.002, delay_s=.04):
    """Run identical synthetic work and bytes with only HTTP scheduling changed."""
    received = []
    expected = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            body = self.rfile.read(int(self.headers["Content-Length"]))
            time.sleep(delay_s)
            received.append(body)
            self.send_response(204)
            self.end_headers()

        def log_message(self, *_):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with tempfile.TemporaryDirectory() as folder:
            box = Outbox(Path(folder), HttpSender(f"http://127.0.0.1:{server.server_port}/api/worker", "controlled-test"))
            delivery = BackgroundDelivery(box) if background else None
            producer_times = []
            began = time.perf_counter()
            try:
                for tick in range(iterations):
                    time.sleep(work_s)
                    if tick % publish_every == 0:
                        payload = {"batch_id": str(uuid.uuid5(uuid.NAMESPACE_URL, f"delivery-benchmark/{tick}")),
                                   "revision": 0, "traffic": [], "synthetic_tick": tick}
                        expected.append((json.dumps(payload, allow_nan=False, separators=(",", ":")) + "\n").encode())
                        publish_start = time.perf_counter()
                        box.enqueue(payload)
                        if delivery:
                            delivery.notify()
                        else:
                            box.flush()
                        producer_times.append(time.perf_counter() - publish_start)
                processing_wall = time.perf_counter() - began
            finally:
                if delivery and not delivery.close(10):
                    raise RuntimeError("Controlled sender did not drain within its bound")
            if delivery:
                delivery.raise_if_failed()
            total_wall = time.perf_counter() - began
            if received != expected or box.pending() or box.delivered != len(expected):
                raise RuntimeError("Controlled delivery changed bytes/order or left pending evidence")
            return {"scheduling": "background" if background else "synchronous_baseline_algorithm",
                    "processing_loop_wall_s": processing_wall, "end_to_end_wall_s": total_wall,
                    "synthetic_work_iterations_per_s": iterations / processing_wall,
                    "producer_publish_max_s": max(producer_times),
                    "producer_publish_median_s": statistics.median(producer_times),
                    "delivered_batches": box.delivered, "attempts": box.attempts,
                    "pending_batches": 0, "identical_ordered_bytes": True,
                    "ordered_payloads_sha256": hashlib.sha256(b"".join(received)).hexdigest()}
    finally:
        server.shutdown()
        server.server_close()
        thread.join(2)


def compare(*, repeats=3, iterations=80, publish_every=8, work_s=.002, delay_s=.04):
    if repeats < 1 or iterations < 1 or publish_every < 1 or work_s < 0 or delay_s < 0:
        raise ValueError("Positive counts and nonnegative delays are required")
    settings = {"iterations": iterations, "publish_every": publish_every, "work_s": work_s, "delay_s": delay_s}
    trials = []
    # Alternate execution order to reduce a fixed first-run bias.
    for repeat in range(repeats):
        for background in ([False, True] if repeat % 2 == 0 else [True, False]):
            trials.append({"repeat": repeat, **trial(background=background, **settings)})
    medians = {}
    for mode in ["synchronous_baseline_algorithm", "background"]:
        selected = [row for row in trials if row["scheduling"] == mode]
        medians[mode] = {key: statistics.median(row[key] for row in selected)
                         for key in ["processing_loop_wall_s", "end_to_end_wall_s", "producer_publish_max_s"]}
    return {"recorded_at_utc": datetime.now(timezone.utc).isoformat(), "owner": "Mert",
            "scope": "Controlled local loopback HTTP scheduling with synthetic work; no camera, inference, field accuracy or capture latency claim",
            "environment": {"python": platform.python_version(), "platform": platform.platform()},
            "settings": {**settings, "repeats": repeats, "durable_fsync": True, "http_response_status": 204},
            "trials": trials, "medians": medians,
            "processing_loop_wall_reduction_fraction": 1 - medians["background"]["processing_loop_wall_s"] / medians["synchronous_baseline_algorithm"]["processing_loop_wall_s"],
            "limitations": ["Synthetic sleeps are not GPU inference or actual frame-processing performance.",
                            "This isolates synchronous versus background HTTP scheduling using the same durable outbox implementation.",
                            "Durable disk writes still block producers; one sender does not improve network capacity.",
                            "Shutdown drain time remains part of end-to-end completion; sustained field behavior is untested."]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = compare()
    result["source_revision"] = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    result["source_sha256"] = {name: hashlib.sha256(Path(name).read_bytes()).hexdigest()
                               for name in ["worker/publish.py", "worker/delivery.py", "worker/main.py", "evaluation/delivery_benchmark.py"]}
    args.output.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n")
    print(json.dumps({"medians": result["medians"], "processing_loop_wall_reduction_fraction": result["processing_loop_wall_reduction_fraction"]}))


if __name__ == "__main__":
    main()
