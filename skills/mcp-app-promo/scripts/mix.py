"""Combine a silent screen recording, narration clips and a music bed into an MP4.

Usage:
  python3 mix.py --video promo.webm --cues cues.json --voice-dir DIR --music music.wav --out promo.mp4 [--lead 0.5]

cues.json maps each narration key to the second (from the start of the recording) at which it was
spoken; DIR/<key>.wav holds the clip. --lead trims that many seconds of page load from the start of
the video and shifts every cue by the same amount. The music is ducked under the voice with a
sidechain compressor, then the result is limited. Requires ffmpeg with libx264 and aac on PATH.
"""
import argparse
import json
import subprocess


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--video', required=True)
    parser.add_argument('--cues', required=True)
    parser.add_argument('--voice-dir', required=True)
    parser.add_argument('--music', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--lead', type=float, default=0.5)
    parser.add_argument('--music-volume', type=float, default=0.32)
    parser.add_argument('--voice-volume', type=float, default=1.5)
    args = parser.parse_args()

    cues = json.load(open(args.cues))
    cmd = ['ffmpeg', '-v', 'error', '-y', '-ss', str(args.lead), '-i', args.video, '-i', args.music]
    filters = []
    for i, (key, t) in enumerate(cues.items()):
        cmd += ['-i', f'{args.voice_dir}/{key}.wav']
        delay = max(0, int((t - args.lead) * 1000))
        filters.append(f'[{i + 2}:a]aresample=44100,aformat=channel_layouts=stereo,adelay={delay}:all=1[v{i}]')
    voices = ''.join(f'[v{i}]' for i in range(len(cues)))
    filters += [
        f'{voices}amix=inputs={len(cues)}:normalize=0,volume={args.voice_volume},apad,asplit=2[voice][key]',
        f'[1:a]aecho=0.8:0.6:90|180:0.25|0.12,volume={args.music_volume}[bed]',
        '[bed][key]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=400[ducked]',
        '[ducked][voice]amix=inputs=2:normalize=0,alimiter=limit=0.9[aout]',
    ]
    cmd += ['-filter_complex', ';'.join(filters), '-map', '0:v', '-map', '[aout]', '-shortest',
            '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', args.out]
    subprocess.run(cmd, check=True)
    print(f'wrote {args.out}')


if __name__ == '__main__':
    main()
