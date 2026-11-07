# Runtime checks

**Owner:** Mert
**Updated:** 7 November 2026, 18:13 America/New_York (23:13 UTC)

The live worker runs separately from web requests. GPU resources are allocated explicitly and released at the end of each bounded run. CI uses a CPU-only PyTorch runtime; it verifies logic and fixtures without claiming GPU execution or downloading footage.

## Four-camera CUDA tracking benchmark

On Mert's authenticated Empire AI account, from `~/emission-lens`:

```bash
srun -A rpicourse --qos=normal -p alpha \
  --reservation=binghamton_hackathon --gres=gpu:1g.10gb:1 \
  -c 1 --mem=8G --time=00:10:00 \
  --job-name=emission-lens-benchmark --chdir="$HOME/emission-lens" \
  "$HOME/emission-lens-py312/bin/python" -m evaluation.benchmark \
  --seconds 120 --weights yolo11n.pt --image-size 640 \
  --output "runs/benchmark.json"
```

Run only inside an allocated compute node. The login node's interpreter resolves differently and is not the verified Python 3.12 environment. Account and QOS above are Mert's verified settings; another account must check its associations. Keep each person at no more than two slices and each job within six hours.

By default the benchmark reads all enabled camera configs, creates one model and ByteTrack state per camera, warms each with one excluded real frame, then measures the requested wall interval with a fair serial camera loop. Repeat `--camera 222 --camera 223` for a subset. CUDA is required and the actual inference backend is checked. No CPU fallback is called GPU work. Per-camera tracker state resets after a reader session changes.

The diagnostic JSON includes script/weight hashes, source commit, versions, GPU, measurement duration, per-camera frame counts, media-session spans, synchronized tracking wall times, local receipt-to-processing age, reader drops/reconnections, and peak Torch allocated memory. Model loading and warmup are excluded from measured tracking timings. Reader waiting is excluded from each call's tracking timing and included in wall FPS. Startup and shutdown occur outside the requested measurement duration. A failed or unavailable camera produces a failure record and nonzero process exit rather than a successful four-camera claim.

Repeated tracked boxes are observations, not unique vehicle counts or crossings. Media span can include gaps and is not footage coverage. Receipt-to-processing age is buffer age, not capture-to-dashboard latency. Peak Torch allocated memory excludes non-Torch memory. This is a bounded performance check, not held-out accuracy, calibrated traffic, emissions, or dashboard-delivery validation. No frames, overlays or track IDs are saved.

Only reviewed diagnostic JSON should be copied out of ignored `runs/` for publication. Keep footage, weights, credentials and tokens out of Git.

## Automated checks

`.github/workflows/checks.yml` runs application type checks, backend tests, retained CARB data checks, the production web build, and Python worker tests on pushes and pull requests. It grants read-only repository access and cancels superseded runs for the same branch. It requires no camera, GPU, account password, API token, or hosted service credential. Passing CI does not establish live integration or field accuracy.
