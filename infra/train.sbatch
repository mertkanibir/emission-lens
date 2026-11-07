#!/bin/bash
# Fine-tune YOLO on the Emission Lens dataset with the hackathon's Empire AI reservation.
#
# Once, on the login node (it has internet; compute nodes may not):
#   mkdir -p ~/emission-lens-data && unzip dataset.zip -d ~/emission-lens-data
#   python3 -m venv ~/el-venv && source ~/el-venv/bin/activate
#   pip install ultralytics==8.4.206
#   cd ~ && python -c "from ultralytics import YOLO; YOLO('yolo11s.pt')"
#
# Then, from the home folder that holds yolo11s.pt:
#   sbatch train.sbatch
#   squeue --me
#   tail -f emission-lens-train-<jobid>.out
#
# Best weights land in ~/emission-lens-runs/yolo11s-1280/weights/best.pt.
# If the job hits its time limit, rerun the train line with model=.../weights/last.pt resume=True.

#SBATCH -p alpha
#SBATCH --reservation=binghamton_hackathon
#SBATCH --gres=gpu:1g.10gb:1
#SBATCH -c 1
#SBATCH --mem=32G
#SBATCH -t 04:00:00
#SBATCH -J emission-lens-train
#SBATCH -o %x-%j.out

set -euo pipefail

nvidia-smi -L
source ~/el-venv/bin/activate
python -c "import torch; assert torch.cuda.is_available(), 'no GPU visible'; print('GPU:', torch.cuda.get_device_name(0))"

# imgsz=1280 keeps full camera detail for small, distant vehicles.
# workers=1 matches the single CPU core; cache=ram decodes each image once.
yolo detect train \
  model=yolo11s.pt \
  data="$HOME/emission-lens-data/data.yaml" \
  epochs=100 patience=20 imgsz=1280 batch=8 \
  workers=1 cache=ram save_period=10 \
  project="$HOME/emission-lens-runs" name=yolo11s-1280 exist_ok=True
