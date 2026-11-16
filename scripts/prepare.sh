#!/usr/bin/env bash
# Видеоны Remotion-ға дайындау:
#   1) 2560×1440 прокси (камера 1.26× дейін зумдағанда да анық) → template/public/base.mp4
#   2) дауыс жолы 48 кГц 16-bit WAV → work/voice.wav (микс үшін) + 16 кГц → work/voice_stt.wav (Whisper үшін)
#   3) видео ұзақтығын шығарады — timeline.json "duration"-ға жазыңыз
# Қолдану: scripts/prepare.sh /path/to/video.mov
set -euo pipefail
SRC="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FF="${FFMPEG:-ffmpeg}"
mkdir -p "$ROOT/work" "$ROOT/template/public"
"$FF" -v error -y -i "$SRC" -an -vf "scale=2560:1440:flags=lanczos,format=yuv420p" \
  -c:v libx264 -crf 14 -preset fast -g 24 -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  "$ROOT/template/public/base.mp4"
"$FF" -v error -y -i "$SRC" -vn -ac 2 -ar 48000 -c:a pcm_s16le "$ROOT/work/voice.wav"
"$FF" -v error -y -i "$SRC" -vn -ac 1 -ar 16000 -c:a pcm_s16le "$ROOT/work/voice_stt.wav"
DUR=$( ("$FF" -i "$ROOT/template/public/base.mp4" 2>&1 || true) | sed -n 's/.*Duration: \([0-9:.]*\).*/\1/p' | awk -F: '{printf "%.2f", $1*3600+$2*60+$3}')
echo "base.mp4 дайын. Видео ұзақтығы: ${DUR} с → timeline.json \"duration\": ${DUR}"
