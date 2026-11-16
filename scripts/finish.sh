#!/usr/bin/env bash
# Рендерленген дыбыссыз видео + immersive микс → дайын MP4.
# Қолдану: scripts/finish.sh out/final.mp4
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FF="${FFMPEG:-ffmpeg}"
OUT="${1:-$ROOT/out/final.mp4}"
mkdir -p "$(dirname "$OUT")"
python3 "$ROOT/scripts/immersive.py" "$ROOT/template/src/timeline.json" "$ROOT/work/voice.wav" "$ROOT/work/mix.wav"
"$FF" -v error -y -i "$ROOT/template/out/video_noaudio.mp4" -i "$ROOT/work/mix.wav" \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -shortest -movflags +faststart "$OUT"
echo "дайын: $OUT"
