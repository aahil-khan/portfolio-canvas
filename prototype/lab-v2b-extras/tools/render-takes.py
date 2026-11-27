# Usage: <tts venv>/python render-takes.py <tts dir with models/> <out dir>   (run through cx heavy)
# "Aahil" alone, aiming at AA-hil, in Kokoro's Hindi male voices and the US/UK male voices, from Devanagari,
# IPA and the spelling, at speed 1.0 and 0.9; peaks normalised. Its own aa/hil figures are a rough first pass
# (energy dip); the page's figures come from measure-takes.py, which finds the h by its aspiration.
import os, sys, json
import numpy as np, soundfile as sf
os.environ.setdefault("OMP_NUM_THREADS", "4")
T, OUT = sys.argv[1], sys.argv[2]
from kokoro_onnx import Kokoro
k = Kokoro(os.path.join(T, "models/kokoro-v1.0.onnx"), os.path.join(T, "models/voices-v1.0.bin"))
VOICES = ["hm_omega", "hm_psi", "am_michael", "am_adam", "am_puck", "am_fenrir", "am_liam", "am_onyx", "am_eric", "bm_george", "bm_lewis", "bm_daniel", "bm_fable"]
INPUTS = {  # key: (input, is_phonemes, lang, hindi-only / english-only)
    "dev": ("आहिल", False, "hi", "h"),       # Devanagari -> ˈaːhɪl
    "devx": ("आऽहिल", False, "hi", "h"),     # Devanagari with avagraha -> ˈaːːhɪl
    "lat": ("Aahil", False, "hi", "h"),      # Latin spelling through the Hindi phonemizer
    "txt": ("Aahil", False, None, "e"),      # Latin spelling, the voice's own English
    "a2": ("ˈaːːhɪl", True, None, "e"),      # open a, a little held
    "a3": ("ˈaːːːhɪl", True, None, ""),      # open a, held more
    "b2": ("ˈɑːːhɪl", True, None, ""),       # back a, a little held
}
def measure(t, sr):
    f = int(.01 * sr)
    rms = np.array([np.sqrt(np.mean(t[i:i + f] ** 2)) for i in range(0, len(t) - f, f)])
    sm = np.convolve(rms, np.ones(3) / 3, mode="same")
    on = np.where(sm > sm.max() * 0.06)[0]
    a, b = on[0], on[-1]
    lo, hi = a + int((b - a) * .25), a + int((b - a) * .8)
    dip = lo + int(np.argmin(sm[lo:hi]))
    pk = a + int(np.argmax(sm[a:dip])) if dip > a else a
    thr = (sm[pk] + sm[dip]) / 2
    edge = pk
    while edge < dip and sm[edge] > thr: edge += 1
    depth = float(sm[dip] / sm[pk]) if sm[pk] else 1
    return dict(aa=round((edge - a) / 100, 3), hil=round((b - edge) / 100, 3), dip=round(depth, 2))
rows = []
for v in VOICES:
    for key, (txt, isph, lang, _o) in INPUTS.items():
      only = INPUTS[key][3]
      if (only == "h" and not v.startswith("h")) or (only == "e" and v.startswith("h")): continue
      for sp in (1.0, 0.9):
        kw = dict(voice=v, speed=sp, is_phonemes=isph)
        if not isph: kw["lang"] = lang or ("en-gb" if v.startswith("b") else "en-us")
        a, sr = k.create(txt, **kw)
        a = np.asarray(a, dtype=np.float32)
        peak = float(np.max(np.abs(a))) or 1.0
        idx = np.where(np.abs(a) > peak * 0.01)[0]
        t = a[max(idx[0] - int(.03 * sr), 0):min(idx[-1] + int(.04 * sr), len(a))]
        t = t * (0.89 / peak)   # float output: normalise the peak, nothing clips
        m = measure(t, sr)
        name = f"{v}-{key}-{int(sp*100)}"
        sf.write(os.path.join(OUT, name + ".wav"), t, sr)
        rows.append(dict(name=name, voice=v, input=key, speed=sp, text=txt, dur=round(len(t) / sr, 3), peak=round(peak, 3), clip=int(np.sum(np.abs(t) >= .99)), **m))
        r = rows[-1]; print(f"{name:22s} dur {r['dur']:.2f}  aa {r['aa']:.2f}  hil {r['hil']:.2f}  ratio {r['aa']/max(r['hil'],.01):.2f}  dip {r['dip']}  clip {r['clip']}", flush=True)
json.dump(rows, open(os.path.join(OUT, "stats.json"), "w"), ensure_ascii=False, indent=1)
