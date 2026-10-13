#!/usr/bin/env python3
"""Write tools/out/test-beat.wav: 90 seconds of a plain 120 BPM pattern (kicks, snares on 2 and 4, hats on
eighths) for feeding the page's "Play a song" button when checking the beat detection. Needs numpy."""
import pathlib
import wave
import numpy as np

sr, bpm, secs = 44100, 120, 90
n = sr * secs
t = np.arange(n) / sr
out = np.zeros(n)
beat = 60 / bpm
rng = np.random.default_rng(1)
k = 0
while k * beat < secs:
    i0 = int(k * beat * sr)
    L = int(0.22 * sr); tt = np.arange(L) / sr
    f = 45 + 105 * np.exp(-tt * 18)
    kick = np.sin(2 * np.pi * np.cumsum(f) / sr) * np.exp(-tt * 9) * 0.9
    if i0 + L <= n: out[i0:i0 + L] += kick
    if k % 2 == 1:
        L2 = int(0.14 * sr); tt2 = np.arange(L2) / sr
        sn = rng.standard_normal(L2) * np.exp(-tt2 * 22) * 0.45 + np.sin(2 * np.pi * 190 * tt2) * np.exp(-tt2 * 30) * 0.3
        if i0 + L2 <= n: out[i0:i0 + L2] += sn
    for h in (0, 0.5):
        ih = int((k * beat + h * beat) * sr); L3 = int(0.04 * sr); tt3 = np.arange(L3) / sr
        hat = rng.standard_normal(L3) * np.exp(-tt3 * 90) * 0.15
        if ih + L3 <= n: out[ih:ih + L3] += hat
    k += 1
out += 0.08 * np.sin(2 * np.pi * 55 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * t / 4))
out = np.clip(out / np.abs(out).max() * 0.95, -1, 1)
target = pathlib.Path(__file__).resolve().parent / 'out'
target.mkdir(exist_ok=True)
with wave.open(str(target / 'test-beat.wav'), 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((out * 32767).astype('<i2').tobytes())
print('wrote', target / 'test-beat.wav')
