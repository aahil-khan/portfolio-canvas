# Usage: <venv with numpy+soundfile>/python measure-takes.py <dir> <take name>... > lengths.json
# Syllable lengths of "Aahil" from the waveform: the h is where aspiration (2-6 kHz) peaks against voicing
# (100-900 Hz) in the middle of the word; "aa" runs from the voiced onset to the h's centre, "hil" from
# there to the offset. Onset and offset are where voiced-band (100-900 Hz) energy crosses 12% of its peak.
import sys, json, hashlib, numpy as np, soundfile as sf
d = sys.argv[1]; names = sys.argv[2:]
out = []
for n in names:
    t, sr = sf.read(f"{d}/{n}.wav"); f = int(.01 * sr); win = np.hanning(2 * f)
    fr = [t[i:i + 2 * f] * win for i in range(0, len(t) - 2 * f, f)]
    S = np.abs(np.fft.rfft(fr, axis=1)) ** 2; hz = np.fft.rfftfreq(2 * f, 1 / sr)
    hf = S[:, (hz > 2000) & (hz < 6000)].sum(1); lf = S[:, (hz > 100) & (hz < 900)].sum(1)
    sm = np.convolve(np.sqrt(lf), np.ones(3) / 3, mode="same")   # voiced-band energy: breath and rumble don't count
    on = np.where(sm > sm.max() * .12)[0]; a, b = int(on[0]), int(on[-1])
    r = np.convolve(hf / (lf + 1e-9), np.ones(3) / 3, mode="same")
    lo, hi = a + int((b - a) * .2), a + int((b - a) * .8)
    h = lo + int(np.argmax(r[lo:hi]))
    out.append(dict(name=n, aa=round((h - a) / 100, 3), hil=round((b - h) / 100, 3), ratio=round((h - a) / max(b - h, 1), 2),
                    h_strength=round(float(r[h] / (np.median(r[a:b]) + 1e-9)), 1), a=a, h=h, b=b, frames=len(fr),
                    md5=hashlib.md5(open(f"{d}/{n}.wav", "rb").read()).hexdigest()))
json.dump(out, sys.stdout, ensure_ascii=False)
