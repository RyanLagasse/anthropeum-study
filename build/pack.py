#!/usr/bin/env python3
"""Pack data for the v2 site: writes data/*.js (classic scripts that fill window.AS_DATA).
   Run from anywhere:  python3 build/pack.py
   Inputs: build/aggregate.json, build/empires.json, build/template.html (legacy prior notes),
           data-src/*.json (techniques, tells, scripts, gallery, ...)."""
import json, re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data"; OUT.mkdir(exist_ok=True)
HEAD = "window.AS_DATA=window.AS_DATA||{};"
def dump(o): return json.dumps(o, ensure_ascii=False, separators=(",", ":"))
agg = json.load(open(ROOT / "build/aggregate.json")); emp = json.load(open(ROOT / "build/empires.json"))
(OUT / "agg.js").write_text(f"{HEAD}AS_DATA.agg={dump(agg)};AS_DATA.empires={dump(emp)};\n", encoding="utf-8")
# legacy hand-written prior notes live as JS object literals in the old template; lift them verbatim
src = (ROOT / "build/template.html").read_text(encoding="utf-8"); parts = []
for name in ("STRATEGY", "SUBNOTES", "ANIMALNOTES"):
    m = re.search(r"^const %s = (\{.*?^\});" % name, src, re.S | re.M)
    if m: parts.append(f"{name}:{m.group(1)}")
(OUT / "notes.js").write_text(f"{HEAD}AS_DATA.notes={{{','.join(parts)}}};\n", encoding="utf-8")
for p in sorted((ROOT / "data-src").glob("*.json")):
    try: o = json.load(open(p, encoding="utf-8"))
    except Exception as e: print("skip", p.name, e); continue
    (OUT / f"{p.stem}.js").write_text(f"{HEAD}AS_DATA.{p.stem}={dump(o)};\n", encoding="utf-8")
for f in sorted(OUT.glob("*.js")): print(f"{f.name:18s} {f.stat().st_size/1024:8.1f} KB")
