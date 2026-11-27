# Usage: <tts venv>/python render-takes.py <tts dir with models/> <out dir>   (run through cx heavy)
# Round 4: "Aahil" alone, as "aaa hil" (two syllables about equal, stress on the first, never ah-HILL), in
# Kokoro-82M's American (am_*) and British (bm_*) male voices. Each voice reads a set of phoneme strings and two
# spellings at four speeds; peaks are normalised to 0.89 so nothing clips. The aa/hil figures come afterwards from
# measure-takes.py, which finds the h by its aspiration.
import os, sys, json
import numpy as np, soundfile as sf
os.environ.setdefault("OMP_NUM_THREADS", "4")
T, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
from kokoro_onnx import Kokoro
k = Kokoro(os.path.join(T, "models/kokoro-v1.0.onnx"), os.path.join(T, "models/voices-v1.0.bin"))
VOICES = ["am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam", "am_michael", "am_onyx", "am_puck",
          "bm_daniel", "bm_fable", "bm_george", "bm_lewis"]   # am_santa left out: a novelty voice
INPUTS = {  # key: (input, is_phonemes)
    "p1": ("ˈɑːhɪl", True),        # back aa, plain
    "p2": ("ˈɑːːhɪl", True),       # back aa, held
    "p3": ("ˈɑːˌhɪl", True),       # back aa, a secondary stress keeps hil from shrinking
    "p4": ("ˈɑːːˌhɪl", True),      # held, and the secondary stress
    "p5": ("ˈaːhɪl", True),        # open front a
    "p6": ("ˈaːːhɪl", True),       # open front a, held
    "p7": ("ˈaːˌhɪl", True),
    "p8": ("ˈɑː hɪl", True),       # two words: a small gap between the syllables
    "t1": ("Aahil", False),        # the spelling, the voice's own English
    "t2": ("Aah-hil", False),      # a respelling
}
SPEEDS = (0.8, 0.9, 1.0, 1.1)
rows = []
for v in VOICES:
    lang = "en-gb" if v.startswith("b") else "en-us"
    for key, (txt, isph) in INPUTS.items():
        for sp in SPEEDS:
            kw = dict(voice=v, speed=sp, is_phonemes=isph)
            if not isph: kw["lang"] = lang
            a, sr = k.create(txt, **kw)
            a = np.asarray(a, dtype=np.float32)
            peak = float(np.max(np.abs(a))) or 1.0
            idx = np.where(np.abs(a) > peak * 0.01)[0]
            t = a[max(idx[0] - int(.03 * sr), 0):min(idx[-1] + int(.04 * sr), len(a))] * (0.89 / peak)
            name = f"{v}-{key}-{int(round(sp * 100))}"
            sf.write(os.path.join(OUT, name + ".wav"), t, sr)
            rows.append(dict(name=name, voice=v, input=key, text=txt, speed=sp, dur=round(len(t) / sr, 3)))
            print(name, rows[-1]["dur"], flush=True)
json.dump(rows, open(os.path.join(OUT, "renders.json"), "w"), ensure_ascii=False, indent=1)
