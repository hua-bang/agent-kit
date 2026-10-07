# mcp-app-promo

Skill for making a narrated promo video and a landing page for an MCP Apps plugin from real recordings, ready for Cloudflare Pages. Instructions: [SKILL.md](SKILL.md). Worked example: [plugins/excalidraw/promo](../../plugins/excalidraw/promo/README.md).

## Scripts and requirements

| Script | Needs | Writes |
| --- | --- | --- |
| `scripts/tts.py` | Python with `kokoro-onnx` (MIT), `soundfile`; `misaki[zh]` (Apache-2.0) for Chinese; the Kokoro v1.0 model files (`kokoro-v1.0.onnx`, `voices-v1.0.bin`, Apache-2.0 weights) | `<out>/<key>.wav`, `<out>/durations.json` |
| `scripts/music.py` | `numpy`, `soundfile` | one WAV |
| `scripts/mix.py` | `ffmpeg` with libx264 and aac | one MP4 |
| `scripts/build_site.py` | Python standard library | `<out>/index.html` plus copied media |

None of the scripts downloads, installs or uploads anything. Install the Python packages in a separate virtualenv, for example:

```sh
python3 -m venv .venv-tts && .venv-tts/bin/pip install kokoro-onnx soundfile "misaki[zh]"
# model files (about 340 MB): https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
```

`kokoro-onnx` phonemizes English through espeak-ng (GPL-3.0), which `espeakng-loader` installs into that virtualenv. It is only run locally; nothing from it is copied into this repository or the output.

## Verification

The scripts have no unit tests. They were verified end to end by `plugins/excalidraw/promo/make.sh`, which runs all four on the real plugin and checks the results by eye (contact sheets, frame strips, loudness). `python3 -m py_compile scripts/*.py` checks syntax without the dependencies.
