# Usage: <tts venv>/python render-piper.py <dir of Piper .onnx models> <out dir>   (run through cx heavy)
# "Aahil" in Piper's free South-Asian male voices, each from its own script's spelling, at two lengths.
# Prints duration, median pitch (to confirm a male speaker) and the phonemes Piper used.
import os, sys, io, wave, json
import numpy as np, soundfile as sf
from piper import PiperVoice, SynthesisConfig
M, OUT = sys.argv[1], sys.argv[2]
VOICES = {  # spelling per script; length_scale 1.3-1.7, three tries each (Piper varies per call)
    "hi_IN-rohan-medium": {"dev": "आहिल", "devx": "आऽहिल"},
    "ml_IN-arjun-medium": {"mal": "ആഹിൽ"},
    "te_IN-venkatesh-medium": {"tel": "ఆహిల్"},
    "ur_PK-fasih-medium": {"ur": "عاہل", "ur2": "آہل"},
    "ne_NP-chitwan-medium": {"dev": "आहिल", "devx": "आऽहिल"},
}
def f0(t, sr):
    f = int(.04 * sr); vals = []
    for i in range(0, len(t) - f, f // 2):
        x = t[i:i + f]; x = x - x.mean()
        if np.sqrt(np.mean(x ** 2)) < .02: continue
        ac = np.correlate(x, x, "full")[f - 1:]; lo, hi = int(sr / 300), int(sr / 70)
        k = lo + int(np.argmax(ac[lo:hi])); vals.append(sr / k)
    return float(np.median(vals)) if vals else 0
rows = []
for name, inputs in VOICES.items():
    v = PiperVoice.load(os.path.join(M, name + ".onnx"))
    for key, txt in inputs.items():
        for ls in (1.3, 1.5, 1.7):
          for rep in range(4):
              b = io.BytesIO()
              with wave.open(b, "wb") as w:
                  al = v.synthesize_wav(txt, w, syn_config=SynthesisConfig(length_scale=ls), include_alignments=True)
              b.seek(0); a, sr = sf.read(b, dtype="float32")
              peak = float(np.max(np.abs(a))) or 1
              idx = np.where(np.abs(a) > peak * .01)[0]
              t = a[max(idx[0] - int(.03 * sr), 0):min(idx[-1] + int(.04 * sr), len(a))] * (.89 / peak)
              n = f"{name.split('-')[1]}-{key}-{int(ls * 100)}-{rep}"
              sf.write(os.path.join(OUT, n + ".wav"), t, sr)
              ph = v.phonemize(txt)
              rows.append(dict(name=n, voice=name, input=txt, ls=ls, dur=round(len(t) / sr, 3), f0=round(f0(t, sr)), phonemes="".join("".join(p) for p in ph)))
              print(json.dumps(rows[-1], ensure_ascii=False), flush=True)
json.dump(rows, open(os.path.join(OUT, "stats.json"), "w"), ensure_ascii=False, indent=1)
