/* Anthropeum Study — shared quiz kit (used by practice.js and drills.js so every mode feels the same).

   AS.quiz.register(mode)      mode = { id, title, blurb, group:"Museum gallery"|"Drills", accent:"#hex", glyph:"short text or inline SVG",
                                        available:() => bool, unavailableNote, start(host, params, ctx) → { destroy() } }   ctx = { exit() }
   AS.quiz.modes               { id: mode }

   const round = AS.quiz.round(host, { title, total, accent, onExit })
     round.begin(i) → body element (cleared) for question i (0-based); updates the progress pips
     round.award(pts, max, ok?)  add to the running score and colour pip i (ok defaults to pts/max ≥ .6)
     round.finish({ rows:[{ label, pts, max, note }], onAgain, extra:Node })   end-of-round summary screen
     round.destroy()

   const task = AS.quiz.placeTask(host, {            // the core game loop: drop a pin and/or pick an era, then reveal
     media: Node, prompt: "Where and when was this made?", hint: "optional small text",
     askPin: true, askEra: true,
     truth: { lon, lat, r_km: 75, label: "Nimrud, Iraq", eras: [8], dateLabel: "883–859 BCE" },
     mapYear: AS.MODERN_MAP, revealYear: null,       // borders while answering / after reveal (e.g. AS.ERA2MAP[era])
     reveal: result => Node|null,                    // extra content shown under the score
     onDone(result){}, onNext(){}, nextLabel: "Next" })
     result = { lon, lat, km, pinPts, eraGuess, eraPts, pts, max, regionGuess }
   task.destroy()

   AS.quiz.choiceTask(host, { media, prompt, hint, options:[{ label, node, correct, note }], columns, reveal:result=>Node, onDone(result), onNext() })
     result = { index, ok, pts (5000|0), max:5000 }
   AS.quiz.scoreBurst(pts, max) → Node */
(function(){
"use strict";
const AS = window.AS, h = AS.h;
const TC = (n, d) => (AS.theme && AS.theme.css(n)) || d;   /* a theme token's current value, for canvas markers */
const Q = AS.quiz = AS.quiz || {}; Q.modes = Q.modes || {};
Q.register = m => { Q.modes[m.id] = m; return m; };
Q.scoreBurst = (pts, max) => { const el = h("div.pts", {}, "0", h("small", {}, "/ " + AS.fmtN(max))); const t0 = performance.now(), dur = AS.still ? 0 : 700;
  const tick = () => { const u = dur ? Math.min(1, (performance.now() - t0) / dur) : 1, e = 1 - Math.pow(1 - u, 3); el.firstChild.textContent = AS.fmtN(pts * e); if (u < 1) requestAnimationFrame(tick); }; tick(); return el; };
const grade = f => f >= .9 ? "Superb" : f >= .7 ? "Strong" : f >= .45 ? "Close" : f >= .2 ? "Some signal" : "Miss";

Q.round = function(host, o){
  const pips = h("div.q-pips"); for (let i = 0; i < o.total; i++) pips.append(h("i"));
  const scoreEl = h("b.mono", {}, "0"); const body = h("div.q-body");
  const head = h("div.q-head", { style:o.accent ? { "--acc":o.accent } : null }, h("button.btn.ghost.sm", { type:"button", onclick:() => o.onExit && o.onExit() }, "← Practice"), h("h3", {}, o.title), pips, h("div.grow"), h("div.q-score", {}, scoreEl, h("span", {}, "pts")));
  const root = h("div.q-round", {}, head, body); host.append(root);
  let score = 0, maxSum = 0, idx = 0;
  return { body, el:root,
    begin(i){ idx = i; [...pips.children].forEach((p, j) => p.classList.toggle("cur", j === i)); body.innerHTML = ""; body.scrollTop = 0; return body; },
    award(pts, max, ok){ score += pts; maxSum += max; scoreEl.textContent = AS.fmtN(score); const p = pips.children[idx]; if (p){ const good = ok == null ? pts / max >= .6 : ok; p.classList.add(good ? "ok" : pts / max >= .25 ? "mid" : "no"); } },
    get score(){ return score; }, get max(){ return maxSum; },
    finish(f){ [...pips.children].forEach(p => p.classList.remove("cur")); body.innerHTML = ""; const frac = maxSum ? score / maxSum : 0;
      const rows = h("div.q-rows"); for (const r of (f.rows || [])){ const fr = r.max ? r.pts / r.max : 0; rows.append(h("div.q-row", {}, h("span.lbl", {}, r.label), r.note ? h("span.q-sub", {}, r.note) : h("span"), h("span.mono" + (fr >= .6 ? ".ok" : fr < .25 ? ".no" : ""), {}, AS.fmtN(r.pts)), h("div.bar", { style:{ "--c":fr >= .6 ? "var(--good)" : fr < .25 ? "var(--bad)" : "var(--gold)" } }, h("i", { style:{ width:(100 * fr) + "%" } })))); }
      body.append(h("div.q-summary", {}, h("div.eyebrow", {}, "Round complete"), h("h2", {}, grade(frac) + "."), Q.scoreBurst(score, maxSum), h("div.muted", {}, `${Math.round(frac * 100)}% of the points on offer`), rows, f.extra || null,
        h("div.row", { style:{ justifyContent:"center", marginTop:"18px" } }, f.onAgain ? h("button.btn.primary.lg", { type:"button", onclick:f.onAgain }, "Play again") : null, h("button.btn.lg", { type:"button", onclick:() => o.onExit && o.onExit() }, "Back to practice")))); },
    destroy(){ root.remove(); } };
};

Q.placeTask = function(host, o){
  const askPin = o.askPin !== false && o.truth && o.truth.lon != null, askEra = o.askEra !== false && o.truth && o.truth.eras && o.truth.eras.length;
  let guess = null, eraGuess = null, done = false;
  const stage = h("div.qt-map"), eraHost = h("div.qt-era"), status = h("div.qt-status"), lock = h("button.btn.primary.lg", { type:"button", disabled:true }, "Lock in"), result = h("div.qt-result");
  const left = h("div.qt-left", {}, h("div.qt-media", {}, o.media || null), h("div.qt-ask", {}, h("h3", {}, o.prompt || "Where and when was this made?"), o.hint ? h("div.muted", { style:{ fontSize:"13px" } }, o.hint) : null, status, h("div.row", {}, lock, h("span.muted", { style:{ fontSize:"12px" } }, h("span.kbd", {}, "Enter")))), result);
  const right = h("div.qt-right" + (askPin ? "" : ".nomap"), {}, askPin ? stage : null, askEra ? eraHost : null);
  const root = h("div.qt", {}, left, right); host.append(root);
  let map = null, bar = null;
  const setStatus = () => { if (done) return; const need = []; if (askPin && !guess) need.push("click the map to drop your pin"); if (askEra && eraGuess == null) need.push("pick an era below");
    status.innerHTML = need.length ? `<span class="gold">●</span> ${need.join(" · ")}` : `<span class="ok">●</span> ready — you can still move your pin or change era`; lock.disabled = need.length > 0; };
  if (askPin){ map = AS.createMap(stage, { year:o.mapYear || AS.MODERN_MAP, mode:"quiet", crosshair:true });
    map.on("click", e => { if (done) return; guess = { lon:e.lon, lat:e.lat }; map.setMarkers([{ lon:guess.lon, lat:guess.lat, r:9, shape:"pin", color:TC("--gold", "#ecbd4f"), label:"your pin", labelAlways:true, inert:true, fixed:true }]); setStatus(); }); }
  if (askEra) bar = AS.ui.eraBar(eraHost, { value:null, allowAll:false, ages:true, onChange:i => { if (done){ bar.set(eraGuess); return; } eraGuess = i; setStatus(); } });
  const finish = () => { if (done || lock.disabled) return; done = true; const t = o.truth; const res = { max:(askPin ? 5000 : 0) + (askEra ? 5000 : 0), pts:0 };
    if (askPin){ res.lon = guess.lon; res.lat = guess.lat; res.km = AS.geo.havKm(guess.lon, guess.lat, t.lon, t.lat); res.pinPts = AS.score.pin(res.km, Math.max(50, t.r_km || 50), 800); res.pts += res.pinPts; res.regionGuess = AS.regionOfPoint(guess.lon, guess.lat);
      map.setCrosshair(false); if (o.revealYear) map.setBase({ year:o.revealYear });
      map.setAreas([{ lon:t.lon, lat:t.lat, r_km:Math.max(50, t.r_km || 50), color:TC("--good", "#3fd08f"), alpha:.14 }]); map.setArcs([{ from:[guess.lon, guess.lat], to:[t.lon, t.lat], color:TC("--ink", "#f1ebdd"), dashed:true, width:1.6 }]);
      map.setMarkers([{ lon:guess.lon, lat:guess.lat, r:8, shape:"pin", color:TC("--bad", "#ff6b6b"), label:"you", labelAlways:true, inert:true, fixed:true }, { lon:t.lon, lat:t.lat, r:9, shape:"pin", color:TC("--good", "#3fd08f"), label:t.label || "answer", labelAlways:true, pulse:true, inert:true, fixed:true }]);
      map.fit([[guess.lon, guess.lat], [t.lon, t.lat]], { pad:110, maxZoom:6, ms:AS.still ? 0 : 800 }); }
    if (askEra){ res.eraGuess = eraGuess; res.eraPts = AS.score.era(eraGuess, t.eras); res.pts += res.eraPts; bar.setMarks({ truth:t.eras, guess:eraGuess }); }
    status.remove(); lock.remove(); left.querySelector(".qt-ask .row").remove();
    const lines = h("div.qt-lines");
    if (askPin) lines.append(h("div.qt-line", {}, h("span", {}, "Place"), h("b", {}, res.km < 10 ? "on the spot" : `${AS.fmtN(res.km)} km off`), h("span.mono" + (res.pinPts >= 3000 ? ".ok" : res.pinPts < 1200 ? ".no" : ""), {}, "+" + AS.fmtN(res.pinPts))));
    if (askEra){ const d = Math.min(...t.eras.map(e => Math.abs(e - eraGuess))), signed = eraGuess - (eraGuess < Math.min(...t.eras) ? Math.min(...t.eras) : Math.max(...t.eras));
      lines.append(h("div.qt-line", {}, h("span", {}, "Era"), h("b", {}, d === 0 ? "exact" : `${d} era${d > 1 ? "s" : ""} too ${signed < 0 ? "early" : "late"}`), h("span.mono" + (res.eraPts >= 2500 ? ".ok" : res.eraPts === 0 ? ".no" : ""), {}, "+" + AS.fmtN(res.eraPts)))); }
    const ans = h("div.qt-answer", {}, t.label ? h("b", {}, t.label) : null, t.dateLabel ? h("span", {}, " · " + t.dateLabel) : null);
    const next = h("button.btn.primary.lg", { type:"button", onclick:() => o.onNext && o.onNext() }, o.nextLabel || "Next");
    let extra = null; try { extra = o.reveal ? o.reveal(res) : null; } catch(e){ console.error(e); }
    result.append(h("div.row.between", { style:{ alignItems:"flex-end" } }, Q.scoreBurst(res.pts, res.max), next), ans, lines); if (extra) result.append(extra); result.classList.add("show"); left.scrollTop = 0; root.classList.add("revealed");
    if (o.onDone) o.onDone(res); };
  lock.onclick = finish;
  const onKey = e => { if (e.key !== "Enter" || e.target.tagName === "INPUT") return; if (!root.isConnected) return; e.preventDefault(); if (!done) finish(); else if (o.onNext) o.onNext(); };
  document.addEventListener("keydown", onKey); setStatus();
  return { el:root, map, destroy(){ document.removeEventListener("keydown", onKey); if (map) map.destroy(); if (bar) bar.destroy(); root.remove(); } };
};

Q.choiceTask = function(host, o){
  let done = false; const grid = h("div.qc-grid", { style:{ "--cols":o.columns || Math.min(4, o.options.length) } }); const result = h("div.qt-result");
  const btns = o.options.map((op, i) => { const b = h("button.qc-opt", { type:"button", onclick:() => pick(i) }, h("span.kbd", {}, String(i + 1)), op.node || h("span", {}, op.label)); grid.append(b); return b; });
  const root = h("div.qc", {}, o.media ? h("div.qc-media", {}, o.media) : null, h("div.qc-ask", {}, h("h3", {}, o.prompt), o.hint ? h("div.muted", { style:{ fontSize:"13px" } }, o.hint) : null), grid, result); host.append(root);
  function pick(i){ if (done) return; done = true; const ok = !!o.options[i].correct; btns.forEach((b, j) => { b.disabled = true; if (o.options[j].correct) b.classList.add("right"); else if (j === i) b.classList.add("wrong"); if (o.options[j].note) b.append(h("div.qc-note", {}, o.options[j].note)); });
    const res = { index:i, ok, pts:ok ? 5000 : 0, max:5000 }; let extra = null; try { extra = o.reveal ? o.reveal(res) : null; } catch(e){ console.error(e); }
    result.append(h("div.row.between", {}, h("div.qc-verdict" + (ok ? ".ok" : ".no"), {}, ok ? "Correct" : "Not quite"), h("button.btn.primary.lg", { type:"button", onclick:() => o.onNext && o.onNext() }, o.nextLabel || "Next"))); if (extra) result.append(extra); result.classList.add("show"); if (o.onDone) o.onDone(res); }
  const onKey = e => { if (!root.isConnected) return; const n = parseInt(e.key, 10); if (!done && n >= 1 && n <= btns.length){ e.preventDefault(); e.stopPropagation(); pick(n - 1); } else if (done && e.key === "Enter" && o.onNext){ e.preventDefault(); o.onNext(); } };
  document.addEventListener("keydown", onKey, true);
  return { el:root, destroy(){ document.removeEventListener("keydown", onKey, true); root.remove(); } };
};
})();
