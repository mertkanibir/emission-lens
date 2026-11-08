#!/bin/bash
# Mert's isolated one-slice replay acceptance; review paths/ports before submission.
#SBATCH --partition=alpha
#SBATCH --account=rpicourse
#SBATCH --qos=normal
#SBATCH --reservation=binghamton_hackathon
#SBATCH --gres=gpu:1g.10gb:1
#SBATCH --cpus-per-task=1
#SBATCH --mem=8G
#SBATCH --time=00:05:00
#SBATCH --signal=B:TERM@60
#SBATCH --job-name=222-reliability
#SBATCH --output=slurm-%j.out
set -euo pipefail
umask 077
cd "${SLURM_SUBMIT_DIR:?Submit only from the isolated frozen runtime}"
source /mnt/home/student032/emission-lens-py312/bin/activate
trap 'rm -f token.private' EXIT
python evaluation/reliability/replay.py &
replay_driver_pid=$!
stop_replay() {
  kill -TERM "$replay_driver_pid" 2>/dev/null || true
  wait "$replay_driver_pid" || true
  exit 143
}
trap stop_replay TERM INT
wait "$replay_driver_pid"
