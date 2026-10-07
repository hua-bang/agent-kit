"""Synthesize an original, unobtrusive music bed (no samples, no licensed material).

Usage:
  python -I music.py --seconds 92.5 --out music.wav [--bpm 104]

I–vi–IV–V in C: a soft detuned pad, a quiet plucked arpeggio and light drums from the second bar,
with a fade in and out. Requires numpy and soundfile.
"""
import argparse

import numpy as np
import soundfile as sf

SR = 44100


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--seconds', type=float, required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--bpm', type=float, default=104)
    args = parser.parse_args()

    seconds, beat = args.seconds, 60 / args.bpm
    n = int(SR * seconds)
    t = np.arange(n) / SR
    mix = np.zeros((n, 2))
    rng = np.random.default_rng(7)
    note = lambda m: 440 * 2 ** ((m - 69) / 12)
    chords = [[48, 60, 64, 67], [45, 57, 60, 64], [41, 57, 60, 65], [43, 55, 59, 62]]  # C, Am, F, G
    bar = 4 * beat

    def add(sig, start, pan=0.0, gain=1.0):
        i = int(start * SR)
        if i >= n:
            return
        sig = sig[: n - i] * gain
        mix[i:i + len(sig), 0] += sig * (1 - pan)
        mix[i:i + len(sig), 1] += sig * (1 + pan)

    for b in range(int(seconds / bar) + 1):
        root, *tones = chords[b % 4]
        start = b * bar
        tt = np.arange(int(bar * SR)) / SR
        env = np.minimum(1, tt / 0.6) * np.minimum(1, (bar - tt) / 0.5)
        pad = sum(np.sin(2 * np.pi * note(m) * d * tt) for m in tones for d in (0.998, 1.002)) / 8
        add(pad * env, start, 0, 0.2)
        add(np.sin(2 * np.pi * note(root - 12) * tt) * np.exp(-tt * 1.2), start, 0, 0.22)
        seq = tones + tones[1:][::-1] + tones[:2]
        for k in range(8):
            f = note(seq[k % len(seq)] + 12)
            pl = np.arange(int(0.6 * SR)) / SR
            pluck = (np.sin(2 * np.pi * f * pl) + 0.3 * np.sin(4 * np.pi * f * pl)) * np.exp(-pl * 4)
            add(pluck, start + k * beat / 2, -0.4 if k % 2 else 0.4, 0.045)
        if b >= 1:
            for k in range(4):
                if k % 2 == 0:
                    kt = np.arange(int(0.25 * SR)) / SR
                    add(np.sin(2 * np.pi * (50 + 90 * np.exp(-kt * 30)) * kt) * np.exp(-kt * 12), start + k * beat, 0, 0.2)
                ht = np.arange(int(0.05 * SR)) / SR
                add(np.diff(rng.standard_normal(len(ht) + 1)) * np.exp(-ht * 90), start + k * beat + beat / 2, 0.2, 0.012)

    mix *= np.minimum(1, np.minimum(t / 1.5, (seconds - t) / 2.5))[:, None]
    mix /= np.max(np.abs(mix)) * 1.12
    sf.write(args.out, mix, SR)
    print(f'{seconds:.1f}s written to {args.out}')


if __name__ == '__main__':
    main()
