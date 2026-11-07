#!/bin/bash
# Mert: submit from ~/emission-lens after a reviewed dataset is built.
# Uses the Python/CUDA environment verified on an allocated compute node.
# Set EMISSION_LENS_DATA_YAML / EMISSION_LENS_WEIGHTS privately if paths differ.
# Do not put account passwords, tokens or scratch codes in this script.
#SBATCH --partition=alpha
#SBATCH --account=rpicourse
#SBATCH --qos=normal
#SBATCH --reservation=binghamton_hackathon
#SBATCH --gres=gpu:1g.10gb:1
#SBATCH --cpus-per-task=1
#SBATCH --mem=32G
#SBATCH --time=04:00:00
#SBATCH --job-name=emission-lens-train
#SBATCH --output=emission-lens-train-%j.out

set -euo pipefail
cd "${SLURM_SUBMIT_DIR:?Submit from the repository root}"
source "${EMISSION_LENS_VENV:-$HOME/emission-lens-py312}/bin/activate"
training_data="${EMISSION_LENS_DATA_YAML:-$HOME/emission-lens-data/data.yaml}"
training_weights="${EMISSION_LENS_WEIGHTS:-$HOME/emission-lens/weights/yolo11s.pt}"
if [[ ! -f "$training_data" || ! -f "$training_weights" ]]; then
  printf '%s\n' 'Reviewed dataset YAML and pretrained weights must already exist.' >&2
  exit 1
fi
python -c "import torch; assert torch.cuda.is_available(), 'Allocate a GPU before training'; print('GPU:', torch.cuda.get_device_name(0))"
# AutoBatch targets 60% of the allocated slice rather than assuming batch 8 fits.
# Test frames remain held out; train/val splits are used during training.
yolo detect train \
  model="$training_weights" data="$training_data" device=0 \
  epochs=100 patience=20 imgsz=1280 batch=0.6 \
  workers=1 cache=False seed=0 deterministic=True save_period=10 plots=False \
  project="$HOME/emission-lens-runs" name="train-${SLURM_JOB_ID:?}" exist_ok=False
# Keep best.pt as a candidate. Held-out comparison must pass before promotion.
