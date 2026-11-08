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

## Verified local SSH delivery — 7 November 2026, 18:32 America/New_York / 23:32 UTC

Mert verified a loopback-only, two-hop SSH path from the compute node to a local application. No inbound GPU HTTP server or public listening port was required. The application must run in one Node process with a persistent local store; previews are intentionally ephemeral process memory. Another account must verify its own SSH and scheduler access.

Start the built app on the laptop with `npm run start -w @emission-lens/frontend -- --hostname 127.0.0.1 --port 3011`, using private server settings in ignored `frontend/.env.local` (see the root `.env.example`). Through an existing authenticated SSH master socket, forward the login node's loopback port:

```bash
ssh -S "$task_socket" -O forward \
  -R 127.0.0.1:43011:127.0.0.1:3011 student032@alpha1.empireai.edu
```

Inside the allocated compute shell, create the second encrypted hop to the login node:

```bash
ssh -M -S "/tmp/emission-lens-${SLURM_JOB_ID}-relay.sock" -fN \
  -o BatchMode=yes -o ExitOnForwardFailure=yes \
  -L 127.0.0.1:43012:127.0.0.1:43011 alpha1.empireai.edu
export EMISSION_LENS_INGEST_URL=http://127.0.0.1:43012/api/worker
read -r EMISSION_LENS_WORKER_TOKEN < "$HOME/.config/emission-lens/worker-token"
export EMISSION_LENS_WORKER_TOKEN
python -m worker.main --require-cuda --require-delivery --device 0 \
  --seconds 300 --preview-every 3 \
  --outbox "runs/outbox-${SLURM_JOB_ID}" \
  --output "runs/delivery-${SLURM_JOB_ID}.json"
```

Provision the same private random token on server and worker beforehand, with private directory/file permissions. Do not print it, place it in command arguments, or commit it. The loopback HTTP legs remain inside the encrypted SSH tunnels. A failed required delivery leaves exact retry batches on disk and fails the worker check.

After the worker finishes, close its compute relay, unset process credentials, exit the job to release the slice, and cancel the laptop's login forward:

```bash
ssh -S "/tmp/emission-lens-${SLURM_JOB_ID}-relay.sock" -O exit alpha1.empireai.edu
unset EMISSION_LENS_WORKER_TOKEN EMISSION_LENS_INGEST_URL
# Exit the compute allocation, then on the laptop:
ssh -S "$task_socket" -O cancel \
  -R 127.0.0.1:43011:127.0.0.1:3011 student032@alpha1.empireai.edu
```

Keep the authenticated master open only while it is needed. `infra/train.sbatch` now uses the verified Python environment and explicit account/QOS, checks that reviewed data/weights exist, chooses memory-aware AutoBatch, and creates a unique run directory. No training is launched by these delivery checks.

## Persistent local SSH master — 8 November 2026, 00:10 America/New_York / 8 November 2026, 05:10 UTC

Mert reauthenticated using a persistent socket directory after the prior temporary directory was removed. The same authenticated master is available to the implementation work streams; credentials and authenticator codes stay in Terminal.

```bash
mkdir -p "$HOME/.ssh/emission-lens"
chmod 700 "$HOME/.ssh/emission-lens"
ssh -o ControlMaster=auto -o ControlPersist=no \
  -S "$HOME/.ssh/emission-lens/control" \
  student032@alpha1.empireai.edu
```

Keep that Terminal session open while its connection and relays are in use. Set `task_socket="$HOME/.ssh/emission-lens/control"` in the delivery examples above. Verify access without another password prompt using:

```bash
ssh -S "$HOME/.ssh/emission-lens/control" -O check student032@alpha1.empireai.edu
ssh -S "$HOME/.ssh/emission-lens/control" -o BatchMode=yes student032@alpha1.empireai.edu 'id -un'
```

Both checks pass on this recovery. This changes local connection plumbing only; it does not grant scientific acceptance or start an inference job. Camera-222 live operation is separately authorized by Mert, with one GPU slice, a six-hour scheduler cap and a shorter worker interval reserving time for setup/shutdown. Running-state evidence and the final job/end time are recorded in Worklog.md and Coordination.md after verification. Private runtime manifests, relays and credentials remain outside Git.

**Running checkpoint (8 November 2026, 00:23 America/New_York / 05:23 UTC):** Live job 176075 is running on CUDA and delivering to the single production application on loopback port 3138. Its scheduled allocation end is 06:12:38 America/New_York / 11:12:38 UTC. An owned idle-awake process follows the corrected connection guard's lifetime; system sleep settings are unchanged. Keep the authenticated Terminal and laptop/network available. Only this job's relays are scheduled for cleanup; the user's SSH master is preserved. Actual end-of-job cleanup and sustained reliability remain unverified. See [the startup and relay-repair evidence](../evaluation/222-live-restart-176075.md).
