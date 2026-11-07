#!/bin/bash
#SBATCH --partition=alpha
#SBATCH --account=rpicourse
#SBATCH --qos=normal
#SBATCH --reservation=binghamton_hackathon
#SBATCH --gres=gpu:1g.10gb:1
#SBATCH --cpus-per-task=1
#SBATCH --mem=8G
#SBATCH --time=00:15:00
#SBATCH --job-name=emission-lens
#SBATCH --output=emission-lens-%j.out

# Mert's verified hackathon allocation; submit from the repository root.
# Set endpoint/token in the private shell environment, never in this file.
set -euo pipefail
cd "${SLURM_SUBMIT_DIR:?Submit from the repository root}"
source "${EMISSION_LENS_VENV:-$HOME/emission-lens-py312}/bin/activate"
python -m worker.main --require-cuda --device 0 --seconds 300 \
  --output "runs/worker-${SLURM_JOB_ID}.json" "$@"
