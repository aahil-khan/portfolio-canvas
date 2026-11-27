# Usage: <venv with numpy+soundfile>/python score-takes.py <dir> <lengths.json from measure-takes.py> > scores.json
# Round 4: is the stress on "aa"? For each take, the median pitch (autocorrelation, 70-250 Hz, male range) and the
# loudness (voiced-band RMS) of each syllable, between the frames measure-takes.py found (a: onset, h: the h, b:
# offset). "ah-HILL" shows as hil louder or higher than aa; "aaa hil" keeps aa at least level with hil.
import sys, json, numpy as np, soundfile as sf
d, lengths = sys.argv[1], json.load(open(sys.argv[2]))
def f0(x, sr):
    x = x - x.mean()
    if np.sqrt(np.mean(x ** 2)) < 1e-3: return None
    c = np.correlate(x, x, "full")[len(x) - 1:]
    lo, hi = int(sr / 250), int(sr / 70)
    if hi >= len(c): return None
    lag = lo + int(np.argmax(c[lo:hi]))
    return sr / lag if c[lag] > 0.3 * c[0] else None
out = []
for m in lengths:
    t, sr = sf.read(f"{d}/{m['name']}.wav"); f = int(.01 * sr)
    def seg(i0, i1):
        ps = [f0(t[i * f:i * f + 4 * f], sr) for i in range(i0, max(i0 + 1, i1 - 3))]
        ps = [p for p in ps if p]
        rms = float(np.sqrt(np.mean(t[i0 * f:i1 * f] ** 2))) if i1 > i0 else 0.0
        return (float(np.median(ps)) if ps else None), rms
    pa, ra = seg(m["a"], m["h"]); ph, rh = seg(m["h"] + 3, m["b"])   # skip the h itself in hil's pitch
    out.append(dict(m, f0_aa=round(pa or 0, 1), f0_hil=round(ph or 0, 1), rms_aa=round(ra, 4), rms_hil=round(rh, 4),
                    pitch_up=round((ph or 0) / (pa or 1), 2), loud_up=round(rh / (ra or 1), 2)))
json.dump(out, sys.stdout, ensure_ascii=False)
