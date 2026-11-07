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
