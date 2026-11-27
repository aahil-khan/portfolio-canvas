# Usage: <venv with fonttools+brotli>/python subset-name-fonts.py <font.ttf> <out.woff2> <text>
#   Tiro Devanagari Hindi: "आहिलऽ"   Noto Nastaliq Urdu (variable, pinned to wght 700): "عاہل"
# Subset the two script faces to the glyphs of the name alone, with full shaping, as woff2.
import sys
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
src, dst, text = sys.argv[1], sys.argv[2], sys.argv[3]
f = TTFont(src)
if "fvar" in f: f = instancer.instantiateVariableFont(f, {a.axisTag: (700 if a.axisTag == "wght" else a.defaultValue) for a in f["fvar"].axes})
o = subset.Options(); o.flavor = "woff2"; o.layout_features = ["*"]; o.name_IDs = ["*"]; o.notdef_outline = True
s = subset.Subsetter(o); s.populate(text=text); s.subset(f)
subset.save_font(f, dst, o)
