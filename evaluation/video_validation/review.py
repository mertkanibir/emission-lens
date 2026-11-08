"""Blind review inventory, sequence rendering, immutable ledger freeze and comparison.

Only inventory/render/freeze run before the blind boundary. Comparison is a separate
explicit operation requiring a verified freeze. All generated artifacts stay private.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
PRIVATE = ROOT / "data/raw/video_validation"
CAMERAS = ("222", "223", "228", "220")
VERSION = "visual-review-v1"
COUNTING_RULE = "bottom-center ground contact proxy changes stable side across finite gate segment; once per physical passage per direction; positive=(end-start)x(point-start)>0; finite endpoints included only with actual side change; tangencies excluded"
MATCH_POLICY = "maximum_cardinality_then_minimum_total_absolute_time_gap_same_direction_v1"
COMPARISON_VERSION = "visual-comparison-v2-recipe-provenance"


def geometry_fingerprint(config, gate_id):
    """Semantic count identity independent of JSON whitespace/newlines."""
    gate = next(g for g in config["gates"] if g["id"] == gate_id)
    payload = {"camera_id":config["camera_id"], "selected_gate":gate,
               "road_region":config.get("road_region"), "excluded_regions":config.get("excluded_regions",[]),
               "counting_rule":COUNTING_RULE,
               "metrics_policy":{k:config.get(k,v) for k,v in {"min_track_hits":3,"hysteresis":.01,"max_gap_s":1.,
                   "stopped_threshold_per_s":None,"stopped_min_duration_s":3.,"queue_region":None}.items()},
               "comparison_policy":MATCH_POLICY}
    return digest(payload)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def file_sha(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def private_path(path):
    path = Path(path).resolve()
    if not path.is_relative_to(PRIVATE.resolve()):
        raise ValueError("Generated artifacts must stay inside data/raw/video_validation")
    return path


def write_private(path, value, immutable=False):
    path = private_path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(value, indent=2, allow_nan=False) + "\n"
    if path.exists() and path.read_text() == payload:
        return
    if immutable:
        with path.open("x", encoding="utf-8") as stream:
            stream.write(payload)
    else:
        fd, name = tempfile.mkstemp(dir=path.parent, prefix=".review-")
        try:
            with os.fdopen(fd,"w",encoding="utf-8") as stream:
                stream.write(payload)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(name,path)
        finally:
            if os.path.exists(name):
                os.unlink(name)


def finite(value, name, minimum=0):
    if type(value) not in (int, float) or not math.isfinite(value) or value < minimum:
        raise ValueError(f"{name} must be a finite number >= {minimum}")
    return value


def window(values):
    if not isinstance(values, list) or len(values) != 2:
        raise ValueError("window must be [start_s, end_s)")
    start, end = [finite(v, "window") for v in values]
    if end <= start:
        raise ValueError("window must advance")
    return start, end


def reservations():
    return [json.loads(p.read_text()) for p in sorted((PRIVATE/'reservations').glob('*.json'))]


def supersessions():
    return {row['superseded_ledger_sha256']:row for p in sorted((PRIVATE/'supersessions').glob('*.json'))
            for row in [json.loads(p.read_text())]}


def ensure_unreserved(camera,clip_sha,bounds):
    start,end=window(bounds)
    for row in reservations():
        if row['status']=='reserved_unviewed' and row['camera_id']==camera and row['clip_sha256']==clip_sha:
            a,b=window(row['window'])
            if start<b and end>a:
                raise ValueError(f"Window overlaps reserved unviewed evaluation segment {a:g}-{b:g}s")


def reserve(camera,clip,bounds):
    window(bounds)
    row={'camera_id':camera,'clip_sha256':file_sha(clip),'window':[float(x) for x in bounds],
         'status':'reserved_unviewed','author':'Mert','reason':'fresh evaluation before any prospective repair',
         'created_at_utc':datetime.now(timezone.utc).isoformat()}
    path=PRIVATE/'reservations'/f"{make_key(camera,row['clip_sha256'],bounds,'reserved')}.json"
    if path.exists():return path
    write_private(path,row,immutable=True)
    return path


def probe(clip):
    """Decode timestamp inventory; no inference and no reference files."""
    result = subprocess.run([
        "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_frames",
        "-show_streams", "-show_format", "-show_entries",
        "frame=best_effort_timestamp_time:stream=width,height,avg_frame_rate,time_base,start_time,duration:format=duration,start_time",
        "-of", "json", str(clip),
    ], capture_output=True, text=True, check=True)
    data = json.loads(result.stdout)
    pts = [float(row["best_effort_timestamp_time"]) for row in data["frames"]]
    if not pts or any(b <= a for a, b in zip(pts, pts[1:])):
        raise ValueError("Missing/nonadvancing video PTS; resolve discontinuities before review")
    gaps = [b - a for a, b in zip(pts, pts[1:])]
    cadence = sorted(gaps)[len(gaps)//2] if gaps else 0
    return {"streams": data["streams"], "format": data["format"],
            "first_pts_s": pts[0], "last_pts_s": pts[-1], "frame_count": len(pts),
            "median_frame_interval_s": cadence,
            "gaps": [{"start_s": a-pts[0], "end_s": b-pts[0]} for a, b in zip(pts, pts[1:]) if b-a > max(.2, 2*cadence)],
            "pts": pts}


def inventory():
    rows = []
    for camera in CAMERAS:
        clips = sorted((ROOT / "data/raw/clips" / camera).glob("*.ts"))
        if not clips:
            rows.append({"camera_id": camera, "status": "missing_media", "windows": []})
        for clip in clips:
            sha = file_sha(clip)
            cache = PRIVATE / "inventory" / f"{sha}.json"
            if cache.exists():
                info = json.loads(cache.read_text())
            else:
                info = probe(clip)
                write_private(cache, info)
            geometry = ROOT / "config/cameras" / f"{camera}.measurement.json"
            metadata = clip.with_suffix(".json")
            duration = info["last_pts_s"] - info["first_pts_s"] + info["median_frame_interval_s"]
            # Full-file queue includes windows outside practice/held-out; no implied review.
            bounds = sorted(set([0., min(60., duration), min(180., duration), min(360., duration), min(480., duration), duration]))
            windows = []
            for a, b in zip(bounds, bounds[1:]):
                while a < b:
                    stop = min(a + 120, b)
                    windows.append({"window": [a, stop], "status": "pending_visual_review"})
                    a = stop
            config = json.loads(geometry.read_text()) if geometry.exists() else None
            freezes = []
            review_paths=sorted((PRIVATE/'frozen').glob('*.json'))+sorted((PRIVATE/'revisions').glob('*.json'))
            for path in review_paths:
                frozen = verify_freeze(path)
                ledger = frozen["ledger"]
                if ledger["camera_id"] == camera and ledger["clip_sha256"] == sha:
                    freezes.append({"key":ledger["key"], "window":ledger["window"], "gate":ledger["gate"],
                        "geometry_sha256":ledger["geometry_sha256"], "ledger_sha256":frozen["ledger_sha256"],
                        "coverage_status":ledger["coverage_status"], "human_confirmed":False,
                        "reference_independent":frozen.get('references_opened_before_freeze') is False,
                        "supersession":supersessions().get(frozen['ledger_sha256']),
                        "status":"superseded_do_not_use" if frozen['ledger_sha256'] in supersessions() else 'current'})
            for item in windows:
                matches = [f for f in freezes if f["window"] == item["window"] and f['status']=='current']
                if matches:
                    item["status"] = ("partial_assisted_review" if all(f['coverage_status']=='partial' for f in matches)
                                      else "frozen_assisted_review")
                    item["reviews"] = matches
                for reserved in reservations():
                    if reserved['camera_id']==camera and reserved['clip_sha256']==sha and reserved['status']=='reserved_unviewed':
                        a,b=reserved['window']
                        if item['window'][0]<b and item['window'][1]>a:
                            item['status']='reserved_unviewed'
                            item['reserved_window']=reserved['window']
            rows.append({"camera_id": camera, "status": "available", "clip": str(clip),
                         "clip_sha256": sha, "duration_s": duration,
                         "metadata_sha256": file_sha(metadata) if metadata.exists() else None,
                         "geometry_raw_sha256": file_sha(geometry) if geometry.exists() else None,
                         "geometry_canonical_sha256":digest(config) if config else None,
                         "gates":{g["id"]:geometry_fingerprint(config,g["id"]) for g in config["gates"]} if config else {},
                         "first_pts_s": info["first_pts_s"], "last_pts_s": info["last_pts_s"],
                         "frame_count": info["frame_count"], "gaps": info["gaps"],
                         "reference_status": "not_opened_by_inventory", "windows": windows,"frozen_reviews":freezes})
    manifest = {"version": VERSION, "recordings": rows}
    write_private(PRIVATE / "manifest.json", manifest)
    return manifest


def make_key(camera, clip_sha, bounds, geometry_sha, review_version=VERSION):
    start,end=window(bounds)
    return digest({"camera_id": camera, "clip_sha256": clip_sha, "window": [float(start),float(end)],
                   "geometry_sha256": geometry_sha, "review_version": review_version})


def export_manifest(destination):
    """Allowlisted scalar provenance only; no local absolute paths or event ledgers."""
    manifest=inventory()
    rows=[]
    fields=('camera_id','status','clip_sha256','duration_s','metadata_sha256','geometry_raw_sha256',
            'geometry_canonical_sha256','gates','first_pts_s','last_pts_s','frame_count','gaps','windows','frozen_reviews')
    for row in manifest['recordings']:
        safe={k:row[k] for k in fields if k in row}
        if 'clip' in row:safe['source_filename']=Path(row['clip']).name
        rows.append(safe)
    result={'review_version':VERSION,'author':'Mert','human_confirmed':False,
            'scope':'full supplied recordings; pending and reserved windows remain explicit',
            'recordings':rows}
    destination=Path(destination).resolve()
    if destination.parent != (ROOT/'evaluation/video_validation').resolve():
        raise ValueError('Public manifest destination must be the owned package directory')
    destination.write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
    return destination


def render(camera, clip, geometry, gate_id, bounds, fps=5.):
    """Original frames at timestamp-based stride; no interpolated/duplicated frames.

    Sheets are a sequence-review aid, never automatic coverage certification.
    Separate render bundles can inspect candidate intervals at full native FPS.
    """
    from PIL import Image, ImageDraw
    start, end = window(bounds)
    finite(fps, "fps", .01)
    clip, geometry = Path(clip), Path(geometry)
    config = json.loads(geometry.read_text())
    if config["camera_id"] != camera:
        raise ValueError("Camera does not match geometry")
    gate = next(g for g in config["gates"] if g["id"] == gate_id)
    clip_sha, raw_geometry_sha = file_sha(clip), file_sha(geometry)
    ensure_unreserved(camera,clip_sha,bounds)
    geometry_sha = geometry_fingerprint(config, gate_id)
    cache = PRIVATE / "inventory" / f"{clip_sha}.json"
    info = json.loads(cache.read_text()) if cache.exists() else probe(clip)
    write_private(cache, info)
    origin = info["first_pts_s"]
    if end > info["last_pts_s"] - origin + info["median_frame_interval_s"] + .001:
        raise ValueError("Requested window exceeds video coverage")
    key = make_key(camera, clip_sha, bounds, geometry_sha)
    bundle = PRIVATE / "renders" / key / f"{fps:g}fps"
    if (bundle / "sequence.json").exists():
        return bundle
    bundle.mkdir(parents=True, exist_ok=True)
    filter_expr = f"select='gte(t,{origin+start:.6f})*lt(t,{origin+end:.6f})*(isnan(prev_selected_t)+gte(t-prev_selected_t,{1/fps-.001:.6f}))',scale=960:540,showinfo"
    proc = subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "info", "-copyts", "-i", str(clip),
                           "-map", "0:v:0", "-vf", filter_expr, "-fps_mode", "vfr", "-q:v", "3",
                           str(bundle / "frame-%06d.jpg")], capture_output=True, text=True, check=True)
    times = [float(x) for x in re.findall(r"\bn:\s*\d+\s+pts:\s*\d+\s+pts_time:([\d.]+)", proc.stderr)]
    files = sorted(bundle.glob("frame-*.jpg"))
    if not files or len(times) != len(files):
        raise ValueError("Decoded frames and PTS count do not match")
    refs = []
    sheets = []
    for index, (path, pts) in enumerate(zip(files, times)):
        image = Image.open(path).convert("RGB")
        draw = ImageDraw.Draw(image)
        a, b = [(round(x*image.width), round(y*image.height)) for x, y in [gate["start"], gate["end"]]]
        draw.line([a, b], fill="yellow", width=3)
        draw.rectangle((0, 0, image.width, 22), fill="black")
        label = f"REPLAY {camera} | clip {pts-origin:.3f}s | PTS {pts:.3f} | {gate_id} | frame {index+1}"
        draw.text((5, 4), label, fill="white")
        image.save(path, quality=88)
        refs.append({"frame": path.name, "source_pts_s": pts, "clip_time_s": round(pts-origin, 6)})
    # 12 frames = ~2.4 seconds at 5 FPS, each frame 480x270.
    for offset in range(0, len(files), 12):
        sheet = Image.new("RGB", (1440, 1080), "black")
        for j, path in enumerate(files[offset:offset+12]):
            with Image.open(path) as image:
                sheet.paste(image.resize((480,270)), ((j%3)*480,(j//3)*270))
        name = f"sheet-{offset//12+1:04d}.jpg"
        sheet.save(bundle / name, quality=91)
        sheets.append({"file": name, "first_frame": offset+1, "last_frame": min(offset+12,len(files))})
    write_private(bundle / "sequence.json", {"key": key, "camera_id": camera, "clip_sha256": clip_sha,
                    "geometry_sha256": geometry_sha, "geometry_raw_sha256": raw_geometry_sha,
                    "geometry_canonical_sha256": digest(config), "geometry": config, "gate": gate_id, "window": bounds,
                    "review_version": VERSION, "sample_fps": fps, "frames": refs, "sheets": sheets,
                    "source_gaps": info["gaps"], "coverage_status": "rendered_only_not_reviewed"})
    return bundle


def validate_events(events, bounds, gate, require_evidence=True):
    start, end = window(bounds)
    ids = set()
    for event in events:
        required = {"id", "clip_time_s", "gate", "direction"}
        extra = {"visual_class", "uncertainty", "evidence"}
        if (require_evidence and set(event) != required | extra) or (not require_evidence and (not required <= set(event) or not set(event) <= required | extra)):
            raise ValueError("Unsupported event fields; identifiers/privacy data are forbidden")
        if not isinstance(event["id"], str) or not re.fullmatch(r"e[0-9]{4}", event["id"]) or event["id"] in ids:
            raise ValueError("Unique window-local eNNNN event IDs required")
        ids.add(event["id"])
        t = finite(event["clip_time_s"], "clip_time_s")
        if not start <= t < end:
            raise ValueError("Event outside half-open window; endpoints are never coerced")
        if event["gate"] != gate or event["direction"] not in ("positive", "negative"):
            raise ValueError("Unsupported gate/direction")
        if "visual_class" in event and event["visual_class"] not in ("car", "truck", "bus", "motorcycle", "unknown"):
            raise ValueError("Unsupported broad class")
        if "uncertainty" in event and event["uncertainty"] not in ("clear", "occluded", "ambiguous_time", "ambiguous_crossing"):
            raise ValueError("Explicit bounded uncertainty required")
        if "evidence" in event and (not event["evidence"] or not all(type(i) is int and i > 0 for i in event["evidence"])):
            raise ValueError("Evidence must reference positive sequence-frame indices")


def audit_event_order_and_repeats(events):
    """Flag transcription blocks; never silently sort or deduplicate vehicles."""
    order=[{'previous_id':a['id'],'id':b['id']} for a,b in zip(events,events[1:]) if b['clip_time_s']<a['clip_time_s']]
    signatures=[digest({k:v for k,v in e.items() if k!='id'}) for e in events]
    pairs={}
    repeats=[]
    for j in range(len(events)-1):
        key=tuple(signatures[j:j+2])
        for i in pairs.get(key,[]):
            if j<i+2:continue
            length=2
            while j+length<len(events) and i+length<j and signatures[i+length]==signatures[j+length]:length+=1
            repeats.append({'first_ids':[e['id'] for e in events[i:i+length]],
                            'repeated_ids':[e['id'] for e in events[j:j+length]],'length':length})
        pairs.setdefault(key,[]).append(j)
    # Keep maximal blocks instead of reporting every shifted suffix.
    repeats=[r for r in repeats if not any(set(r['first_ids'])<set(other['first_ids']) and set(r['repeated_ids'])<set(other['repeated_ids']) for other in repeats)]
    return {'chronological':not order,'out_of_order':order,'suspicious_repeated_blocks':repeats}


def freeze(ledger_path, sequence_path, repeat_review_path=None):
    ledger = json.loads(Path(ledger_path).read_text())
    sequence = json.loads(Path(sequence_path).read_text())
    required = {"key", "camera_id", "clip_sha256", "geometry_sha256", "window", "gate", "review_version",
                "review_method", "human_confirmed", "counting_rule", "reviewed_sheets", "coverage_status", "events", "limitations"}
    if set(ledger) != required:
        raise ValueError("Ledger fields do not match the private review schema")
    for field in ("key", "camera_id", "clip_sha256", "geometry_sha256", "window", "gate", "review_version"):
        if ledger[field] != sequence[field]:
            raise ValueError(f"Ledger provenance mismatch: {field}")
    if ledger["key"] != make_key(ledger["camera_id"], ledger["clip_sha256"], ledger["window"], ledger["geometry_sha256"], ledger["review_version"]):
        raise ValueError("Invalid review key")
    if ledger["review_method"] != "assisted_visual_sequence_review" or ledger["human_confirmed"] is not False:
        raise ValueError("Assisted review cannot be labeled human ground truth")
    if ledger["counting_rule"] != COUNTING_RULE:
        raise ValueError("Counting rule must match the declared semantic geometry policy")
    if ledger["coverage_status"] not in ("complete_assisted_sequence", "partial", "uncertain"):
        raise ValueError("Unsupported coverage status")
    expected = {s["file"] for s in sequence["sheets"]}
    reviewed = ledger["reviewed_sheets"]
    if len(reviewed) != len(set(reviewed)) or not set(reviewed) <= expected:
        raise ValueError("Invalid sheet coverage")
    if ledger["coverage_status"] == "complete_assisted_sequence":
        if set(reviewed) != expected or not expected or sequence["sample_fps"] < 5:
            raise ValueError("Complete coverage requires every sequence sheet at >=5 FPS")
        if any(g["start_s"] < ledger["window"][1] and g["end_s"] > ledger["window"][0] for g in sequence["source_gaps"]):
            raise ValueError("Source gaps prevent complete coverage")
    validate_events(ledger["events"], ledger["window"], ledger["gate"])
    audit=audit_event_order_and_repeats(ledger['events'])
    if not audit['chronological']:
        raise ValueError('Ledger must be chronological/nondecreasing; equal-time distinct vehicles remain valid. Do not silently sort.')
    review_sha=None
    if audit['suspicious_repeated_blocks']:
        if repeat_review_path is None:
            raise ValueError('Suspicious exact repeated event/evidence block requires explicit review; do not deduplicate timestamps')
        review=json.loads(Path(repeat_review_path).read_text())
        if (set(review)!={'ledger_sha256','repeat_audit_sha256','reason','author'} or
            review['ledger_sha256']!=digest(ledger) or review['repeat_audit_sha256']!=digest(audit) or
            review['author'] not in ('Mert','Carter') or not isinstance(review['reason'],str) or not review['reason'].strip()):
            raise ValueError('Explicit repeated-block review does not bind this ledger/audit')
        review_sha=file_sha(repeat_review_path)
    for e in ledger["events"]:
        if max(e["evidence"]) > len(sequence["frames"]):
            raise ValueError("Evidence frame does not exist")
    frozen = {"ledger": ledger, "ledger_sha256": digest(ledger), "sequence_sha256": file_sha(sequence_path),
              "frozen_at_utc": datetime.now(timezone.utc).isoformat(), "references_opened_before_freeze": False,
              'event_audit':audit,'repeat_review_sha256':review_sha}
    target = PRIVATE / "frozen" / f"{ledger['key']}-{frozen['ledger_sha256']}.json"
    # Existing immutable ledger remains untouched on an identical rerun.
    if target.exists():
        old = json.loads(target.read_text())
        if old["ledger"] != ledger or old["sequence_sha256"] != frozen["sequence_sha256"]:
            raise ValueError("Frozen artifact collision")
        return target
    write_private(target, frozen, immutable=True)
    return target


def verify_freeze(path):
    frozen = json.loads(Path(path).read_text())
    if digest(frozen["ledger"]) != frozen["ledger_sha256"]:
        raise ValueError("Frozen ledger was modified")
    return frozen


def require_current_freeze(path):
    frozen=verify_freeze(path)
    if frozen['ledger_sha256'] in supersessions():
        raise ValueError('Frozen ledger is superseded; retain original but do not use it for comparison')
    return frozen


def register_supersession(original_path, corrected_path, reason):
    original,corrected=verify_freeze(original_path),verify_freeze(corrected_path)
    if original['ledger']['key']!=corrected['ledger']['key'] or original['ledger_sha256']==corrected['ledger_sha256']:
        raise ValueError('Supersession must link distinct ledgers for identical review inputs')
    row={'superseded_ledger_sha256':original['ledger_sha256'],'corrected_ledger_sha256':corrected['ledger_sha256'],
         'key':original['ledger']['key'],'reason':reason,'author':'Mert','status':'superseded_do_not_use'}
    path=PRIVATE/'supersessions'/f"{original['ledger_sha256']}.json"
    write_private(path,row,immutable=True)
    return path


def revise(original_path, changes_path):
    """Explicit post-reference adjudication; original blind ledger stays immutable."""
    original=require_current_freeze(original_path)
    changes=json.loads(Path(changes_path).read_text())
    required={'original_ledger_sha256','adjudication_path','remove_ids','add_events','reason'}
    if not required<=set(changes) or not set(changes)<=required|{'insertion_points'}:
        raise ValueError('Revision requires explicit changes and evidence provenance')
    if changes['original_ledger_sha256']!=original['ledger_sha256']:
        raise ValueError('Revision original hash mismatch')
    evidence=private_path(changes['adjudication_path'])
    ledger=json.loads(json.dumps(original['ledger']))
    removed=changes['remove_ids']
    if len(set(removed))!=len(removed) or not set(removed)<={e['id'] for e in ledger['events']}:
        raise ValueError('Revision removal IDs must identify original events exactly once')
    ledger['events']=[e for e in ledger['events'] if e['id'] not in removed]
    for event in changes['add_events']:
        after=changes.get('insertion_points',{}).get(event['id'])
        if after is None:ledger['events'].append(event)
        else:
            indices=[i for i,e in enumerate(ledger['events']) if e['id']==after]
            if len(indices)!=1:raise ValueError('Explicit insertion point does not exist')
            ledger['events'].insert(indices[0]+1,event)
    validate_events(ledger['events'],ledger['window'],ledger['gate'])
    if not audit_event_order_and_repeats(ledger['events'])['chronological']:
        raise ValueError('Revision must preserve explicit chronological order; supply insertion_points rather than silently sorting')
    ledger['limitations'].append('Post-reference adjudication; not new independent blind evidence. '+changes['reason'])
    revised={'ledger':ledger,'ledger_sha256':digest(ledger),'sequence_sha256':original['sequence_sha256'],
             'frozen_at_utc':datetime.now(timezone.utc).isoformat(),'references_opened_before_freeze':True,
             'human_confirmed':False,'original_ledger_sha256':original['ledger_sha256'],
             'changes_sha256':file_sha(changes_path),'adjudication_sha256':file_sha(evidence)}
    target=PRIVATE/'revisions'/f"{ledger['key']}-{revised['ledger_sha256']}.json"
    if target.exists():return target
    write_private(target,revised,immutable=True)
    return target


def legacy_match_count(reference, observed, tolerance):
    candidates=sorted((abs(a["clip_time_s"]-b["clip_time_s"]),i,j)
                      for i,a in enumerate(reference) for j,b in enumerate(observed)
                      if a["direction"]==b["direction"] and abs(a["clip_time_s"]-b["clip_time_s"])<=tolerance)
    used_a,used_b=set(),set()
    for _,i,j in candidates:
        if i not in used_a and j not in used_b:
            used_a.add(i)
            used_b.add(j)
    return len(used_a)


def match(reference, observed, bounds, gate, tolerance=1.5):
    """Maximum-cardinality, minimum-total-time-gap order-preserving match by direction.

    Unlike a nearest-edge greedy match, dynamic programming cannot sacrifice a
    second valid pairing in crowded traffic. Equal-time vehicles remain distinct.
    """
    finite(tolerance, "tolerance")
    for rows in (reference, observed):
        validate_events(rows, bounds, gate, require_evidence=False)
    pairs = []
    for direction in ("positive", "negative"):
        a = sorted([i for i,e in enumerate(reference) if e["direction"] == direction], key=lambda i: reference[i]["clip_time_s"])
        b = sorted([j for j,e in enumerate(observed) if e["direction"] == direction], key=lambda j: observed[j]["clip_time_s"])
        dp = [[(0, 0., ()) for _ in range(len(b)+1)] for _ in range(len(a)+1)]
        for i in range(1, len(a)+1):
            for j in range(1, len(b)+1):
                choices = [dp[i-1][j], dp[i][j-1]]
                gap = abs(reference[a[i-1]]["clip_time_s"]-observed[b[j-1]]["clip_time_s"])
                if gap <= tolerance:
                    n, cost, prior = dp[i-1][j-1]
                    choices.append((n+1, cost+gap, prior+((a[i-1],b[j-1],gap),)))
                dp[i][j] = max(choices, key=lambda row:(row[0], -row[1]))
        pairs.extend(dp[-1][-1][2])
    used_a, used_b = {p[0] for p in pairs}, {p[1] for p in pairs}
    tp = len(pairs)
    return {"matching_policy":MATCH_POLICY, "legacy_closest_first_tp":legacy_match_count(reference,observed,tolerance),
            "reference_total": len(reference), "observed_total": len(observed), "tp": tp,
            "fp": len(observed)-tp, "fn": len(reference)-tp,
            "precision": tp/len(observed) if observed else None,
            "recall": tp/len(reference) if reference else None,
            "relative_total_error": (len(observed)-len(reference))/len(reference) if reference else None,
            "absolute_total_error": abs(len(observed)-len(reference)),
            "direction_error": {d:sum(e["direction"]==d for e in observed)-sum(e["direction"]==d for e in reference) for d in ("positive","negative")},
            "pairs": [{"reference_id":reference[i]["id"], "observed_id":observed[j]["id"], "gap_s":gap} for i,j,gap in pairs],
            "missed": [e for i,e in enumerate(reference) if i not in used_a],
            "extra": [e for j,e in enumerate(observed) if j not in used_b], "tolerance_s": tolerance}


def compare(frozen_path, reference_path, model_path):
    frozen = require_current_freeze(frozen_path)  # before opening either reference
    ledger = frozen["ledger"]
    sources = {"independent_assisted":ledger}
    for name, path in (("carter_human",reference_path),("model",model_path)):
        if path is None:
            continue
        row = json.loads(Path(path).read_text())
        for field in ("camera_id", "clip_sha256", "geometry_sha256", "window", "gate"):
            if row[field] != ledger[field]:
                raise ValueError(f"Reference mismatch: {name} {field}")
        required={"camera_id","clip_sha256","geometry_sha256","window","gate","source","events","total"}
        if not required<=set(row) or not set(row)<=required|{'pipeline_recipe_sha256'}:
            raise ValueError("Reference needs explicit provenance, source, events or total")
        if 'pipeline_recipe_sha256' in row and not re.fullmatch(r'[0-9a-f]{64}',row['pipeline_recipe_sha256']):
            raise ValueError('Pipeline recipe provenance must be a SHA256')
        if row["source"] != name:
            raise ValueError("Reference source mislabeled")
        if row["events"] is not None:
            validate_events(row["events"], row["window"],row["gate"],require_evidence=False)
            if row["total"] != len(row["events"]):
                raise ValueError("Reference total disagrees with events")
        elif type(row["total"]) is not int or row["total"] < 0:
            raise ValueError("Missing reference event ledger and total")
        sources[name] = row
    result = {"comparison_version":COMPARISON_VERSION,"ledger_sha256":frozen["ledger_sha256"], "human_confirmed":False,
              "reference_independent":frozen.get('references_opened_before_freeze') is False,
              "review_phase":"post_reference_adjudication" if frozen.get('references_opened_before_freeze') else 'blind_frozen_review',
              "human_reference_status":"supplied" if reference_path else "pending_not_supplied",
              "source_file_sha256":{name:file_sha(path) for name,path in (("carter_human",reference_path),("model",model_path)) if path},
              "pipeline_recipe_sha256":sources.get('model',{}).get('pipeline_recipe_sha256'),
              "automatic_camera_enablement":False,"comparisons":{}}
    for a,b in (("carter_human","independent_assisted"),("carter_human","model"),("independent_assisted","model")):
        if a not in sources or b not in sources:
            result["comparisons"][f"{a}_vs_{b}"] = {"status":"pending_human_reference","precision":None,"recall":None}
            continue
        ref, obs = sources[a], sources[b]
        if ref["events"] is not None and obs["events"] is not None:
            value = match(ref["events"],obs["events"],ledger["window"],ledger["gate"])
        else:
            n = ref.get("total",len(ref["events"])) if ref["events"] is not None else ref["total"]
            m = len(obs["events"]) if obs["events"] is not None else obs["total"]
            value = {"reference_total":n,"observed_total":m,"relative_total_error":(m-n)/n if n else None,
                     "precision":None,"recall":None,"limitation":"totals_only_reference"}
        result["comparisons"][f"{a}_vs_{b}"] = value
        if a == "independent_assisted" and obs["events"] is not None:
            certain = [e for e in ref["events"] if e["uncertainty"] != "ambiguous_crossing"]
            result["comparisons"][f"{a}_excluding_ambiguous_vs_{b}"] = match(certain,obs["events"],ledger["window"],ledger["gate"])
            value["interpretation"] = "agreement_with_assisted_visual_review_not_human_accuracy"
        if a == "carter_human" and value["recall"] is not None:
            error=value["relative_total_error"]
            value["provisional_count_criteria_met"] = value["recall"] >= .85 and error is not None and abs(error) <= .15
    input_sha=digest({'source_file_sha256':result['source_file_sha256'],'comparison_version':COMPARISON_VERSION})
    target = PRIVATE/"comparisons"/f"{ledger['key']}-{frozen['ledger_sha256']}-{input_sha}.json"
    write_private(target,result,immutable=True)
    return target


def adapt_model(frozen_path, model_path, clip, geometry, pipeline_recipe=None):
    """Post-freeze adapter for existing check_counts reports, with explicit hashes.

    Any out-of-window legacy endpoint is reported as an error, never discarded.
    The original report is retained and its raw SHA recorded in a sidecar.
    """
    frozen=require_current_freeze(frozen_path)
    ledger=frozen["ledger"]
    config=json.loads(Path(geometry).read_text())
    if file_sha(clip)!=ledger["clip_sha256"] or geometry_fingerprint(config,ledger["gate"])!=ledger["geometry_sha256"]:
        raise ValueError("Model input media/geometry do not match blind freeze")
    raw=json.loads(Path(model_path).read_text())
    if raw["camera_id"]!=ledger["camera_id"] or [raw["start_s"],raw["start_s"]+raw["seconds"]]!=ledger["window"]:
        raise ValueError("Model camera/window mismatch")
    if raw["clip"]!=Path(clip).name or raw["geometry_version"]!=config["version"]:
        raise ValueError("Model clip/config version mismatch")
    if ledger["gate"] not in raw["gates"]:
        raise ValueError("Model report lacks explicit designated-gate evidence; do not invent zero")
    events=[{"id":f"e{i:04}","clip_time_s":e["clip_time_s"],"gate":ledger["gate"],"direction":e["direction"]}
            for i,e in enumerate(raw["gates"][ledger["gate"]]["events"])]
    validate_events(events,ledger["window"],ledger["gate"],require_evidence=False)
    if raw["gates"][ledger["gate"]]["total"]!=len(events):
        raise ValueError("Model events and total disagree")
    normalized={k:ledger[k] for k in ("camera_id","clip_sha256","geometry_sha256","window","gate")}
    normalized.update(source="model",events=events,total=len(events))
    recipe_sha=None
    if pipeline_recipe is not None:
        # Bind the actual frozen experiment recipe even if event JSON happens
        # to be byte-identical to another run. The caller verifies its settings.
        json.loads(Path(pipeline_recipe).read_text())
        recipe_sha=file_sha(pipeline_recipe)
        normalized['pipeline_recipe_sha256']=recipe_sha
    suffix=f'-recipe-{recipe_sha}' if recipe_sha else ''
    target=PRIVATE/"references"/f"{ledger['key']}-model-{file_sha(model_path)}{suffix}.json"
    write_private(target,normalized,immutable=True)
    provenance={"original_file_sha256":file_sha(model_path),
        "geometry_raw_sha256":file_sha(geometry),"clip_sha256":file_sha(clip),
        "recipe":{k:raw[k] for k in ("weights","image_size","sample_fps")},
        "time_basis":"clip_relative_seconds_requires_acquisition_owner_pts_verification",
        "adapter_limitation":"Existing report filenames/versions alone cannot establish remote run input bytes; acquisition owner must attest pinned hash provenance."}
    if recipe_sha is not None:provenance['pipeline_recipe_sha256']=recipe_sha
    write_private(target.with_suffix('.provenance.json'),provenance,immutable=True)
    return target


def parse_manual_annotations(text, bounds, gate):
    """Keep unresolved boundary annotations separate from literal interior events.

    A noncanonical seconds=60 is recognized only at this exact window endpoint,
    as an explicit unresolved annotation, never coerced into an interior event.
    """
    start,end=window(bounds)
    interior,flagged,legacy=[],[],[]
    for number,raw in enumerate(text.splitlines(),1):
        line=raw.split('#',1)[0].strip()
        if not line:continue
        parsed=re.fullmatch(r'(\d+):(\d{2}(?:\.\d+)?)\s+([+-])',line)
        if not parsed:raise ValueError(f"Malformed annotation line {number}")
        minutes,seconds,sign=parsed.groups();seconds=float(seconds)
        t=int(minutes)*60+seconds
        event={"id":f"e{number:04}","clip_time_s":t,"gate":gate,"direction":"positive" if sign=='+' else 'negative'}
        if seconds>=60:
            if seconds!=60 or t!=end:
                raise ValueError(f"Noncanonical timestamp line {number}")
            flagged.append({"line":number,"annotation":raw,"legacy_numeric_time_s":t,
                            "reason":"noncanonical_rounded_window_end_unresolved"})
        elif t==end:
            flagged.append({"line":number,"annotation":raw,"legacy_numeric_time_s":t,
                            "reason":"literal_window_end_annotation_unresolved"})
        elif not start<=t<end:
            raise ValueError(f"Out-of-window annotation line {number}")
        else:interior.append(event)
        legacy.append(event)
    validate_events(interior,bounds,gate,require_evidence=False)
    return interior,flagged,legacy


def adapt_human(frozen_path, reference_path):
    frozen=require_current_freeze(frozen_path)
    ledger=frozen['ledger']
    interior,flagged,legacy=parse_manual_annotations(Path(reference_path).read_text(),ledger['window'],ledger['gate'])
    normalized={k:ledger[k] for k in ('camera_id','clip_sha256','geometry_sha256','window','gate')}
    normalized.update(source='carter_human',events=interior,total=len(interior))
    target=PRIVATE/'references'/f"{ledger['key']}-human-{file_sha(reference_path)}.json"
    write_private(target,normalized,immutable=True)
    write_private(target.with_suffix('.provenance.json'),{'source_file_sha256':file_sha(reference_path),
        'literal_interior_events':len(interior),'original_annotations':len(legacy),
        'unresolved_boundary_annotations':flagged,
        'interpretation':'literal_half_open_sensitivity_not_corrected_ground_truth'},immutable=True)
    return target


def main():
    parser = argparse.ArgumentParser(__doc__)
    commands = parser.add_subparsers(dest="command",required=True)
    commands.add_parser("inventory")
    e=commands.add_parser("export-manifest")
    e.add_argument('destination',type=Path)
    q=commands.add_parser('reserve')
    q.add_argument('camera',choices=CAMERAS)
    q.add_argument('clip',type=Path)
    q.add_argument('--start',type=float,required=True)
    q.add_argument('--end',type=float,required=True)
    r = commands.add_parser("render")
    r.add_argument("camera", choices=CAMERAS)
    r.add_argument("clip",type=Path)
    r.add_argument("geometry",type=Path)
    r.add_argument("gate")
    r.add_argument("--start",type=float,required=True)
    r.add_argument("--end",type=float,required=True)
    r.add_argument("--fps",type=float,default=5.)
    f = commands.add_parser("freeze")
    f.add_argument("ledger",type=Path)
    f.add_argument("sequence",type=Path)
    f.add_argument('--repeat-review',type=Path)
    c = commands.add_parser("compare")
    c.add_argument("frozen",type=Path)
    c.add_argument("model",type=Path)
    c.add_argument("--reference",type=Path)
    a=commands.add_parser("adapt-model")
    a.add_argument("frozen",type=Path)
    a.add_argument("model",type=Path)
    a.add_argument("clip",type=Path)
    a.add_argument("geometry",type=Path)
    a.add_argument('--pipeline-recipe',type=Path)
    h=commands.add_parser("adapt-human")
    h.add_argument("frozen",type=Path)
    h.add_argument("reference",type=Path)
    v=commands.add_parser('revise')
    v.add_argument('frozen',type=Path)
    v.add_argument('changes',type=Path)
    args = parser.parse_args()
    if args.command == "inventory":
        manifest=inventory()
        print(json.dumps([{k:v for k,v in row.items() if k not in ("clip","windows")} for row in manifest["recordings"]],indent=2))
    elif args.command=='export-manifest':
        print(export_manifest(args.destination))
    elif args.command=='reserve':
        print(reserve(args.camera,args.clip,[args.start,args.end]))
    elif args.command == "render":
        print(render(args.camera,args.clip,args.geometry,args.gate,[args.start,args.end],args.fps))
    elif args.command == "freeze":
        print(freeze(args.ledger,args.sequence,args.repeat_review))
    elif args.command == "compare":
        print(compare(args.frozen,args.reference,args.model))
    elif args.command == "adapt-model":
        print(adapt_model(args.frozen,args.model,args.clip,args.geometry,args.pipeline_recipe))
    elif args.command=='adapt-human':
        print(adapt_human(args.frozen,args.reference))
    else:
        print(revise(args.frozen,args.changes))


if __name__ == "__main__":
    main()
