"""Synthesize narration lines with Kokoro (local, offline after the model download).

Usage:
  python -I tts.py --lines lines.json --out DIR --model-dir DIR [--lang en|zh] [--voice NAME] [--speed 1.0]

lines.json maps a cue key to the exact sentence (the same text is shown as the subtitle).
Writes DIR/<key>.wav for every line and DIR/durations.json with each clip's length in seconds.

Requires kokoro-onnx (and misaki[zh] for --lang zh) in the running Python, plus the model files
kokoro-v1.0.onnx and voices-v1.0.bin in --model-dir. This script never downloads anything.
"""
import argparse
import json
import os
import re

import soundfile as sf
from kokoro_onnx import Kokoro

LATIN = re.compile(r"[A-Za-z][A-Za-z' -]*[A-Za-z]|[A-Za-z]")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--lines', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--model-dir', required=True)
    parser.add_argument('--lang', choices=['en', 'zh'], default='en')
    parser.add_argument('--voice')
    parser.add_argument('--speed', type=float, default=1.0)
    args = parser.parse_args()

    kokoro = Kokoro(os.path.join(args.model_dir, 'kokoro-v1.0.onnx'), os.path.join(args.model_dir, 'voices-v1.0.bin'))
    voice = args.voice or ('zf_xiaoxiao' if args.lang == 'zh' else 'af_heart')
    lines = json.load(open(args.lines, encoding='utf8'))
    os.makedirs(args.out, exist_ok=True)

    if args.lang == 'zh':
        from misaki import zh
        zh_g2p = zh.ZHG2P()

        def phonemes(text):
            # Chinese runs use the zh G2P; Latin runs (product names, "AI") use the English phonemizer,
            # otherwise they are read letter by letter.
            out, pos = [], 0
            for match in LATIN.finditer(text):
                if match.start() > pos:
                    out.append(zh_g2p(text[pos:match.start()]))
                out.append(' ' + kokoro.tokenizer.phonemize(match.group(0), 'en-us').strip() + ' ')
                pos = match.end()
            if pos < len(text):
                out.append(zh_g2p(text[pos:]))
            return re.sub(r'\s+', ' ', ''.join(out)).strip()

    durations = {}
    for key, text in lines.items():
        if args.lang == 'zh':
            samples, rate = kokoro.create(phonemes(text), voice=voice, speed=args.speed, is_phonemes=True)
        else:
            samples, rate = kokoro.create(text, voice=voice, speed=args.speed, lang='en-us')
        sf.write(os.path.join(args.out, f'{key}.wav'), samples, rate)
        durations[key] = round(len(samples) / rate, 2)
    json.dump(durations, open(os.path.join(args.out, 'durations.json'), 'w'), indent=1)
    print(json.dumps(durations))


if __name__ == '__main__':
    main()
