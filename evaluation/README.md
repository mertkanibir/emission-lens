# Evaluation

**Owner:** Mert  
**Updated:** 7 November 2026, 15:55 America/New_York (20:55 UTC)

## Empire AI GPU smoke test

**Verification note (7 November 2026, 15:51 America/New_York / 20:51 UTC):** Mert verified real camera-frame inference on his Empire AI account. [The diagnostic record](./empire-ai-175330.json) records job `175330`, source revision, script and weight hashes, software versions, timestamps, device, and limitations.

| Item | Observed result |
|---|---|
| Compute node | `alphagpu01` |
| Allocation | `alpha`, account `rpicourse`, QOS `normal`, reservation `binghamton_hackathon`, one `gpu:1g.10gb:1` slice, one CPU, 8 GB system memory |
| Device | NVIDIA H100 MIG `1g.10gb`; inference backend and result tensors on `cuda:0` |
| Environment | Python 3.12.3, PyTorch 2.7.1+cu128, torchvision 0.22.1+cu128, Ultralytics 8.4.206, OpenCV 5.0.0.93 |
| Source | Live Caltrans camera 222; 1280 × 720 decoded frames |
| Detector | Pretrained `yolo11n.pt`, inference size 640, confidence threshold 0.25, COCO car/motorcycle/bus/truck classes |
| Sample | 50 prediction frames plus one excluded warmup frame, in one advancing media session |
| Prediction wall time | Median 4.38 ms, mean 5.24 ms; GPU synchronized before and after each call |
| Torch peak allocated memory | 56.12 MiB; not total device memory use |
| Reader | 103 sampled frames kept, 27 oldest-buffer drops; state live at the end of sampling |
| Checks | `python -m pip check` passed; all 24 initial Python tests passed on the compute node, followed by all 39 tests after integrating Carter’s detector/dataset commit `dfc8c2e` |
| Allocation completion | Scheduler reported `COMPLETED`, exit `0:0`, elapsed `00:05:58`; the GPU slice was released |

This verifies the path from direct HLS ingestion through Carter’s `StreamReader` to CUDA vehicle detection. No raw or annotated frames were saved. Only diagnostics are committed. Detection observations in the JSON can include the same vehicle in many frames and must never be used as unique vehicle counts or line crossings.

The short run and its buffer drops do not establish sustained one-camera or four-camera throughput. Prediction times exclude warmup and stream waiting and include preprocessing/postprocessing; they are not capture-to-dashboard delay. Capture UTC is not extracted from the image. Receipt UTC and relative media time remain separate.

There is no held-out accuracy result, custom training result, tracking, calibrated traversal, emissions estimate, or dashboard delivery in this test. The original model wrapper stays on CPU in this Ultralytics version; the check verifies the actual inference backend’s parameters and result tensors on CUDA.

**Integration note (7 November 2026, 15:55 America/New_York / 20:55 UTC):** Carter’s detector and labeling-dataset tools were integrated while this result was being recorded, and all 39 tests passed on the compute node. This smoke test uses YOLO11n at size 640. It does not benchmark `worker.detect.Detector`, whose current defaults are YOLO11s at size 1280; timings must not be compared across those different configurations as a speedup result.

## Reproduce on the compute node

From an authenticated Empire AI login shell, request a GPU. These account settings were verified for Mert; check associations before using another account.

```bash
srun -A rpicourse --qos=normal \
  -p alpha --reservation=binghamton_hackathon \
  --gres=gpu:1g.10gb:1 -c 1 --mem=8G --time=00:30:00 \
  --pty bash -l
```

Inside the allocated compute shell, activate the existing environment and use a checkout of this revision or later:

```bash
source ~/emission-lens-py312/bin/activate
cd ~/emission-lens
nvidia-smi -L
python --version

# Needed only when recreating the verified package environment:
python -m pip install torch==2.7.1+cu128 torchvision==0.22.1+cu128 \
  --index-url https://download.pytorch.org/whl/cu128
python -m pip install -r worker/requirements.txt

python -m pip check
python -m pytest -q
python -m evaluation.gpu_smoke --camera 222 --frames 50 \
  --output "runs/gpu-smoke-${SLURM_JOB_ID}.json"
```

The existing environment uses the compute node’s Python 3.12 interpreter. On the login node its interpreter symlink resolves to Python 3.9, which does not find the installed Python 3.12 packages. Activate and run it on the allocated compute node; the login-node result is not evidence that the environment needs reinstalling.

Weights download separately and are ignored by Git. Check the weight SHA-256 in the JSON when comparing runs. Outputs under `runs/` stay ignored until a reviewed diagnostic record is selected for publication. Exit the allocated shell when finished to release the slice.

Model attribution and API references: [Ultralytics YOLO11](https://docs.ultralytics.com/models/yolo11/), [predict mode](https://docs.ultralytics.com/modes/predict/), and [Ultralytics licensing](https://www.ultralytics.com/license).

## Fine-tuning handoff

Mert owns GPU execution. Carter’s frame collector is available, but raw frames alone do not provide supervised training labels. Before training, prepare reviewed boxes/classes, separate training and held-out footage, and agree on any incompatible class-contract changes. The proposed pickup, box truck, tractor trailer, and Tesla classes are not supplied by this pretrained model. Carter’s proposed 85% Tesla threshold is not a validated result. Keep the pretrained baseline unless a candidate improves held-out results.

## Detector comparison

**Added:** 7 November 2026, 18:20 America/New_York (23:20 UTC), Carter.

`python -m evaluation.compare_models --tuned path/to/best.pt` scores detectors on the 60 human-reviewed test frames and writes [model_comparison.md](./model_comparison.md) and its JSON. Both models are compared on coarse classes (car, truck, bus, motorcycle); the tuned model is also scored on its seven classes, with a check of single-frame Tesla calls at 85% confidence. Boxes under 25 px are ignored on both sides, matching the labeling rule. Settings: image size 1280, confidence 0.25, IoU 0.5.

Pretrained `yolo11s.pt` baseline on CPU: any-vehicle precision 94%, recall 86%. Its truck precision is 21%, because 83 labeled cars, mostly SUVs, were called trucks. Training labels came mostly from pretrained draft boxes and AI-assisted truck classification; only the test frames are fully human-reviewed (see `data/raw/reviewed/provenance.json`, not committed).

## Four-camera tracking and local delivery — 7 November 2026, 18:32 America/New_York / 23:32 UTC

Mert completed Empire AI job **175627** on `alphagpu01`, H100 MIG `1g.10gb`, Python 3.12.3 / Torch 2.7.1+cu128 / Ultralytics 8.4.206, using pretrained YOLO11n at 640 pixels and independent ByteTrack state per camera. Scheduler state is `COMPLETED`, exit `0:0`, elapsed 11:56. This allocation has been released.

The [120-second benchmark](./empire-ai-175627-benchmark.json) excludes one warmup frame per camera:

| Camera | Processed frames | Processed wall FPS | Median tracking wall ms | Buffer drops during measurement |
|---|---:|---:|---:|---:|
| 220 | 626 | 5.22 | 24.75 | 0 |
| 222 | 620 | 5.17 | 22.34 | 0 |
| 223 | 716 | 5.97 | 21.40 | 56 |
| 228 | 693 | 5.77 | 22.45 | 26 |

Measurement duration was 120.018 seconds. All four inference backends were CUDA and all reader threads stopped. Peak Torch allocated memory was 127.28 MiB; this excludes non-Torch memory. Frame bursts and initial buffered samples affect wall FPS. Media span includes gaps and is not footage coverage. The 82 drops on cameras 223/228 prevent a no-drop or complete-coverage claim. No reconnect occurred during this measurement; FFmpeg logged HTTP end-of-file warnings. This does not validate recovery from a forced outage or six-hour reliability.

The separate [90-second delivery run](./empire-ai-175627-delivery.json) processed 1,855 frames across the four cameras, persisted **18 batches in 18 attempts**, and sent **47 temporary annotated previews** with no preview failures or queued aggregate batches. Desktop and 390 px phone browser checks decoded camera 222's matching frame/overlay with no page errors or horizontal overflow. Live status was observed for all four cameras; ending the worker set all four offline. Captured timestamps and capture-to-dashboard latency remain unavailable.

A [paced replay check](./empire-ai-175627-replay.json) used a temporary six-second clip of 30 sampled real camera-222 frames. It delivered four replay-only batches and one annotated preview, with no pending uploads. The temporary clip was removed after verification. Live and replay records stayed separate. No imagery or temporary track IDs are committed.

The [final runtime check](./empire-ai-175627-final-runtime.json) additionally exercised the optional measurement configuration with the disabled example. No traffic or emissions metrics were enabled, and delivery completed. All **150 Python tests and 29 subtests** passed on the compute environment, including the current model-comparison and optional aggregation tests. All **49 backend tests**, package type checks, retained-factor checks and production build passed locally; [the integration CI run](https://github.com/mertkanibir/emission-lens/actions/runs/42425068712) passed both application and CPU-worker jobs.

The [source manifest](./empire-ai-175627-source.json) ties the checks to tested script hashes. The benchmark/delivery/replay used a source-only snapshot on a detached worktree at `7e87aea`; their tested implementation files match published commit `ac09714`. The final runtime extends that source with the optional aggregation wiring and records matching follow-up hashes. This avoids presenting a worktree's base commit as the entire tested source.

These records establish bounded GPU execution, status delivery, exact-frame previews, graceful shutdown and replay isolation. They do **not** establish held-out accuracy, validated crossing counts, stopped-time accuracy, physical calibration, emissions, environmental savings or a hosted deployment. See [the calibration guide](./calibration-guide.md) before enabling geometry. Real camera configurations remain disabled/unreviewed; no regulatory class mapping is silently activated.

## Fine-tuning dataset and GPU preflight

**Updated:** 7 November 2026, 18:35 America/New_York (23:35 UTC), Mert.

Mert downloaded Carter's shared `dataset.zip` (161,810,587 bytes, SHA-256 `901d38a8cf0bbaa10a1b9ad225fa46af373ed8e225c77c944b85c15d6b932d84`) and verified [the dataset audit](./empire-ai-175644-data.json): 280 training / 60 validation / 60 held-out test frames, 70/15/15 per camera, canonical seven-class order, valid boxes, and no placeholders. Image filenames and exact image hashes do not overlap across splits; all four camera timelines are ordered train before validation before test. The split has no substantial temporal purge gap and does not establish generalization to other dates or camera views. All 30 Mert test label files match the final reviewed export by class name and coordinates. Training labels retain draft/assisted provenance; test images are human reviewed.

There are **zero tractor-trailer training or validation examples**, four motorcycle training boxes and zero motorcycle validation boxes. Neither dependable rare-class performance nor the three-frame Tesla rule is established by this dataset.

Empire AI preflight job **175643** completed with scheduler `COMPLETED / 0:0` in 46 seconds on `alphagpu01`, H100 MIG `1g.10gb`, Python 3.12.3 / Torch 2.7.1+cu128 / Ultralytics 8.4.206. Pretrained YOLO11s completed one COCO8 training epoch at 1280 pixels, batch 8, and direct Caltrans camera 222 access returned `True True`. This is an execution check, not a traffic accuracy result.

**Completion note (7 November 2026, 18:47 America/New_York (23:47 UTC), Mert):** Fine-tuning job **175644** completed `0:0` on `alphagpu01` from 23:33:53 to 23:44:18 UTC (18:33:53–18:44:18 America/New_York), elapsed **10m25s**. Training stopped at epoch **40**, with the validation-selected best checkpoint from epoch **20**. The 1280-pixel run used AutoBatch target 60% (selected batch 4), 100 maximum epochs, patience 20, and seed 0. Test images remained outside optimization and checkpoint selection. The comparison's supported-zero F1 and empty-test-set handling were corrected; all 17 focused tests passed in the actual compute environment before training.

The [held-out comparison](./empire-ai-175644-comparison.md) and [machine-readable results](./empire-ai-175644-comparison.json) show the tuned model **underperformed** pretrained YOLO11s at identical fixed settings. Any-vehicle F1 was **0.8253 tuned versus 0.8996 pretrained**; image-count MAE was **2.8167 versus 2.35 vehicles/frame**. Every coarse-class F1 was worse. The candidate is **not promoted** and current runtime model selection is unchanged. This is a negative training result, not a failed GPU execution. The limited rare-class data and assisted training labels remain material limitations; there is no successful Tesla-classification or three-frame tracking-rule claim.

The [training record](./empire-ai-175644-training.json) and [actual batch script](./empire-ai-175644.sbatch) preserve run settings, source hashes, package versions, scheduler state, dataset hash and checkpoint hash. A post-training CUDA inference check returned `cuda:0`. The downloaded `best.pt` SHA-256 matches `43a2e7057f596a05241672be2834db3b37319ec4cfa8622115a8a5c6081c69ff`. Mert retrieved `best.pt`, `results.csv`, the last 30 job-log lines and comparison/provenance reports to a private local package, uploaded it to Mert's Binghamton Drive, verified reader-only access for Carter, and sent Carter the private link. No weights, raw images or credentials are committed. Both preflight and training allocations are released. The SSH login connection is preserved.
