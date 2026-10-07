#!/usr/bin/env bash
# Regenerate the Agentic Excalidraw promo: showcase screenshots, narrated videos (en, zh) and the static site.
#
# Run from plugins/excalidraw after `npm ci && npm run build`. Writes only to $OUT (default promo/out, git-ignored).
# Needs ffmpeg/ffprobe (libx264, aac), Chromium for Playwright (PLAYWRIGHT_CHROMIUM_EXECUTABLE to use an existing
# one), and a Python with kokoro-onnx, misaki[zh], numpy and soundfile:
#   TTS_PYTHON=/path/to/venv/bin/python  KOKORO_DIR=/dir/with/kokoro-v1.0.onnx+voices-v1.0.bin  bash promo/make.sh
# Nothing is downloaded, installed or deployed by this script; the site's fonts load from Google Fonts at view time.
set -euo pipefail

: "${TTS_PYTHON:?Set TTS_PYTHON to a Python that has kokoro-onnx, misaki[zh], numpy and soundfile}"
: "${KOKORO_DIR:?Set KOKORO_DIR to the folder with kokoro-v1.0.onnx and voices-v1.0.bin}"
OUT=${OUT:-promo/out}
TOOLS=promo/scripts
LEAD=0.5 # seconds of page load trimmed from the start of each recording
[ -f dist/server/index.js ] || { echo 'Build the plugin first: npm run build' >&2; exit 1; }
mkdir -p "$OUT"

echo '1/5 Showcase drawings, written through the plugin tools and captured in the real editor'
node promo/gallery.mjs "$OUT/gallery-zh"
node promo/gallery.mjs "$OUT/gallery-en" en

echo '2/5 Cover crops for the title and end cards and the site hero'
for lang in zh en; do
  mkdir -p "$OUT/cover-$lang"
  ffmpeg -v error -y -i "$OUT/gallery-$lang/case-1.png" -vf "crop=2240:1040:480:540" "$OUT/cover-$lang/pr.png"
  ffmpeg -v error -y -i "$OUT/gallery-$lang/case-4.png" -vf "crop=2560:1560:340:330" "$OUT/cover-$lang/book.png"
done

echo '3/5 Narration'
"$TTS_PYTHON" -I "$TOOLS/tts.py" --lines promo/lines-en.json --out "$OUT/voice-en" --model-dir "$KOKORO_DIR" --lang en --voice af_heart --speed 1.05
"$TTS_PYTHON" -I "$TOOLS/tts.py" --lines promo/lines-zh.json --out "$OUT/voice-zh" --model-dir "$KOKORO_DIR" --lang zh --voice zf_xiaoxiao

echo '4/5 Recordings, music and mix'
for lang in en zh; do
  rm -rf "$OUT/rec-$lang"
  COVER_DIR="$OUT/cover-$lang" node "promo/record-$lang.mjs" "$OUT/rec-$lang" "$OUT/voice-$lang/durations.json" "promo/lines-$lang.json"
  length=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/rec-$lang/promo.webm")
  "$TTS_PYTHON" -I "$TOOLS/music.py" --seconds "$(python3 -c "print(round($length - $LEAD, 2))")" --out "$OUT/rec-$lang/music.wav"
  mkdir -p "$OUT/assets-$lang"
  python3 "$TOOLS/mix.py" --video "$OUT/rec-$lang/promo.webm" --cues "$OUT/rec-$lang/cues.json" --voice-dir "$OUT/voice-$lang" \
    --music "$OUT/rec-$lang/music.wav" --lead "$LEAD" --out "$OUT/assets-$lang/promo.mp4"
done

echo '5/5 Site'
for lang in en zh; do
  for i in 1 2 3 4; do # Crop the editor chrome; keep the drawing.
    ffmpeg -v error -y -i "$OUT/gallery-$lang/case-$i.png" -vf "crop=3200:1600:0:285,scale=2000:-1" -q:v 3 "$OUT/assets-$lang/case-$i.jpg"
  done
  ffmpeg -v error -y -i "$OUT/cover-$lang/pr.png" -vf scale=1400:-1 -q:v 3 "$OUT/assets-$lang/hero.jpg"
  poster=$(python3 -c "import json; print(json.load(open('$OUT/rec-$lang/cues.json'))['s2'] - $LEAD + 1.5)") # the first card in the chat
  ffmpeg -v error -y -ss "$poster" -i "$OUT/assets-$lang/promo.mp4" -frames:v 1 -q:v 2 "$OUT/assets-$lang/poster.jpg"
done
rm -rf "$OUT/dist"
python3 "$TOOLS/build_site.py" --page promo/site/zh.html --assets "$OUT/assets-zh" --out "$OUT/dist" --lang zh-CN
python3 "$TOOLS/build_site.py" --page promo/site/en.html --assets "$OUT/assets-en" --out "$OUT/dist/en" --lang en

echo "Done. Videos: $OUT/assets-*/promo.mp4  Site: $OUT/dist (zh at /, en at /en/)"
echo "Deploying is a separate, explicit step; see promo/README.md (Cloudflare Pages)."
