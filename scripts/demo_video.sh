#!/usr/bin/env bash
# Өз видеоңыз жоқ болса — шаблонды тексеруге 30 с тест видео жасайды (градиент + тыныш тон).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FF="${FFMPEG:-ffmpeg}"
mkdir -p "$ROOT/work"
"$FF" -v error -y -f lavfi -i "gradients=s=1920x1080:d=30:speed=0.01:c0=0x1d3b3a:c1=0x6b4a2f:c2=0x0f2a2a,format=yuv420p" \
  -f lavfi -i "sine=f=180:d=30,volume=0.05" -shortest -c:v libx264 -crf 18 -c:a aac "$ROOT/work/demo.mp4"
echo "тест видео: $ROOT/work/demo.mp4 → scripts/prepare.sh work/demo.mp4"
