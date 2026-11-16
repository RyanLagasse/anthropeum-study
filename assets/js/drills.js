/* Anthropeum Study — knowledge drills for the Practice room.
   Registers five modes with the shared quiz kit (AS.quiz.register), all group "Drills":

     tells       Read the tell        tell card → pin where it points (+ era when the tell is dated)
     lookalikes  Spot the difference  one discriminating point → which contender is it?
     scripts     Whose writing?       script specimen → pin + era / name it / which style
     when        Earliest possible    technique card → first era anywhere / where it began / when it reached a region
     powers      Pin the power        empire or culture name → heartland on a modern map + era

   Every mode: 8 questions, honours params.region ("eas,wan") and params.ages ("0,2" = indices into AS.AGES),
   orders candidates with AS.srs, logs each answer with AS.log.add and stores { best, last, plays } (points) plus
   { max, bestPct, lastPct } under AS.store "mode.<id>".
   No view of its own except a hidden dev route:  #/drilltest?mode=<id>&region=…&ages=…  */
(function(){
"use strict";
const AS = window.AS, h = AS.h, Q = AS.quiz, D = window.AS_DATA = window.AS_DATA || {};
const N = 8;
/* accents: the tells drill follows the theme accent; the others are fixed hues, inked darker on light themes */
const TC = n => (AS.theme && AS.theme.css(n)) || { "--good":"#3fd08f", "--bad":"#ff6b6b", "--ink":"#f1ebdd", "--gold":"#ecbd4f" }[n];
const ACC = AS.theme && AS.theme.light ? { tells:"var(--gold)", lookalikes:"#8a3f9c", scripts:"#1b7f86", when:"#2b5fa8", powers:"#b03a66" }
  : { tells:"var(--gold)", lookalikes:"#c56bd6", scripts:"#37bfc2", when:"#4c8fe6", powers:"#f06f9b" };
const svg = d => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

/* ================= helpers ================= */
const arr = x => Array.isArray(x) ? x : x == null || x === "" ? [] : [x];
const num = x => typeof x === "number" && isFinite(x);
const pad2 = n => String(n).padStart(2, "0");
const nearest = (set, g) => { if (!set || !set.length) return undefined; if (g == null) return set[0]; let b = set[0]; for (const e of set) if (Math.abs(e - g) < Math.abs(b - g)) b = e; return b; };
/* every era touched by the span y0..y1 (an end year sitting exactly on an era boundary does not claim the next era) */
function erasIn(y0, y1){ if (!num(y0)) return []; if (!num(y1) || y1 < y0) y1 = y0; const a = AS.eraOf(y0), b = Math.max(a, AS.eraOf(y1 > y0 ? y1 - 1 : y1)); const out = []; for (let i = a; i <= b; i++) out.push(i); return out; }
const spanLabel = eras => AS.rangeLabel(AS.eraStart(Math.min(...eras)), AS.eraEnd(Math.max(...eras))).replace(/^0–/, "1–");

function parseFilter(p){
  const regs = String(p.region || "").split(",").filter(x => x && AS.REGIONS.some(r => r.id === x));
  const ages = String(p.ages || "").split(",").filter(x => x !== "").map(Number).filter(n => Number.isInteger(n) && AS.AGES[n]);
  const eras = new Set(); for (const a of ages) for (let i = AS.AGES[a].from; i <= AS.AGES[a].to; i++) eras.add(i);
  const bits = []; if (regs.length) bits.push(regs.map(r => AS.region(r).short).join(", ")); if (ages.length) bits.push(ages.map(a => AS.AGES[a].name).join(", "));
  return { regs:regs.length ? new Set(regs) : null, eras:ages.length ? eras : null, label:bits.join(" · "),
    reg(id){ return !this.regs || this.regs.has(id); }, anyReg(ids){ return !this.regs || ids.some(i => this.regs.has(i)); },
    era(set){ return !this.eras || (set || []).some(e => this.eras.has(e)); } };
}
/* params.weak=1 (the hub's "bias" toggle): regions where the practice log averages under 60% (n ≥ 3) jump the queue */
let weakRegs = null;
function findWeak(){ const m = {}; for (const e of AS.log.all()){ if (!e.region || !e.max) continue; const c = m[e.region] = m[e.region] || { n:0, s:0 }; c.n++; c.s += e.pts / e.max; }
  const out = Object.keys(m).filter(r => m[r].n >= 3 && m[r].s / m[r].n < .6); return out.length ? new Set(out) : null; }
/* srs-ordered, then: due/unseen before not-yet-due, and lower tier first inside each */
function rank(deck, items, idOf, tierOf){
  const by = new Map(items.map(x => [idOf(x), x])), st = AS.srs.state(deck), now = Date.now();
  const ord = AS.srs.order(deck, [...by.keys()]).map(id => by.get(id));
  const regOf = x => (x.place && x.place.region) || x.region || (x.origin && x.origin.region) || (x.areas && x.areas[0] && x.areas[0].region);
  const key = x => { const c = st[idOf(x)]; return (c && c.due > now ? 10 : 0) + (tierOf ? tierOf(x) : 0) - (weakRegs && weakRegs.has(regOf(x)) ? 5 : 0); };
  return ord.map((x, i) => [key(x), i, x]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(t => t[2]);
}

/* ---- answer-leak check: does the question text name the place it is asking for? ---- */
const STOP = new Set(("the and of in on at to from for with north northern south southern east eastern west western central upper lower middle valley coast coastal empire kingdom " +
  "region world plain plains plateau basin river delta sea island islands peninsula city cities area lands land court heartland highlands highland lowlands great greater early late later " +
  "ancient medieval modern incl including especially mainly then also near around across workshops workshop style tradition culture cultures").split(" "));
const ALIAS = { netherlands:["dutch","holland"], holland:["dutch"], iran:["persia"], persia:["iran"], france:["french","gallic"], wales:["welsh"], flanders:["flemish"], turkey:["ottoman","turk"], anatolia:["turk","ottoman"],
  greece:["greek","hellen"], britain:["british","english"], england:["english","british"], spain:["spanish","hispan"], ireland:["irish"], scotland:["scottish","scots"], denmark:["danish"], sweden:["swedish"],
  norway:["norse","norweg"], switzerland:["swiss"], thailand:["thai","siam"], cambodia:["khmer"], burma:["burmese"], myanmar:["burmese"], iraq:["mesopotam"], mesopotamia:["babylon","assyri","sumer"],
  rome:["roman"], italy:["italian"], germany:["german"], japan:["nippon"], china:["sino-"], peru:["peruvian"], mexico:["mexica"] };
const NOT_LEAK = new Set(["indigo", "indigenous", "indirect", "individual", "indicate", "indicates", "china-clay"]);
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function stemsOf(label){ const out = new Set();
  for (const w of norm(label).split(/[^a-z-]+/)){ if (w.length < 4 || STOP.has(w)) continue; out.add(w.slice(0, Math.max(4, w.length - (w.length <= 5 ? 1 : 2)))); for (const a of (ALIAS[w] || [])) out.add(a); }
  return [...out]; }
const WORD = /[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ'’-]*/g;
function leakWords(text, stems){ if (!stems.length) return []; const hits = [];
  for (const w of (String(text || "").match(WORD) || [])){ const n = norm(w); if (NOT_LEAK.has(n)) continue; if (stems.some(s => n.startsWith(s) && n.length <= s.length + 6)) hits.push(w); }
  return hits; }
/* text → nodes with leaking words blacked out */
function masked(text, stems){ if (!stems || !stems.length) return [String(text || "")]; const out = []; let last = 0; const s = String(text || "");
  s.replace(WORD, (w, i) => { const n = norm(w); if (!NOT_LEAK.has(n) && stems.some(st => n.startsWith(st) && n.length <= st.length + 6)){ out.push(s.slice(last, i), h("span.dr-mask", { title:"hidden: it names the answer" }, " ".repeat(Math.max(4, w.length)))); last = i + w.length; } return w; });
  out.push(s.slice(last)); return out; }

/* ---- truth whose location depends on the guess (nearest valid area / the capital of the era picked).
        placeTask reads truth.lon/lat/r_km/label only when the answer is locked, so getters are enough. ---- */
function liveTruth(base, pick){
  const st = { pin:null, root:null, frozen:null };
  const eraSel = () => { if (!st.root) return null; const cells = [...st.root.querySelectorAll(".qt-era .erabar .cell")]; const i = cells.findIndex(c => c.classList.contains("on")); return i < 0 ? null : i; };
  const cur = () => st.frozen || pick({ pin:st.pin, era:eraSel() });
  const t = Object.assign({}, base);
  for (const k of ["lon", "lat", "r_km", "label"]) Object.defineProperty(t, k, { enumerable:true, get:() => cur()[k] });
  t.bind = task => { st.root = task.el; if (task.map) task.map.on("click", e => { if (!st.frozen) st.pin = { lon:e.lon, lat:e.lat }; }); };
  t.freeze = () => { st.frozen = cur(); return st.frozen; };
  return t;
}
/* small dots on the kit's era bar (after a reveal): [{ era, color, title }] */
function markEras(root, marks){ const cells = root.querySelectorAll(".qt-era .erabar .cell"); if (!cells.length) return;
  for (const m of marks){ const c = cells[m.era]; if (!c) continue; let box = c.querySelector(".dr-marks"); if (!box){ box = h("span.dr-marks"); c.append(box); } box.append(h("i", { style:{ background:m.color }, title:m.title || null })); } }

/* ---- specimen cards ---- */
function card(o){ return h("div.dr-card" + (o.cls ? "." + o.cls : ""), { style:{ "--acc":o.accent } },
  h("div.dr-card-top", {}, h("span.dr-eyebrow", {}, o.eyebrow || ""), h("span.dr-no.mono", {}, o.no || "")),
  o.title ? h("h2.dr-title", {}, o.title) : null, o.sub ? h("div.dr-sub", {}, o.sub) : null, o.body || null, o.foot ? h("div.dr-foot", {}, o.foot) : null); }
const optNode = t => h("span.dr-opt", {}, t);
const noOf = api => `No. ${pad2(api.n + 1)} / ${pad2(api.total)}`;
function revealBox(o){ return h("div.dr-reveal", { style:{ "--acc":o.accent } },
  o.eyebrow ? h("div.dr-rev-eyebrow", {}, o.eyebrow) : null, o.head ? h("h4.dr-rev-head", {}, o.head) : null, o.body || null,
  o.caution ? h("div.dr-caution", {}, h("b", {}, o.cautionLabel || "Careful"), h("span", {}, o.caution)) : null,
  o.meta && o.meta.length ? h("div.dr-meta", {}, o.meta) : null, o.link ? h("a.dr-link", { href:o.link.href }, o.link.label, h("span", {}, "→")) : null); }
const bullets = (items, n) => { const a = arr(items).slice(0, n || 9); return a.length ? h("ul.dr-list", {}, a.map(x => h("li", {}, String(x)))) : null; };
const pinNote = res => { const b = []; if (res.km != null) b.push(res.km < 10 ? "on the spot" : AS.fmtN(res.km) + " km off"); if (res.eraGuess != null) b.push(res.eraPts === 5000 ? "era exact" : res.eraPts ? "era near" : "era off"); return b.join(" · "); };

/* ================= round runner ================= */
function play(mode, host, params, ctx, build){
  let round = null, task = null, sumKey = null, dead = false;
  const wrap = h("div.dr-host", { style:{ "--acc":mode.accent } }); host.append(wrap);
  /* the quiz kit needs a full-height box; if the mounting host does not give one (no height / not a flex column), fill the view instead */
  if (wrap.clientHeight < 240) wrap.classList.add("dr-fill");
  const clean = () => { if (sumKey){ document.removeEventListener("keydown", sumKey); sumKey = null; } if (task){ try { task.destroy(); } catch(e){} task = null; } if (round){ round.destroy(); round = null; } };
  const exit = () => ctx && ctx.exit && ctx.exit();
  function start(){
    clean(); if (dead) return;
    const f = parseFilter(params || {}); let qs = [];
    weakRegs = (params || {}).weak === "1" ? findWeak() : null;
    try { qs = build(f, params || {}).slice(0, N); } catch(e){ console.error(e); }
    round = Q.round(wrap, { title:mode.title, total:Math.max(1, qs.length), accent:mode.accent, onExit:exit });
    if (!qs.length){ round.body.append(h("div.dr-empty", {}, h("div.dr-empty-glyph", { html:mode.glyph }), h("h3", {}, mode.available() ? "Nothing fits that filter." : "Not stocked yet."),
      h("p.muted", {}, mode.available() ? `"${mode.title}" has no questions for ${f.label || "this selection"}. Widen the region or the age and try again.` : (mode.unavailableNote || "The data for this drill is missing.")),
      h("div.row", { style:{ justifyContent:"center" } }, h("button.btn.primary", { type:"button", onclick:exit }, "Back to practice")))); return; }
    const rows = [], missed = []; let i = 0;
    const step = () => { if (task){ try { task.destroy(); } catch(e){} task = null; } if (dead) return; if (i >= qs.length) return finish();
      const q = qs[i], body = round.begin(i);
      task = q.run(body, { n:i, total:qs.length, filter:f, nextLabel:i === qs.length - 1 ? "See results" : "Next", next(){ i++; step(); },
        done(res, info){ info = info || {}; const ok = res.max ? res.pts / res.max >= .6 : !!res.ok; round.award(res.pts, res.max);
          AS.log.add({ mode:mode.id, kind:q.kind, region:q.region, regionGuess:info.regionGuess || res.regionGuess, era:info.era, eraGuess:res.eraGuess, km:res.km != null ? Math.round(res.km) : undefined, pts:res.pts, max:res.max, ok, ref:q.ref });
          if (q.deck) AS.srs.grade(q.deck, q.srsId || q.ref, ok);
          rows.push({ label:info.label || q.label, pts:res.pts, max:res.max, note:info.note != null ? info.note : pinNote(res) }); if (!ok && q.href) missed.push(q); } }); };
    const finish = () => { const prev = AS.store.get("mode." + mode.id, null) || {}; const pct = round.max ? Math.round(100 * round.score / round.max) : 0;
      AS.store.set("mode." + mode.id, { best:Math.max(prev.best || 0, round.score), last:round.score, plays:(prev.plays || 0) + 1, max:round.max, lastPct:pct, bestPct:Math.max(prev.bestPct || 0, pct), t:Date.now() });
      /* the hub's cards read practice.stats { id:{ plays, best, last, max } }: keep that in step too */
      const ps = AS.store.get("practice.stats", {}) || {}, me = ps[mode.id] || {}; ps[mode.id] = { plays:(me.plays || 0) + 1, best:Math.max(me.best || 0, round.score), last:round.score, max:round.max }; AS.store.set("practice.stats", ps);
      const seen = new Set(), links = missed.filter(q => !seen.has(q.href) && seen.add(q.href)).slice(0, 5);
      const extra = links.length ? h("div.dr-review", {}, h("span.dr-review-lbl", {}, "Worth another look"), links.map(q => h("a.chip", { href:q.href }, q.label))) : null;
      round.finish({ rows, onAgain:start, extra });
      sumKey = e => { if (e.key === "Enter" && wrap.isConnected && !/^(INPUT|BUTTON|A)$/.test(e.target.tagName)){ e.preventDefault(); start(); } }; document.addEventListener("keydown", sumKey); };
    step();
  }
  start();
  return { destroy(){ dead = true; clean(); wrap.remove(); } };
}
const hintOf = (api, extra) => [extra, api.filter.label ? "Filter: " + api.filter.label : null].filter(Boolean).join("  ·  ") || null;

/* ================= 1. tells ================= */
const tellsData = () => (D.tells && Array.isArray(D.tells.tells)) ? D.tells.tells.filter(t => t && t.id && t.place && num(t.place.lat) && num(t.place.lon) && (t.cue || t.title)) : [];
const tellEras = t => { const y = t.years; if (!Array.isArray(y) || !num(y[0])) return null; const e = erasIn(y[0], num(y[1]) ? y[1] : y[0]); return e.length ? e : null; };
const tellStems = t => stemsOf(t.place.label);
const tellLeaks = t => leakWords((t.title || "") + " " + (t.cue || ""), tellStems(t));
function buildTells(f){
  const pool = tellsData().filter(t => f.reg(t.place.region) && (!f.eras || f.era(tellEras(t) || [])));
  const leaky = new Set(pool.filter(t => tellLeaks(t).length).map(t => t.id));
  /* strong + clean first; weak next; tells that name their own answer only as a last resort (and then masked) */
  const list = rank("tells", pool, t => t.id, t => (leaky.has(t.id) ? 4 : 0) + ((t.strength || 1) >= 2 ? 0 : 1)).sort((a, b) => leaky.has(a.id) - leaky.has(b.id)).slice(0, N);
  return list.map(t => { const eras = tellEras(t), askEra = !!eras && eras.length <= 8, stems = leaky.has(t.id) ? tellStems(t) : null;
    return { ref:t.id, deck:"tells", kind:askEra ? "pin+era" : "pin", label:t.title || t.cue, region:t.place.region, href:AS.href("tells", { id:t.id }),
      run(body, api){
        const media = card({ accent:ACC.tells, cls:"dr-tell", eyebrow:t.medium || "Tell", no:noOf(api), title:masked(t.title || "", stems), body:h("p.dr-cue", {}, masked(t.cue || "", stems)),
          foot:[AS.ui.pips(AS.clamp(t.strength || 1, 1, 3)), h("span", {}, ["a hint", "a good tell", "near-certain"][AS.clamp(t.strength || 1, 1, 3) - 1])] });
        return Q.placeTask(body, { media, prompt:askEra ? "Where does this point, and when?" : "Where does this point?", hint:hintOf(api, askEra ? null : "No era on this one: the tell is about place."),
          askEra, truth:{ lon:t.place.lon, lat:t.place.lat, r_km:num(t.place.r_km) ? Math.max(150, t.place.r_km) : 300, label:t.place.label, eras:askEra ? eras : null, dateLabel:eras ? AS.rangeLabel(t.years[0], num(t.years[1]) ? t.years[1] : t.years[0]) : null },
          nextLabel:api.nextLabel, onNext:api.next, onDone:res => api.done(res, { era:askEra ? nearest(eras, res.eraGuess) : undefined }),
          reveal:() => revealBox({ accent:ACC.tells, eyebrow:"What it tells you", head:t.infer || t.place.label, caution:t.caveat,
            meta:[AS.ui.regionTag(t.place.region), eras ? AS.ui.yearChip(t.years[0], num(t.years[1]) ? t.years[1] : null) : null], link:{ href:AS.href("tells", { id:t.id }), label:"Open in Tells" } }) });
      } }; });
}
Q.register({ id:"tells", title:"Read the tell", group:"Drills", accent:ACC.tells, glyph:svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.500 5 5"/><path d="M8 10.500l2 2 3.500-4"/>'),
  blurb:"One visual cue, no picture: pin where it points and when.",
  available:() => tellsData().length > 0, unavailableNote:"The tells dataset has not been packed yet (data-src/tells.json).",
  start(host, params, ctx){ return play(this, host, params, ctx, buildTells); } });

/* ================= 2. lookalikes ================= */
const lookData = () => (D.tells && Array.isArray(D.tells.lookalikes)) ? D.tells.lookalikes.filter(s => s && s.id && Array.isArray(s.contenders) && s.contenders.length >= 2) : [];
function lookQuestions(set){ /* every usable (contender, point): the point must not name any contender (strict), else at least not its own */
  const stems = set.contenders.map(c => stemsOf(c.label)), all = stems.flat(), out = { strict:[], loose:[], excluded:0 };
  set.contenders.forEach((c, ci) => arr(c.points).forEach(p => { if (!p) return; if (leakWords(p, stems[ci]).length || norm(p).includes(norm(c.label))){ out.excluded++; return; } (leakWords(p, all).length ? out.loose : out.strict).push({ ci, point:String(p) }); }));
  return out; }
function buildLook(f){
  const sets = rank("lookalikes", lookData().filter(s => f.anyReg(s.contenders.map(c => c.region))), s => s.id), qs = [], used = new Set();
  for (let pass = 0; pass < 4 && qs.length < N; pass++) for (const set of sets){ if (qs.length >= N) break;
    const lq = lookQuestions(set); let c = lq.strict.filter(x => !used.has(set.id + x.point)); if (!c.length) c = lq.loose.filter(x => !used.has(set.id + x.point)); if (!c.length) continue;
    const inReg = c.filter(x => f.reg(set.contenders[x.ci].region)), pick = AS.rand(inReg.length ? inReg : c); used.add(set.id + pick.point);
    const truth = set.contenders[pick.ci];
    qs.push({ ref:set.id, deck:"lookalikes", kind:"choice", label:set.title, region:truth.region, href:AS.href("tells", { tab:"lookalikes", id:set.id }),
      run(body, api){
        const media = card({ accent:ACC.lookalikes, cls:"dr-look", eyebrow:set.title, no:noOf(api), body:h("p.dr-quote", {}, pick.point), foot:[h("span", {}, `one of ${set.contenders.length} · same family, different address`)] });
        const order = AS.shuffle(set.contenders.map((_, i) => i));
        const noteFor = (c, i) => { const ps = arr(c.points).filter(p => p && !(i === pick.ci && p === pick.point)).map(String); return ps.sort((a, b) => a.length - b.length)[0] || null; };
        return Q.choiceTask(body, { media, prompt:"Which one is this?", hint:hintOf(api), columns:Math.min(set.contenders.length, 4),
          options:order.map(i => ({ label:set.contenders[i].label, node:optNode(set.contenders[i].label), correct:i === pick.ci, note:noteFor(set.contenders[i], i) })), nextLabel:api.nextLabel, onNext:api.next,
          onDone:res => api.done(res, { regionGuess:set.contenders[order[res.index]].region, note:res.ok ? truth.label : `said ${set.contenders[order[res.index]].label}; it was ${truth.label}` }),
          reveal:() => revealBox({ accent:ACC.lookalikes, eyebrow:"Quick test", head:set.quickTest || truth.label, body:set.blurb ? h("p.dr-text", {}, set.blurb) : null,
            meta:[AS.ui.regionTag(truth.region), h("span.dr-ans", {}, truth.label)], link:{ href:AS.href("tells", { tab:"lookalikes", id:set.id }), label:"Compare side by side" } }) });
      } }); }
  return qs;
}
Q.register({ id:"lookalikes", title:"Spot the difference", group:"Drills", accent:ACC.lookalikes, glyph:"≠",
  blurb:"One telling detail from a set of near-twins: say which neighbour it belongs to.",
  available:() => lookData().some(s => { const q = lookQuestions(s); return q.strict.length + q.loose.length > 0; }), unavailableNote:"The lookalike sets have not been packed yet (data-src/tells.json).",
  start(host, params, ctx){ return play(this, host, params, ctx, buildLook); } });

/* ================= 3. scripts ================= */
const scriptsAll = () => (D.scripts && Array.isArray(D.scripts.scripts)) ? D.scripts.scripts : [];
const scriptOk = s => s && s.id && !s.noUnicode && !s.noFont && s.sample && s.font && arr(s.areas).some(a => num(a.lat) && num(a.lon));
const scriptsData = () => scriptsAll().filter(scriptOk);
const styleOk = st => st && st.name && st.sample && st.font;
function ensureFonts(){ for (const u of arr(D.scripts && D.scripts.fontsCss)){ if (!u || [...document.querySelectorAll('link[rel="stylesheet"]')].some(l => l.getAttribute("href") === u)) continue; document.head.append(h("link", { rel:"stylesheet", href:u })); } }
const LR_VERTICAL = /mongol|manchu|phags/i;
function specimen(o){ /* o: sample, font, dir, id */
  const ttb = o.dir === "ttb", cols = ttb ? o.sample.split(/\s+/).filter(Boolean) : [o.sample], len = Math.max(...cols.map(c => [...c].length));
  const fs = ttb ? (len <= 4 ? 88 : len <= 6 ? 68 : 52) : (len <= 8 ? 100 : len <= 13 ? 80 : len <= 20 ? 62 : len <= 28 ? 50 : 42);
  return h("div.dr-glyphs" + (ttb ? ".ttb" : "") + (ttb && LR_VERTICAL.test(o.id + " " + o.font) ? ".lr" : "") + (o.dir === "rtl" && /etruscan|Old Italic/i.test(o.id + " " + o.font) ? ".flip" : ""), { dir:o.dir === "rtl" ? "rtl" : "ltr", lang:"und", style:{ fontFamily:`"${o.font}", "Noto Serif", serif`, "--fs":fs + "px" } },
    ttb ? cols.map(c => h("span.col", {}, c)) : o.sample); }
function scriptCard(s, st, api, eyebrow){ const body = h("div.dr-plate", {}, specimen({ sample:st ? st.sample : s.sample, font:st ? st.font : s.font, dir:s.dir, id:s.id }));
  const cap = h("div.dr-caption"); const c = card({ accent:ACC.scripts, cls:"dr-script", eyebrow, no:noOf(api), body:[body, cap] });
  c.showAnswer = () => { cap.append(h("b", {}, st ? st.name : s.name)); if (!st && s.sampleMeaning) cap.append(h("span", {}, s.sampleMeaning)); c.classList.add("answered"); }; return c; }
const areaYears = a => num(a.from) ? AS.ui.yearChip(a.from, num(a.to) ? a.to : null) : null;
function scriptReveal(s, extra){ const areas = arr(s.areas).slice(0, 4);
  return revealBox({ accent:ACC.scripts, eyebrow:s.family, head:s.name, body:[extra || null, s.infer ? h("p.dr-text", {}, s.infer) : null, bullets(s.look, 3),
      areas.length ? h("div.dr-rows", {}, areas.map(a => h("div.dr-rowline", {}, areaYears(a), h("span.grow", {}, a.label), a.region ? AS.ui.regionTag(a.region) : null))) : null],
    link:{ href:AS.href("scripts", { id:s.id }), label:"Open in Scripts" } }); }
function buildScripts(f){
  const all = scriptsData(), byId = new Map(scriptsAll().map(s => [s.id, s]));
  const pool = rank("scripts", all.filter(s => f.anyReg(arr(s.areas).map(a => a.region)) && f.era(erasIn(s.from, s.to))), s => s.id);
  if (!pool.length) return [];
  const qs = [], taken = new Set(), take = pred => { const s = pool.find(x => !taken.has(x.id) && (!pred || pred(x))) || pool.find(x => !pred || pred(x)); if (s) taken.add(s.id); return s; };
  const hasStyles = s => arr(s.styles).filter(styleOk).length >= 1 && arr(s.styles).length >= 2;
  for (let i = 0; i < N; i++){
    let kind = i % 4 === 3 ? "style" : i % 2 === 0 ? "pin" : "name", s = kind === "style" ? take(hasStyles) : null;
    if (!s){ if (kind === "style") kind = "name"; s = take(); } if (!s) break;
    const areas = arr(s.areas).filter(a => num(a.lat) && num(a.lon)), region = (areas[0] || {}).region, href = AS.href("scripts", { id:s.id });
    if (kind === "pin") qs.push({ ref:s.id, deck:"scripts", kind:"pin+era", label:s.name, region, href, run(body, api){
      const eras = erasIn(s.from, s.to), media = scriptCard(s, null, api, "Specimen");
      const truth = liveTruth({ eras, dateLabel:AS.rangeLabel(s.from, s.to) }, g => { let best = areas[0], bd = Infinity;
        if (g.pin) for (const a of areas){ const d = Math.max(0, AS.geo.havKm(g.pin.lon, g.pin.lat, a.lon, a.lat) - Math.max(300, a.r_km || 0)); if (d < bd){ bd = d; best = a; } }
        return { lon:best.lon, lat:best.lat, r_km:Math.max(300, best.r_km || 0), label:best.label, area:best }; });
      const task = Q.placeTask(body, { media, prompt:"Where and when would you find this writing?", hint:hintOf(api, "Any place and any era it was really in use counts."), truth, nextLabel:api.nextLabel, onNext:api.next,
        reveal:() => { const hit = truth.freeze().area; media.showAnswer(); return scriptReveal(s, areas.length > 1 ? h("p.dr-text.dr-dim", {}, `Scored against the nearest of its ${areas.length} home ranges: ${hit.label}.`) : null); },
        onDone:res => { if (task.map){ const hit = truth.freeze().area; task.map.setAreas(areas.map(a => a === hit ? { lon:a.lon, lat:a.lat, r_km:Math.max(300, a.r_km || 0), color:TC("--good"), alpha:.14 } : { lon:a.lon, lat:a.lat, r_km:Math.max(300, a.r_km || 0), color:AS.regionColor(a.region), alpha:.07, label:a.label })); }
          api.done(res, { era:nearest(eras, res.eraGuess) }); } });
      truth.bind(task); return task; } });
    else if (kind === "name") qs.push({ ref:s.id, deck:"scripts", kind:"name", label:s.name, region, href, run(body, api){
      const media = scriptCard(s, null, api, "Specimen"), conf = arr(s.confusables).filter(c => byId.has(c.id)), how = new Map(conf.map(c => [c.id, c.how]));
      const seen = new Set([s.id]), opts = [], add = x => { if (x && x.name && !seen.has(x.id) && opts.length < 3){ seen.add(x.id); opts.push(x); } };
      AS.shuffle(conf).forEach(c => add(byId.get(c.id))); AS.shuffle(scriptsAll().filter(x => x.family === s.family)).forEach(add); AS.shuffle(scriptsAll()).forEach(add);
      const options = AS.shuffle([s, ...opts]);
      return Q.choiceTask(body, { media, prompt:"Whose writing is this?", hint:hintOf(api), columns:Math.min(4, options.length), options:options.map(x => ({ label:x.name, node:optNode(x.name), correct:x.id === s.id })), nextLabel:api.nextLabel, onNext:api.next,
        onDone:res => api.done(res, { regionGuess:(arr(options[res.index].areas)[0] || {}).region, note:res.ok ? "named it" : "said " + options[res.index].name }),
        reveal:res => { media.showAnswer(); const picked = options[res.index], apart = options.filter(x => x.id !== s.id && how.get(x.id));
          return scriptReveal(s, apart.length ? h("div.dr-apart", {}, apart.map(x => h("div.dr-apart-row" + (!res.ok && x.id === picked.id ? ".picked" : ""), {}, h("b", {}, (!res.ok && x.id === picked.id ? "You said " : "Not ") + x.name), h("span", {}, how.get(x.id))))) : null); } }); } });
    else { const good = arr(s.styles).filter(styleOk), st = AS.rand(good);
      qs.push({ ref:s.id, srsId:s.id, deck:"scripts", kind:"style", label:`${s.name}: ${st.name}`, region, href, run(body, api){
      const media = scriptCard(s, st, api, s.name), others = AS.shuffle(arr(s.styles).filter(x => x && x.name && x !== st)).slice(0, 3), options = AS.shuffle([st, ...others]);
      const when = x => num(x.from) ? AS.rangeLabel(x.from, num(x.to) ? x.to : x.from) : null;
      return Q.choiceTask(body, { media, prompt:"Which style or period is this?", hint:hintOf(api, "Same script, different hand."), columns:Math.min(4, options.length), nextLabel:api.nextLabel, onNext:api.next,
        options:options.map(x => ({ label:x.name, node:optNode(x.name), correct:x === st, note:[when(x), x.where].filter(Boolean).join(" · ") || null })),
        onDone:res => api.done(res, { note:res.ok ? "style spotted" : "said " + options[res.index].name }),
        reveal:() => { media.showAnswer(); return revealBox({ accent:ACC.scripts, eyebrow:s.name, head:st.name, body:[st.where ? h("p.dr-text", {}, st.where) : null, bullets(st.look, 4)], meta:[num(st.from) ? AS.ui.yearChip(st.from, num(st.to) ? st.to : null) : null, region ? AS.ui.regionTag(region) : null],
          link:{ href, label:"Open in Scripts" } }); } }); } }); }
  }
  return qs;
}
Q.register({ id:"scripts", title:"Whose writing?", group:"Drills", accent:ACC.scripts, glyph:"文",
  blurb:"A line of writing, no translation: place it, date it, or name it.",
  available:() => scriptsData().length >= 4, unavailableNote:"The scripts dataset has not been packed yet (data-src/scripts.json).",
  start(host, params, ctx){ ensureFonts(); return play(this, host, params, ctx, buildScripts); } });

/* ================= 4. when ================= */
const techData = () => (D.techniques && Array.isArray(D.techniques.techniques)) ? D.techniques.techniques.filter(t => t && t.id && t.name && t.origin && num(t.origin.year) && t.confidence !== "contested") : [];
const techGroup = t => { const g = arr(D.techniques.groups).find(g => g.id === t.group); return g ? g.name : (t.group || "Technique"); };
const techArrivals = t => arr(t.arrivals).filter(a => a && num(a.year)).slice().sort((a, b) => a.year - b.year);
/* earliest dated appearance per region (origin counts) */
function techByRegion(t){ const m = new Map(); const put = (r, x) => { if (r && (!m.has(r) || x.year < m.get(r).year)) m.set(r, x); };
  put(t.origin.region, { year:t.origin.year, place:t.origin.place, origin:true }); for (const a of techArrivals(t)) put(a.region, a); return m; }
function techReveal(t, hiRegion){ const o = t.origin, rows = [h("div.dr-rowline.origin", {}, AS.ui.yearChip(o.year), h("span.grow", {}, h("b", {}, o.place || "Origin"), h("small", {}, "first appears")), o.region ? AS.ui.regionTag(o.region) : null)];
  const arrs = techArrivals(t), shown = arrs.length > 9 ? arrs.filter((a, i) => i < 8 || a.region === hiRegion).slice(0, 9) : arrs;
  if (arrs.length > shown.length) Promise.resolve().then(() => rows[rows.length - 1].after(h("div.dr-more", {}, `+ ${arrs.length - shown.length} more in the When room`)));
  for (const a of shown) rows.push(h("div.dr-rowline" + (hiRegion && a.region === hiRegion ? ".hi" : ""), {}, AS.ui.yearChip(a.year), h("span.grow", {}, h("b", {}, a.place || ""), a.independent ? h("em", {}, a.year < o.year ? "earlier, separate tradition" : "independent") : null, a.note ? h("small", {}, a.note) : null), a.region ? AS.ui.regionTag(a.region) : null));
  return revealBox({ accent:ACC.when, eyebrow:"The rule", head:t.rule || t.blurb || t.name, body:h("div.dr-rows", {}, rows),
    caution:t.confidence != null && /low|debat|uncertain|contested/i.test(String(t.confidence)) ? "Dates here are debated; treat the era as a soft floor." : null, link:{ href:AS.href("when", { id:t.id }), label:"Open in When" } }); }
function buildWhen(f){
  const pool = rank("techniques", techData().filter(t => [...techByRegion(t).entries()].some(([r, x]) => f.reg(r) && (!f.eras || f.eras.has(AS.eraOf(x.year))))), t => t.id);
  const make = (t, i) => { const o = t.origin, by = techByRegion(t), canPin = num(o.lat) && num(o.lon) && !leakWords(t.name + " " + (t.lookFor || ""), stemsOf(o.place)).length;
    /* every question must sit inside the region/age filter: "reach" targets are filtered regions other than the origin's,
       "first"/"where" need the origin itself inside the filter. Anything before 3000 BCE is off the game's era bar,
       so it would be a give-away era question and is never asked as one. */
    const okE = y => !f.eras || f.eras.has(AS.eraOf(y));
    const regs = [...by.keys()].filter(r => r !== o.region && !by.get(r).origin && by.get(r).year >= -3000 && f.reg(r) && okE(by.get(r).year));
    const originOk = f.reg(o.region) && okE(o.year), can = { first:originOk && o.year >= -3000, where:originOk && canPin, reach:regs.length > 0 };
    const kind = [["first", "where", "reach"][i % 3], "reach", "first", "where"].find(k => can[k]); if (!kind) return null;
    const rid = kind === "reach" ? AS.rand(regs) : o.region, hit = by.get(rid) || o;
    const cardOf = api => card({ accent:ACC.when, cls:"dr-tech", eyebrow:techGroup(t), no:noOf(api), title:t.name, body:t.lookFor ? [h("div.dr-label", {}, "Look for"), h("p.dr-cue", {}, t.lookFor)] : null });
    const others = () => [...by.entries()].filter(([r]) => r !== rid).map(([r, x]) => ({ era:AS.eraOf(x.year), color:AS.regionColor(r), title:`${AS.region(r).short}: ${AS.fmtYear(x.year)}` }));
    const base = { ref:t.id, deck:"techniques", label:t.name, region:rid, href:AS.href("when", { id:t.id }) };
    if (kind === "where") return Object.assign(base, { kind:"where", run(body, api){
      const task = Q.placeTask(body, { media:cardOf(api), prompt:"Where did it start?", hint:hintOf(api, "Pin the earliest known home."), askEra:false, truth:{ lon:o.lon, lat:o.lat, r_km:400, label:o.place, dateLabel:AS.fmtYear(o.year) },
        nextLabel:api.nextLabel, onNext:api.next, reveal:() => techReveal(t),
        onDone:res => { const arrs = techArrivals(t).filter(a => num(a.lat) && num(a.lon)); if (task.map && arrs.length){
            task.map.setArcs([{ from:[res.lon, res.lat], to:[o.lon, o.lat], color:TC("--ink"), dashed:true, width:1.6 }, ...arrs.filter(a => !a.independent).map(a => ({ from:[o.lon, o.lat], to:[a.lon, a.lat], color:AS.regionColor(a.region), width:1.2 }))]);
            task.map.setMarkers([{ lon:res.lon, lat:res.lat, r:8, shape:"pin", color:TC("--bad"), label:"you", labelAlways:true, inert:true, fixed:true }, { lon:o.lon, lat:o.lat, r:9, shape:"pin", color:TC("--good"), label:o.place || "origin", labelAlways:true, pulse:true, inert:true, fixed:true },
              ...arrs.map(a => ({ lon:a.lon, lat:a.lat, r:5, shape:a.independent ? "diamond" : "circle", color:AS.regionColor(a.region), label:`${a.place} ${AS.fmtYearShort(a.year)}`, inert:true, fixed:true }))]); }
          api.done(res, {}); } });
      return task; } });
    const eras = [AS.eraOf(hit.year)];
    return Object.assign(base, { kind, run(body, api){
      const prompt = kind === "first" ? "When does this first appear anywhere?" : h("span", {}, "When does it first show up in ", h("b.dr-reg", { style:{ "--c":AS.regionColor(rid) } }, AS.region(rid).name), "?");
      const task = Q.placeTask(body, { media:cardOf(api), prompt, hint:hintOf(api, kind === "first" ? "Pick the era of the earliest known example." : "Arrival by trade, conquest or reinvention all count."), askPin:false,
        truth:{ eras, label:hit.place || o.place, dateLabel:(hit.year < -3000 ? "before 3000 BCE · " : "") + AS.fmtYear(hit.year) }, nextLabel:api.nextLabel, onNext:api.next, reveal:() => techReveal(t, kind === "reach" ? rid : null),
        onDone:res => { markEras(task.el, others()); const leg = task.el.querySelector(".qt-era"); if (leg && by.size > 1) leg.append(h("div.dr-marklegend", {}, h("span", {}, "elsewhere:"), [...by.entries()].filter(([r]) => r !== rid).sort((a, b) => a[1].year - b[1].year).map(([r, x]) => h("span.dr-ml", { style:{ "--c":AS.regionColor(r) } }, h("i"), `${AS.region(r).short} ${AS.fmtYearShort(x.year)}`))));
          api.done(res, { era:eras[0], note:res.eraPts === 5000 ? "era exact" : res.eraPts ? "era near" : "era off" }); } });
      return task; } });
  };
  const out = []; for (const t of pool){ if (out.length >= N) break; const q = make(t, out.length); if (q) out.push(q); }
  return out;
}
Q.register({ id:"when", title:"Earliest possible", group:"Drills", accent:ACC.when, glyph:svg('<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>'),
  blurb:"A technique and what to look for: when it first existed, where, and when it reached each region.",
  available:() => techData().length > 0, unavailableNote:"The techniques dataset has not been packed yet (data-src/techniques.json).",
  start(host, params, ctx){ return play(this, host, params, ctx, buildWhen); } });

/* ================= 5. powers ================= */
let powerCache = null;
function powersData(){ if (powerCache) return powerCache; const eras = (D.empires && Array.isArray(D.empires.eras)) ? D.empires.eras : [], m = new Map();
  eras.forEach((e, k) => { const i = num(e.start) ? AS.eraOf(e.start) : k; for (const p of arr(e.empires)){ if (!p || !p.name || !num(p.lat) || !num(p.lon)) continue;
    /* "(early)", "(late)", "(rising)" are the same power in a neighbouring era: merge them so any of its eras is right */
    const name = p.name.replace(/\s*\((early|late|rising)\)\s*$/i, ""); let w = m.get(name); if (!w){ w = { id:name, name, eras:[], at:{}, strength:0 }; m.set(name, w); }
    if (!w.at[i]){ w.eras.push(i); w.at[i] = p; } w.strength = Math.max(w.strength, p.strength || 1); } });
  for (const w of m.values()){ w.eras.sort((a, b) => a - b); w.region = AS.regionOfPoint(w.at[w.eras[0]].lon, w.at[w.eras[0]].lat); }
  return powerCache = [...m.values()]; }
function buildPowers(f){
  const pool = rank("powers", powersData().filter(p => f.reg(p.region) && f.era(p.eras)), p => p.id);
  const strong = pool.filter(p => p.strength >= 2), weak = pool.filter(p => p.strength < 2), nWeak = Math.min(weak.length, 3), a = strong.slice(0, N - nWeak), b = weak.slice(0, N - a.length);
  const list = a.concat(b, strong.slice(a.length)).slice(0, N), eraList = D.empires.eras;
  return list.map(p => ({ ref:p.id, deck:"powers", kind:"pin+era", label:p.name, region:p.region, run(body, api){
    const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(p.name), main = m ? m[1] : p.name, sub = m ? m[2] : null;
    const media = card({ accent:ACC.powers, cls:"dr-power", eyebrow:p.strength >= 3 ? "Great power" : p.strength === 2 ? "Major power" : "Regional culture", no:noOf(api), title:main, sub,
      foot:[AS.ui.pips(AS.clamp(p.strength, 1, 3)), h("span", {}, "modern borders · no period hints")] });
    const truth = liveTruth({ eras:p.eras, dateLabel:spanLabel(p.eras) }, g => { const e = nearest(p.eras, g.era), x = p.at[e]; return { lon:x.lon, lat:x.lat, r_km:250, label:main, era:e }; });
    const opts = { media, prompt:"Where was its heartland, and when?", hint:hintOf(api, p.eras.length > 1 ? "It spans several eras: any of them counts." : null), truth, mapYear:AS.MODERN_MAP, nextLabel:api.nextLabel, onNext:api.next,
      reveal:() => { const e = truth.freeze().era, x = p.at[e], nb = arr((eraList.find(er => AS.eraOf(er.start) === e) || eraList[e] || {}).empires).filter(q => q.name.replace(/\s*\((early|late|rising)\)\s*$/i, "") !== p.name).slice().sort((u, v) => (v.strength || 1) - (u.strength || 1) || AS.geo.havKm(x.lon, x.lat, u.lon, u.lat) - AS.geo.havKm(x.lon, x.lat, v.lon, v.lat)).slice(0, 3);
        return revealBox({ accent:ACC.powers, eyebrow:AS.region(p.region).name, head:x.note || p.name,
          body:[h("div.dr-label", {}, p.eras.length > 1 ? "Spans" : "Era"), h("div.dr-meta", {}, p.eras.map(i => AS.ui.eraChip(i))),
            nb.length ? [h("div.dr-label", {}, "Neighbours at the time"), h("div.dr-meta", {}, nb.map(q => h("span.chip.dr-nb", { style:{ "--c":AS.regionColor(AS.regionOfPoint(q.lon, q.lat)) }, title:q.note || null }, h("span.dot"), q.name)))] : null],
          caution:`Borders on the map are now those of ${AS.mapKeyLabel(AS.ERA2MAP[e])}.`, cautionLabel:"Map" }); },
      onDone:res => api.done(res, { era:nearest(p.eras, res.eraGuess) }) };
    Object.defineProperty(opts, "revealYear", { enumerable:true, get:() => AS.ERA2MAP[truth.freeze().era] });
    const task = Q.placeTask(body, opts); truth.bind(task); return task; } }));
}
Q.register({ id:"powers", title:"Pin the power", group:"Drills", accent:ACC.powers, glyph:svg('<path d="M4 18h16M5 18 3.500 8l5 4L12 5l3.500 7 5-4L19 18"/>'),
  blurb:"An empire or culture by name: pin its heartland on today's map and pick its era.",
  available:() => powersData().length >= 4, unavailableNote:"The empires dataset is missing (build/empires.json).",
  start(host, params, ctx){ return play(this, host, params, ctx, buildPowers); } });

/* stats used by the report / other rooms: how many items the leak check holds back */
Q.drillStats = () => ({ tells:{ total:tellsData().length, leaky:tellsData().filter(t => tellLeaks(t).length).map(t => t.id) },
  lookalikes:lookData().map(s => { const q = lookQuestions(s); return { id:s.id, strict:q.strict.length, loose:q.loose.length, excluded:q.excluded }; }),
  scripts:{ total:scriptsAll().length, usable:scriptsData().length, withStyles:scriptsData().filter(s => arr(s.styles).filter(styleOk).length && arr(s.styles).length >= 2).length },
  when:{ total:techData().length }, powers:{ total:powersData().length } });

/* ================= dev route: #/drilltest?mode=<id>&region=…&ages=… ================= */
let devRun = null, devEl = null;
const devMount = (el, params) => { if (devRun){ devRun.destroy(); devRun = null; } el.innerHTML = ""; const m = Q.modes[params.mode];
  if (!m){ el.append(h("div.dr-empty", {}, h("h3", {}, "Drill test bench"), h("p.muted", {}, "Pick a mode."), h("div.row", { style:{ justifyContent:"center", flexWrap:"wrap" } }, Object.values(Q.modes).map(x => h("a.btn", { href:AS.href("drilltest", { mode:x.id }) }, x.title + (x.available() ? "" : " (no data)")))))); return; }
  devRun = m.start(el, params, { exit:() => AS.go("home") }); };
AS.views.drilltest = { title:"Drill test", ownsDigits:true, mount(el, params){ devEl = el; devMount(el, params); }, update(params){ devMount(devEl, params); }, unmount(){ if (devRun) devRun.destroy(); devRun = null; devEl = null; } };
})();
