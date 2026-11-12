"""Bursr launch film soundtrack, composed in code (all original, no samples).

120 BPM, 4/4, 10 bars of 2 s = 20 s. Every musical hit and sound effect is
placed on the storyboard's beat grid (one beat = 0.5 s). Writes:
  audio/music.wav   the stems mixed, before loudness normalisation
  audio/hits.json   every event time, for checking against the picture
"""
import json
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
DUR = 20.0
N = int(SR * DUR)
BEAT = 0.5
rng = np.random.default_rng(7)
mix = np.zeros((N, 2))
hits = []


def t_arr(sec):
    return np.arange(int(SR * sec)) / SR


def place(sig, at, gain=1.0, pan=0.0, peak=None):
    """Adds a mono or stereo signal so that its loudest sample (or its start) lands at `at` seconds."""
    if sig.ndim == 1:
        l, r = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
        sig = np.stack([sig * l * 1.414, sig * r * 1.414], axis=1)
    offset = int(np.argmax(np.abs(sig).sum(axis=1))) if peak else 0
    start = int(at * SR) - offset
    a, b = max(0, start), min(N, start + len(sig))
    if b > a:
        mix[a:b] += gain * sig[a - start : b - start]


def lp(x, hz, order=2):
    return sosfilt(butter(order, min(hz, SR / 2 - 100), "low", fs=SR, output="sos"), x)


def hp(x, hz, order=2):
    return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def note(n):
    """MIDI note number to Hz."""
    return 440.0 * 2 ** ((n - 69) / 12)


def saw(f, t):
    return 2 * ((t * f) % 1.0) - 1


# --- Instruments ---------------------------------------------------------------


def kick(gain=1.0):
    t = t_arr(0.45)
    f = 48 + 110 * np.exp(-t * 28)
    phase = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(phase) * np.exp(-t * 7.5)
    click = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 300) * 0.25
    return (body + click) * gain


def clap():
    t = t_arr(0.25)
    env = np.exp(-t * 22) + 0.6 * np.exp(-((t - 0.012) ** 2) / 1e-5) + 0.5 * np.exp(-((t - 0.024) ** 2) / 1e-5)
    return bp(rng.standard_normal(len(t)), 900, 5000) * env * 0.5


def hat(open_=False):
    t = t_arr(0.18 if open_ else 0.06)
    return hp(rng.standard_normal(len(t)), 7000, 4) * np.exp(-t * (18 if open_ else 70)) * 0.32


def pluck(n, gain=0.5):
    t = t_arr(0.9)
    f = note(n)
    tone = saw(f, t) + 0.5 * saw(f * 1.005, t)
    return lp(tone, 4200, 2) * np.exp(-t * 6.5) * gain


def bell(n, gain=0.25):
    t = t_arr(1.2)
    f = note(n)
    tone = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 6)
    return tone * np.exp(-t * 3.5) * np.minimum(1, t * 400) * gain


def pad(notes, sec, cutoff, gain=0.16):
    t = t_arr(sec)
    sig = np.zeros(len(t))
    for n in notes:
        for d in (-0.08, 0.0, 0.08):
            sig += saw(note(n + d), t)
    sig = lp(sig / (3 * len(notes)), cutoff, 2)
    att = np.minimum(1, t / 0.6)
    rel = np.minimum(1, (sec - t) / 0.5)
    return sig * att * rel * gain


def sub_note(n, sec, gain=0.5):
    t = t_arr(sec)
    f = note(n)
    sig = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)
    return lp(sig, 260) * np.minimum(1, t * 80) * np.minimum(1, (sec - t) * 60) * gain


def tick(gain=0.12):
    t = t_arr(0.03)
    return hp(rng.standard_normal(len(t)), 3500) * np.exp(-t * 220) * gain


def click(gain=0.4):
    t = t_arr(0.05)
    tone = np.sin(2 * np.pi * 1900 * t) * np.exp(-t * 160)
    return (tone + hp(rng.standard_normal(len(t)), 4000) * np.exp(-t * 400) * 0.4) * gain


def whoosh(sec=0.7, lo=300, hi=6000, gain=0.35):
    """Noise that swells to a peak at its end, then dies quickly; place it by peak."""
    t = t_arr(sec + 0.25)
    rise = np.where(t < sec, (t / sec) ** 3, np.exp(-(t - sec) * 18))
    sig = bp(rng.standard_normal(len(t)), lo, hi, 2)
    return sig * rise * gain


# --- Arrangement (beats in seconds) ---------------------------------------------
A, C, E, F, G = 57, 60, 64, 53, 55  # A3 C4 E4 F3 G3

# Bars 1–2: filtered pad and plucks; the hook words land on the beats.
place(pad([A, C, E, A + 12], 4.0, 1200, 0.14), 0.0)
for i, n in enumerate([A + 12, C + 12, E + 12, A + 24]):
    place(pluck(n, 0.42), i * BEAT, pan=(-0.25 + i * 0.17))
    hits.append(("hook word", i * BEAT))
# Bar 2: softer plucks, typing ticks on the eighths (2.0–3.0), click on 3.5.
for i, n in enumerate([E + 12, C + 12]):
    place(pluck(n, 0.25), 2.0 + i * 1.0, pan=0.2)
for k in range(8):
    place(tick(0.10), 2.0 + k * 0.125 + rng.uniform(0, 0.012), pan=0.3)
place(click(0.42), 3.5, peak=True)
hits.append(("cursor click", 3.5))
# Riser through bar 2, cut at the drop.
t = t_arr(2.0)
riser = hp(rng.standard_normal(len(t)), 800) * (t / 2.0) ** 2.2 * 0.22
riser += np.sin(2 * np.pi * np.cumsum(220 + 660 * (t / 2.0) ** 2) / SR) * (t / 2.0) ** 2 * 0.08
place(riser, 2.0)

# The drop at 4.0: boom, airy swell peaking on the beat.
boom_t = t_arr(1.4)
place(np.sin(2 * np.pi * np.cumsum(70 * np.exp(-boom_t * 2) + 38) / SR) * np.exp(-boom_t * 2.4) * 0.55, 4.0)
place(whoosh(0.9, 400, 8000, 0.28), 4.0, peak=True)
hits.append(("drop", 4.0))

# Bars 3–8 (4.0–16.0): the groove. Chords per bar: Am F C G (repeat).
roots = [A - 24, F - 24 + 12, C - 24, G - 24 + 12]
chords = [[A, C, E], [F, A, C + 12], [C, E, G], [G, 59, 62]]
for bar in range(6):
    t0 = 4.0 + bar * 2.0
    place(pad(chords[bar % 4], 2.0, 2600, 0.08), t0)
    for b in range(4):
        tb = t0 + b * BEAT
        if not (bar == 5 and b == 3):
            place(kick(1.0), tb)
        # Sub bass on the offbeat, ducked under the kick.
        place(sub_note(roots[bar % 4], 0.22, 0.42), tb + 0.25)
        if b in (1, 3):
            place(clap(), tb, pan=0.05)
        # Hats on the offbeats; bar 8 (the ticker) thins out.
        if bar < 5 or b % 2 == 0:
            place(hat(open_=(b == 3)), tb + 0.25, pan=-0.2)
            if bar < 5:
                place(hat(), tb + 0.125, gain=0.5, pan=0.25)

# Bar 3: winners chime on 4.5, 5.0, 5.5.
for i, n in enumerate([88, 91, 95]):  # E6 G6 B6
    place(bell(n, 0.16), 4.5 + i * 0.5, pan=(-0.3 + i * 0.3))
    hits.append(("winner", 4.5 + i * 0.5))
# Bar 4: accent on 7.0 (the amount).
place(whoosh(0.45, 2000, 9000, 0.16), 7.0, peak=True)
place(bell(81, 0.14), 7.0)
hits.append(("amount", 7.0))
# Bar 5: the whip lands on 10.0.
place(whoosh(0.5, 600, 7000, 0.4), 10.0, peak=True, pan=-0.2)
hits.append(("whip lands", 10.0))
# Bar 6: the panel flips on 11.0, confirmation on 11.5.
place(whoosh(0.22, 1500, 6000, 0.18), 11.0, peak=True, pan=0.3)
place(bell(84, 0.18), 11.5)
place(bell(91, 0.14), 11.62)
hits += [("flip", 11.0), ("received", 11.5)]
# Bar 7: push cuts on every beat.
for k in range(4):
    place(whoosh(0.16, 3000, 9000, 0.10), 12.0 + k * 0.5, peak=True)
    hits.append(("stat cut", 12.0 + k * 0.5))
# Bar 8: ticker words.
for k in range(3):
    place(tick(0.16), 14.0 + k * 0.5)
    hits.append(("ticker word", 14.0 + k * 0.5))

# Bars 9–10: kick out, warm chord, three notes on the payee dots, decaying tail.
place(pad([A - 12, A, C + 12, E + 12, 71], 4.0, 1800, 0.2), 16.0)
place(sub_note(A - 24, 3.5, 0.32), 16.0)
for i, n in enumerate([76, 79, 83]):  # E5 G5 B5
    place(bell(n, 0.18), 17.0 + i * 0.25, pan=(-0.25 + i * 0.25))
    hits.append(("payee dot", 17.0 + i * 0.25))
hits.append(("logo tile", 16.0))

# Master: gentle glue and a final fade so the tail reaches silence at 20.0.
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
fade = np.ones(N)
f0 = int(18.0 * SR)
fade[f0:] = np.linspace(1, 0, N - f0) ** 1.6
mix *= fade[:, None]
mix /= max(1e-9, np.abs(mix).max()) / 0.89
wavfile.write("audio/music.wav", SR, (mix * 32767).astype(np.int16))
json.dump(sorted(hits, key=lambda h: h[1]), open("audio/hits.json", "w"), indent=1)
print(f"wrote audio/music.wav ({DUR}s) and {len(hits)} hit times")
