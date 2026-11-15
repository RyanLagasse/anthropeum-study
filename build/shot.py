#!/usr/bin/env python3
"""Screenshot / interact with the local preview using Playwright.

  uv run --with playwright==1.61.0 python build/shot.py '#/atlas?era=12' out.png [options]

Options:
  --w 1600 --h 950        viewport
  --wait 1200             ms to wait after load and after each action (default 900)
  --do "click:.sel"       actions, in order; repeatable. Forms:
                            click:<css>            click first match
                            clickxy:<x>,<y>        click at viewport coords
                            key:<Key>              press a key (Enter, ArrowRight, 1, ...)
                            type:<css>=<text>      fill an input
                            hover:<css>            hover first match
                            eval:<js>              run JS in the page
                            wait:<ms>
                            shot:<path.png>        extra screenshot mid-sequence
  --full                  full-page screenshot
  --ls 'k=json'           set localStorage key (prefix anthro.v2. is added) before load; repeatable
  --still 0               don't add ?still=1 (animations run)
Prints console errors / page errors / failed requests (non-font) so regressions are visible.
The preview server must be running:  python3 -m http.server 8920 --bind 127.0.0.1   (from the repo root)
"""
import argparse, sys, os
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument("hash"); ap.add_argument("out")
ap.add_argument("--w", type=int, default=1600); ap.add_argument("--h", type=int, default=950); ap.add_argument("--wait", type=int, default=900)
ap.add_argument("--do", action="append", default=[]); ap.add_argument("--full", action="store_true"); ap.add_argument("--ls", action="append", default=[])
ap.add_argument("--still", default="1"); ap.add_argument("--port", default=os.environ.get("PORT", "8920"))
a = ap.parse_args()
url = f"http://127.0.0.1:{a.port}/index.html{'?still=1' if a.still == '1' else ''}{a.hash}"
with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"]); ctx = b.new_context(viewport={"width": a.w, "height": a.h}, device_scale_factor=1)
    pg = ctx.new_page(); msgs = []
    pg.on("console", lambda m: msgs.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: msgs.append(f"PAGEERROR: {e}"))
    pg.on("requestfailed", lambda r: msgs.append(f"REQFAILED: {r.url}") if "fonts.g" not in r.url else None)
    if a.ls:
        init = ";".join("localStorage.setItem(%r,%r)" % ("anthro.v2." + kv.split("=", 1)[0], kv.split("=", 1)[1]) for kv in a.ls)
        pg.add_init_script(init)
    pg.goto(url, wait_until="load"); pg.wait_for_timeout(a.wait)
    for act in a.do:
        kind, _, arg = act.partition(":")
        try:
            if kind == "click": pg.locator(arg).first.click(timeout=4000)
            elif kind == "clickxy": x, y = arg.split(","); pg.mouse.click(float(x), float(y))
            elif kind == "key": pg.keyboard.press(arg)
            elif kind == "type": sel, _, txt = arg.partition("="); pg.locator(sel).first.fill(txt)
            elif kind == "hover": pg.locator(arg).first.hover(timeout=4000)
            elif kind == "eval": r = pg.evaluate(arg); print("eval →", r) if r is not None else None
            elif kind == "wait": pg.wait_for_timeout(int(arg)); continue
            elif kind == "shot": pg.screenshot(path=arg); continue
            else: print("unknown action", act)
        except Exception as e: msgs.append(f"ACTION FAILED {act}: {str(e).splitlines()[0]}")
        pg.wait_for_timeout(a.wait)
    pg.screenshot(path=a.out, full_page=a.full)
    err = pg.evaluate("(document.getElementById('errbar')||{}).textContent||''")
    if err: msgs.append("ERRBAR: " + err.strip())
    b.close()
for m in msgs[:25]: print(m)
print("ok", a.out, "(no errors)" if not msgs else f"({len(msgs)} messages)")
