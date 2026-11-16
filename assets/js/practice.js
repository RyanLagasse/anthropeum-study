/* Anthropeum Study — Practice room.
   Hub (#/practice), held-out gallery modes (place · older · lineup · daily) and the calibration dashboard.

   URL:  #/practice                          hub.   region=eas,sas  ages=0,1 (AS.AGES indexes)  weak=1  bias=age|region  show=residuals
         #/practice?mode=<id>&region=…&ages=…&weak=1     run a registered AS.quiz mode with that focus (older also takes same=1)
   Store: practice.stats { id:{ plays, best, last, max } } · practice.seen [ids] · practice.daily { day, pts, max }
   The gallery is a validation set: objects from other museums only. Nothing from the Met is ever shown. */
(function(){
"use strict";
const AS = window.AS, h = AS.h, Q = AS.quiz;
const DATA = () => window.AS_DATA || {};
const GROUP = "Museum gallery";
const SRC = { cma:"Cleveland", aic:"Chicago", mia:"Minneapolis" };
const TYPE2MED = { "Sculpture":"sculpture", "Ceramic":"ceramics", "Metalwork":"metalwork", "Textile":"textile", "Jewelry":"jewelry", "Glass":"glass", "Ivory & Bone":"ivory-bone",
  "Painting":"painting", "Arms & Armor":"arms", "Furniture":"furniture", "Manuscript":"manuscript", "Mask":"mask", "Lacquer":"lacquer", "Drawing":"painting" };
const ageIdx = e => AS.AGES.findIndex(a => e >= a.from && e <= a.to);
const spanLabel = (a, b) => b < 0 ? `${-a}–${-b} BCE` : a >= 0 ? `${a || 1}–${b} CE` : b === 0 ? `${-a}–1 BCE` : `${-a} BCE – ${b} CE`;
const ageSpan = a => spanLabel(AS.eraStart(a.from), AS.eraEnd(a.to));
const ageColor = a => AS.eraColor(Math.round((a.from + a.to) / 2));
const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
const cut = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1).replace(/[\s,;:.]+\S*$/, "") + "…" : s; };
const mulberry = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const daySeed = () => { const s = AS.log.day(); let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return x >>> 0; };
const shuffleR = (a, rng) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const svg = (path, vb = "0 0 24 24") => `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
const ICON = {
  place: svg('<path d="M12 21s-6-5.200-6-10a6 6 0 1 1 12 0c0 4.800-6 10-6 10z"/><circle cx="12" cy="11" r="2.200"/>'),
  older: svg('<rect x="3" y="5" width="7.500" height="14" rx="1.500"/><rect x="13.500" y="5" width="7.500" height="14" rx="1.500"/><path d="M8 12H5.500M6.700 10.500 5.200 12l1.500 1.500"/>'),
  lineup: svg('<rect x="2.500" y="7" width="4" height="10" rx="1"/><rect x="7.800" y="7" width="4" height="10" rx="1"/><rect x="13.100" y="5.500" width="4.600" height="13" rx="1.200" stroke-width="2.200"/><rect x="19" y="7" width="2.500" height="10" rx="1"/>'),
  daily: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.500v2.500M12 19v2.500M2.500 12H5M19 12h2.500M5.300 5.300 7 7M17 17l1.700 1.700M18.700 5.300 17 7M7 17l-1.700 1.700"/>'),
  zoom: svg('<circle cx="10.500" cy="10.500" r="6.500"/><path d="m15.500 15.500 5 5M8 10.500h5M10.500 8v5"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  ext: svg('<path d="M14 5h5v5M19 5l-8 8M11 7H6v11h11v-5"/>')
};

/* ============================ gallery data ============================ */
let _objs = null;
function objects(){
  if (_objs) return _objs;
  const g = DATA().gallery, raw = g && Array.isArray(g.objects) ? g.objects : [], out = [], ids = new Set(), known = new Set(AS.REGIONS.map(r => r.id));
  for (const o of raw){
    if (!o || !o.id || ids.has(o.id) || !o.img || typeof o.img !== "string") continue;
    if (o.src === "met" || /metmuseum/i.test(o.img + " " + (o.url || ""))) continue;               /* hard rule: never the test set */
    const lat = +o.lat, lon = +o.lon, a = +o.y0, b = +o.y1;
    if (![lat, lon, a, b].every(Number.isFinite) || o.lat == null || o.y0 == null) continue;
    const y0 = Math.min(a, b), y1 = Math.max(a, b), e0 = AS.eraOf(y0), e1 = AS.eraOf(y1), eras = []; for (let e = e0; e <= e1; e++) eras.push(e);
    const region = known.has(o.region) ? o.region : AS.regionOfPoint(lon, lat);
    ids.add(o.id);
    out.push(Object.assign({}, o, { lat, lon, y0, y1, eras, mid:(y0 + y1) / 2, eraMid:AS.eraOf((y0 + y1) / 2), region, thumb:o.thumb || o.img, title:o.title || "Untitled object",
      place:o.place || o.country || AS.region(region).name, dateLabel:o.dateLabel || AS.rangeLabel(y0, y1), r_km:+o.r_km > 0 ? +o.r_km : 50 }));
  }
  if (raw.length) _objs = out;
  return out;
}
const sourcesLine = () => { const n = {}; for (const o of objects()) n[o.src] = (n[o.src] || 0) + 1; const names = Object.keys(n).sort((a, b) => n[b] - n[a]).map(k => SRC[k] || k);
  return names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names[0] || ""; };

/* image loading: one promise per URL; a failed or very slow image retires its object for the session */
const dead = new Set(), imgCache = new Map();
function loadImg(url){
  if (imgCache.has(url)) return imgCache.get(url);
  const p = new Promise(res => { const im = new Image(); let done = false; const fin = ok => { if (done) return; done = true; clearTimeout(t); res(ok); };
    const t = setTimeout(() => fin(false), 14000); im.referrerPolicy = "no-referrer"; im.decoding = "async"; im.onload = () => fin(im.naturalWidth > 1); im.onerror = () => fin(false); im.src = url; });
  imgCache.set(url, p); return p;
}
/* per-host circuit breaker: if a museum's image server refuses us outright (hotlink rules, outage), stop asking it */
const hostStat = {}, hostOf = u => { try { return new URL(u).host.replace(/^\d+\./, ""); } catch(e){ return "?"; } };
const hostDown = o => { const s = hostStat[hostOf(o.img)]; return !!s && s.ok === 0 && s.bad >= 2; };
const ensure = (o, which = "img") => hostDown(o) ? Promise.resolve(false) : loadImg(o[which]).then(ok => { const s = hostStat[hostOf(o[which])] = hostStat[hostOf(o[which])] || { ok:0, bad:0 }; s[ok ? "ok" : "bad"]++; if (!ok) dead.add(o.id); return ok; });
const hires = o => o.src === "aic" && /\/full\/843,\//.test(o.img) ? o.img.replace("/full/843,/", "/full/1686,/") : o.src === "cma" && /_web\.jpg$/.test(o.img) ? o.img.replace(/_web\.jpg$/, "_print.jpg") : null;

/* ============================ focus + sampling ============================ */
function parseFocus(p){
  const rs = String(p.region || "").split(",").filter(id => AS.REGIONS.some(r => r.id === id));
  const ag = String(p.ages || "").split(",").filter(s => s !== "").map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < AS.AGES.length);
  return { regions:rs.length ? new Set(rs) : null, ages:ag.length ? new Set(ag) : null, weak:p.weak === "1" };
}
const focusParams = f => ({ region:f.regions && f.regions.size ? [...f.regions].join(",") : null, ages:f.ages && f.ages.size ? [...f.ages].sort((a, b) => a - b).join(",") : null, weak:f.weak ? "1" : null });
const inFocus = (o, f, useAges = true) => (!f.regions || f.regions.has(o.region)) && (!useAges || !f.ages || o.eras.some(e => f.ages.has(ageIdx(e))));
const fracOf = e => e.max > 0 && Number.isFinite(+e.pts) ? AS.clamp(e.pts / e.max, 0, 1) : e.ok != null ? (e.ok ? 1 : 0) : null;
/* how badly he scores per region / per age band: 0 = perfect, 1 = hopeless, .5 = no data */
function weakness(){
  const R = {}, A = {};
  for (const e of AS.log.all()){ const f = fracOf(e); if (f == null) continue;
    if (e.region) (R[e.region] = R[e.region] || []).push(1 - f);
    if (e.era != null && Number.isFinite(+e.era)) (A[ageIdx(+e.era)] = A[ageIdx(+e.era)] || []).push(1 - f); }
  const fold = M => { const out = {}; for (const k in M) if (M[k].length >= 2) out[k] = mean(M[k].slice(-30)); return out; };
  return { region:fold(R), age:fold(A) };
}
const SEEN_CAP = 300;
function makeSampler(f, rng, fixed){
  const all = objects(); let base = all.filter(o => inFocus(o, f)), widened = null;
  if (base.length < 12 && f.ages){ const b2 = all.filter(o => inFocus(o, f, false)); if (b2.length > base.length){ widened = `Only ${base.length} object${base.length === 1 ? "" : "s"} in that focus, so the era filter was dropped.`; base = b2; } }
  if (base.length < 12 && (f.regions || f.ages)){ widened = "That focus is too thin to play, so this round draws on the whole set."; base = all; }
  const used = new Set(), seen = AS.store.get("practice.seen", []), seenSet = new Set(seen), w = f.weak ? weakness() : null;
  const wt = (M, k) => w ? .25 + 4 * Math.pow(M[k] == null ? .5 : M[k], 2) : 1;
  const weighted = (keys, fn) => { const ws = keys.map(fn), sum = ws.reduce((a, b) => a + b, 0); let x = rng() * sum; for (let i = 0; i < keys.length; i++){ x -= ws[i]; if (x <= 0) return keys[i]; } return keys[keys.length - 1]; };
  const group = (list, fn) => { const m = {}; for (const o of list) (m[fn(o)] = m[fn(o)] || []).push(o); return m; };
  const S = { base, used, widened, rng,
    ok: o => !dead.has(o.id) && !used.has(o.id) && !hostDown(o),
    /* choose from a list: prefer objects he has not seen recently */
    from(list){ list = list.filter(S.ok); if (!list.length) return null; if (!fixed){ const fresh = list.filter(o => !seenSet.has(o.id)); if (fresh.length) list = fresh; } const o = list[Math.floor(rng() * list.length)]; used.add(o.id); return o; },
    /* region first, then age band, then object — so the draw is not dominated by whatever the set has most of */
    pick(pred){ const c = base.filter(o => S.ok(o) && (!pred || pred(o))); if (!c.length) return null;
      /* thin regions (Oceania has a dozen objects) must not come up as often as deep ones: weight by sqrt of what is still unseen there */
      const depth = k => { const fresh = fixed ? byR[k].length : byR[k].filter(o => !seenSet.has(o.id)).length; return fresh ? Math.sqrt(fresh) : .25 * Math.sqrt(byR[k].length); };
      const byR = group(c, o => o.region), r = weighted(Object.keys(byR).sort(), k => depth(k) * wt(w && w.region, k));
      const byA = group(byR[r], o => ageIdx(o.eraMid)), a = weighted(Object.keys(byA).sort(), k => wt(w && w.age, k));
      return S.from(byA[a]); },
    mark(o){ if (fixed || seenSet.has(o.id)) return; seenSet.add(o.id); seen.push(o.id); if (seen.length > SEEN_CAP) seenSet.delete(seen.shift()); AS.store.set("practice.seen", seen); } };
  return S;
}
/* regions ordered by centroid distance from each region: neighbours make honest distractors */
let _near = null;
const nearRegions = id => { if (!_near){ _near = {}; for (const a of AS.REGIONS) _near[a.id] = AS.REGIONS.filter(b => b.id !== a.id).map(b => [AS.geo.havKm(a.lon, a.lat, b.lon, b.lat), b.id]).sort((x, y) => x[0] - y[0]).map(x => x[1]); } return _near[id] || []; };

/* ============================ question generators ============================ */
const GEN = {
  async place(S){
    for (let k = 0; k < 14; k++){ const o = S.pick(); if (!o) return null; if (await ensure(o)) return { kind:"place", o, objs:[o] }; }
    return null;
  },
  async older(S, st){
    for (let k = 0; k < 10; k++){
      const a = S.pick(); if (!a) return null; if (!(await ensure(a))) continue;
      for (let j = 0; j < 4; j++){
        const pool = S.base.filter(b => b.id !== a.id && S.ok(b) && (b.y0 > a.y1 || a.y0 > b.y1) && (!st.same || b.region === a.region));
        if (!pool.length) break;
        const d = b => Math.abs(b.mid - a.mid), t1 = pool.filter(b => d(b) >= st.gap && d(b) <= st.gap * 1.9 + 60), t2 = pool.filter(b => d(b) >= st.gap);
        const b = S.from(t1.length ? t1 : t2.length ? t2 : pool.slice().sort((x, y) => Math.abs(d(x) - st.gap) - Math.abs(d(y) - st.gap)).slice(0, 4)); if (!b) break;
        if (!(await ensure(b))) continue;
        const flip = S.rng() < .5; return { kind:"older", a:flip ? b : a, b:flip ? a : b, objs:[a, b], years:Math.round(d(b)) };
      }
      S.used.delete(a.id);
    }
    return null;
  },
  async lineup(S, st, i){
    const want = st.lineN++ % 2 === 0 ? "region" : "era", hard = i >= st.total / 2;
    for (const kind of [want, want === "region" ? "era" : "region"]) for (let k = 0; k < 6; k++){
      let T, cands, prompt, label, color, age = null, era = null;
      if (kind === "region"){
        T = S.pick(); if (!T) break; const reg = AS.region(T.region); label = reg.name; color = reg.color;
        const near = nearRegions(T.region), ring = shuffleR(near.slice(0, 4), S.rng).concat(near.slice(4)), out = [];
        for (const rid of ring){ if (out.length >= 5) break; const pool = objects().filter(o => o.region === rid && S.ok(o)); if (!pool.length) continue;
          const close = pool.filter(o => Math.abs(o.eraMid - T.eraMid) <= 2), mid = pool.filter(o => Math.abs(o.eraMid - T.eraMid) <= 5); const o = S.from(close.length ? close : mid.length ? mid : pool); if (o) out.push(o); }
        cands = out;
      } else {
        const tight = hard ? (o => o.eras.length === 1) : (o => ageIdx(o.eras[0]) === ageIdx(o.eras[o.eras.length - 1]));
        T = S.pick(tight); if (!T) break;
        let clash;
        if (hard){ era = T.eraMid; label = AS.eraLabel(era); color = AS.eraColor(era); clash = o => o.eras.includes(era); }
        else { age = AS.AGES[ageIdx(T.eraMid)]; label = `${ageSpan(age)}`; color = ageColor(age); clash = o => o.eras.some(e => e >= age.from && e <= age.to); }
        const pool = objects().filter(o => S.ok(o) && !clash(o)), same = pool.filter(o => o.region === T.region), nb = new Set(nearRegions(T.region).slice(0, 3)), nbp = pool.filter(o => nb.has(o.region));
        const tier = hard ? [same.filter(o => Math.abs(o.eraMid - era) <= 3), nbp.filter(o => Math.abs(o.eraMid - era) <= 3), same, pool] : [same, nbp, pool];
        cands = []; const eraSeen = new Set();
        for (const t of tier){ let guard = 0; while (cands.length < 5 && guard++ < 12){ const o = S.from(t.filter(x => !eraSeen.has(x.eraMid) || t === pool)); if (!o) break; eraSeen.add(o.eraMid); cands.push(o); } if (cands.length >= 5) break; }
      }
      const okT = await ensure(T, "thumb"); const good = []; for (const o of cands){ if (good.length >= 3) { S.used.delete(o.id); continue; } if (await ensure(o, "thumb")) good.push(o); }
      if (!okT || good.length < 3){ good.forEach(o => S.used.delete(o.id)); continue; }
      return { kind:"lineup", ask:kind, T, label, color, age, era, hard, opts:shuffleR([T].concat(good), S.rng), objs:[T].concat(good) };
    }
    return null;
  }
};

/* ============================ lightbox ============================ */
let closeLightbox = () => {};
function lightbox(o, caption){
  closeLightbox();
  let s = 1, tx = 0, ty = 0, drag = null, moved = false;
  const img = h("img", { src:o.img, alt:"", draggable:"false", referrerpolicy:"no-referrer" });
  const stage = h("div.pr-lb-stage", {}, img), pct = h("span.mono", {}, "100%");
  const apply = () => { const r = stage.getBoundingClientRect(), mx = (s - 1) * r.width / 2 + 80, my = (s - 1) * r.height / 2 + 80; if (s <= 1.001){ s = 1; tx = ty = 0; } else { tx = AS.clamp(tx, -mx, mx); ty = AS.clamp(ty, -my, my); }
    img.style.transform = `translate(${tx}px,${ty}px) scale(${s})`; pct.textContent = Math.round(s * 100) + "%"; stage.classList.toggle("zoomed", s > 1); };
  const zoomAt = (k, cx, cy) => { const ns = AS.clamp(s * k, 1, 7), f = ns / s; tx = cx - (cx - tx) * f; ty = cy - (cy - ty) * f; s = ns; apply(); };
  const rel = e => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2]; };
  stage.addEventListener("wheel", e => { e.preventDefault(); const [cx, cy] = rel(e); zoomAt(Math.exp(-e.deltaY * (e.deltaMode ? .05 : .0018)), cx, cy); }, { passive:false });
  stage.addEventListener("pointerdown", e => { drag = { x:e.clientX, y:e.clientY, tx, ty }; moved = false; try { stage.setPointerCapture(e.pointerId); } catch(_){} });
  stage.addEventListener("pointermove", e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; if (s > 1){ tx = drag.tx + dx; ty = drag.ty + dy; img.style.transition = "none"; apply(); } });
  const up = e => { if (!drag) return; drag = null; img.style.transition = ""; if (!moved){ if (s > 1){ s = 1; apply(); } else if (e.target === stage) close(); else { const [cx, cy] = rel(e); zoomAt(2.6, cx, cy); } } };
  stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", () => { drag = null; });
  const bar = h("div.pr-lb-bar.glass", {}, h("button.btn.ghost.icon", { type:"button", title:"Zoom out (−)", onclick:() => zoomAt(1 / 1.6, 0, 0) }, "−"), pct, h("button.btn.ghost.icon", { type:"button", title:"Zoom in (+)", onclick:() => zoomAt(1.6, 0, 0) }, "+"),
    h("span.pr-lb-hint", {}, "scroll to zoom · drag to pan · click to toggle"), h("button.btn.sm", { type:"button", onclick:() => close() }, "Close ", h("span.kbd", {}, "Esc")));
  const root = h("div.pr-lb", { role:"dialog", "aria-label":"Inspect object" }, stage, caption ? h("div.pr-lb-cap.glass", {}, caption) : null, bar);
  const onKey = e => { e.stopPropagation(); if (e.key === "Escape" || e.key === "z" || e.key === "Z" || e.key === "Enter"){ e.preventDefault(); close(); } else if (e.key === "+" || e.key === "="){ zoomAt(1.6, 0, 0); } else if (e.key === "-"){ zoomAt(1 / 1.6, 0, 0); } else if (e.key === "0"){ s = 1; apply(); } };
  function close(){ document.removeEventListener("keydown", onKey, true); root.remove(); closeLightbox = () => {}; }
  document.addEventListener("keydown", onKey, true); document.body.append(root); closeLightbox = close;
  const hi = hires(o); if (hi) loadImg(hi).then(ok => { if (ok && root.isConnected) img.src = hi; });
}

/* an object image in a frame, with skeleton shimmer until it paints */
function frame(o, which = "img"){
  const img = h("img", { alt:"Object to identify", draggable:"false", referrerpolicy:"no-referrer" }), box = h("div.pr-frame.loading", {}, h("div.pr-skel"), img);
  img.onload = () => box.classList.remove("loading"); img.onerror = () => { dead.add(o.id); box.classList.add("broken"); }; img.src = o[which];
  if (img.complete && img.naturalWidth) box.classList.remove("loading");
  return box;
}
const museumLink = o => o.url ? h("a.pr-ext", { href:o.url, target:"_blank", rel:"noopener" }, "View at museum", h("i", { html:ICON.ext })) : null;
const dateChip = o => h("span.era-chip", { style:{ "--c":AS.eraColor(o.eraMid) } }, o.dateLabel);

/* ============================ reveal content ============================ */
function tellsFor(o){
  /* Only tells that could plausibly apply to this object: same region and overlapping dates, AND the same kind of thing
     (the tell's medium matches the object's type, or they share a material word such as "jade" or "bronze"), AND pinned
     within ~1,500 km. A tell about calligraphy must not show up under a textile just because both are Moroccan. */
  const T = (DATA().tells && DATA().tells.tells) || []; if (!Array.isArray(T)) return [];
  const med = TYPE2MED[o.type], STOP = new Set(["other", "with", "from", "overall", "glazed", "painted", "decoration", "decorated", "carved", "traces", "paint", "color", "colour", "inlaid", "inlay"]);
  const words = String(o.medium || "").toLowerCase().split(/[^a-z]+/).filter(w => w.length > 3 && !STOP.has(w));
  return T.filter(t => t && t.id && t.place && t.place.region === o.region && Array.isArray(t.years) && t.years[0] <= o.y1 && t.years[1] >= o.y0).map(t => {
    const txt = String((t.title || "") + " " + (t.cue || "") + " " + (t.tags || []).join(" ")).toLowerCase();
    const sameKind = !!med && t.medium === med, shared = words.some(w => new RegExp("\\b" + w).test(txt));
    const km = Number.isFinite(+t.place.lat) ? AS.geo.havKm(o.lon, o.lat, +t.place.lon, +t.place.lat) : 9e9;
    if (!(sameKind || shared) || km > 1500) return null;
    let sc = (+t.strength || 0) + (sameKind ? 6 : 0) + (shared ? 5 : 0) + (km < 400 ? 5 : km < 900 ? 2 : 0); if (o.country && String(t.place.label || "").includes(o.country)) sc += 4;
    return [sc, t]; }).filter(Boolean).sort((a, b) => b[0] - a[0]).slice(0, 3).map(x => x[1]);
}
function placeReveal(o, res){
  const box = h("div.pr-reveal");
  box.append(h("h3.pr-title", {}, o.title), h("div.pr-meta", {}, [o.culture, o.type, cut(o.medium, 90)].filter(Boolean).join(" · ")));
  if (o.dateText && o.dateText !== o.dateLabel) box.append(h("div.pr-meta.pr-datetext", {}, "Museum date: ", h("b", {}, cut(o.dateText, 110))));
  const tags = h("div.row.wrap", { style:{ gap:"6px" } }, AS.ui.regionTag(o.region), dateChip(o));
  if (res && res.regionGuess && res.regionGuess !== o.region && res.pinPts < 5000) tags.append(h("span.pr-miss", {}, "your pin: ", AS.region(res.regionGuess).short));
  box.append(tags);
  if (o.geoPrecision === "country" || o.geoPrecision === "culture") box.append(h("div.pr-geo", {}, `Located to ${o.geoPrecision} level only — full marks within ${AS.fmtN(o.r_km)} km.`));
  const tells = tellsFor(o);
  if (tells.length){ box.append(h("div.eyebrow", { style:{ marginTop:"6px" } }, "Tells for this kind of object, here and then"));
    box.append(h("div.pr-tells", {}, tells.map(t => h("a.pr-tell", { href:AS.href("tells", { id:t.id }) }, h("div.row.between", {}, h("b", {}, t.title || t.id), AS.ui.pips(+t.strength || 0)), h("span", {}, cut(t.infer || t.cue, 120)))))); }
  else box.append(h("div.muted", { style:{ fontSize:"12.5px" } }, h("a", { href:AS.href("tells", { region:o.region }) }, `Browse ${AS.region(o.region).short} tells`), " (none on file for this kind of object)."));
  box.append(h("div.pr-credit", {}, h("span", {}, o.credit || SRC[o.src] || ""), museumLink(o)));
  return box;
}

/* ============================ question renderers ============================ */
const SHOW = {
  place(q, body, hk){
    const o = q.o, fr = frame(o); let revealed = false;
    const cap = () => revealed ? h("div", {}, h("b", {}, o.title), h("div.muted", {}, `${o.place} · ${o.dateLabel}`)) : null;
    const media = h("div.pr-obj", { role:"button", tabindex:"0", title:"Inspect up close (Z)", onclick:() => lightbox(o, cap()) }, fr, h("span.pr-zoomhint", {}, h("i", { html:ICON.zoom }), "Inspect", h("span.kbd", {}, "Z")));
    const task = Q.placeTask(body, { media, prompt:"Where and when was this made?", hint:"Look closely first: click the picture to zoom.",
      truth:{ lon:o.lon, lat:o.lat, r_km:o.r_km, label:o.place, eras:o.eras, dateLabel:o.dateLabel }, mapYear:AS.MODERN_MAP, revealYear:AS.ERA2MAP[o.eraMid],
      reveal:res => placeReveal(o, res), nextLabel:hk.last ? "See results" : "Next", onNext:hk.next,
      onDone(res){ revealed = true; const g = res.eraGuess, era = g == null ? o.eraMid : o.eras.reduce((b, e) => Math.abs(e - g) < Math.abs(b - g) ? e : b, o.eras[0]);
        AS.log.add({ mode:"place", kind:"pin+era", region:o.region, regionGuess:res.regionGuess, era, eraGuess:res.eraGuess, km:res.km == null ? null : Math.round(res.km), pts:res.pts, max:res.max, ok:res.pts / res.max >= .6, ref:o.id });
        hk.done(res, { label:o.title, note:`${o.place} · ${o.dateLabel}`, pts:res.pts, max:res.max }); } });
    const onKey = e => { if ((e.key === "z" || e.key === "Z") && !e.metaKey && !e.ctrlKey && task.el.isConnected){ e.preventDefault(); lightbox(o, cap()); } };
    document.addEventListener("keydown", onKey);
    return { destroy(){ document.removeEventListener("keydown", onKey); task.destroy(); } };
  },

  older(q, body, hk){
    const st = hk.st, pair = [q.a, q.b], olderIdx = q.a.mid < q.b.mid ? 0 : 1; let done = false;
    const lvl = 1 - AS.clamp((Math.log(st.gap) - Math.log(150)) / (Math.log(1500) - Math.log(150)), 0, 1);
    const gapEl = h("div.pr-gap", { title:"Right answers shrink the minimum gap between the pair; misses relax it." }, h("span", {}, "minimum gap"), h("b.mono", {}, AS.fmtN(st.gap) + " yr"), h("div.pr-gapbar", {}, h("i", { style:{ width:(8 + 92 * lvl) + "%" } })));
    const seg = hk.daily ? null : AS.ui.seg([{ value:"0", label:"Any region" }, { value:"1", label:"Same region only", title:"Both objects from one region — you have to date within a tradition." }], st.same ? "1" : "0", v => { st.same = v === "1"; setP({ same:st.same ? "1" : null }); hk.refetch(); AS.toast(st.same ? "Same-region pairs from the next question" : "Mixed-region pairs from the next question"); });
    const panes = pair.map((o, i) => { const p = h("div.pr-pane", { role:"button", tabindex:"0", "aria-label":i ? "Right object" : "Left object", onclick:() => pick(i), onkeydown:e => { if (e.key === " "){ e.preventDefault(); pick(i); } } },
        frame(o), h("span.kbd.pr-pane-k", {}, i ? "→" : "←"), h("button.pr-pane-zoom", { type:"button", title:"Inspect up close", onclick:e => { e.stopPropagation(); lightbox(o, done ? h("div", {}, h("b", {}, o.title), h("div.muted", {}, `${o.place} · ${o.dateLabel}`)) : null); }, html:ICON.zoom })); return p; });
    const foot = h("div.pr-duel-foot");
    const root = h("div.pr-duel", {}, h("div.pr-duel-head", {}, h("h3", {}, "Which is older?"), h("div.grow"), seg, gapEl), h("div.pr-panes", {}, panes), foot); body.append(root);
    function timeline(){ const x = y => AS.clamp((y + 3000) / 50, 0, 100), tl = h("div.pr-tl"), strip = h("div.pr-tl-strip"); for (let e = 0; e < 20; e++) strip.append(h("i", { style:{ background:AS.eraColor(e) } }));
      tl.append(strip); for (const y of [-3000, -2000, -1000, 0, 1000, 2000]) tl.append(h("span.pr-tl-tick.mono", { style:{ left:x(y) + "%" } }, y === 0 ? "1" : y < 0 ? `${-y} BCE` : String(y)));
      pair.forEach((o, i) => { const l = x(o.y0), r = x(o.y1), c = AS.eraColor(o.eraMid), m = (l + r) / 2;
        tl.append(h("div.pr-tl-mark" + (i ? ".below" : ".above") + (m > 60 ? ".flip" : ""), { style:{ left:m + "%", "--c":c } }, h("b", {}, (i ? "right · " : "left · ") + o.dateLabel)), h("i.pr-tl-span", { style:{ left:l + "%", width:`max(4px, ${r - l}%)`, "--c":c } })); });
      return tl; }
    function pick(i){ if (done) return; done = true; const ok = i === olderIdx, gapWas = st.gap;
      st.gap = ok ? Math.max(150, Math.round(st.gap * .72 / 10) * 10) : Math.min(2000, Math.round(st.gap * 1.35 / 10) * 10); if (ok) st.minGap = Math.min(st.minGap || 1e9, q.years);
      root.classList.add("revealed"); panes.forEach((p, j) => { const o = pair[j]; p.classList.add(j === olderIdx ? "is-older" : "is-newer"); if (j === i) p.classList.add(ok ? "picked-ok" : "picked-no");
        p.append(h("div.pr-pane-cap", {}, h("div.row.wrap", { style:{ gap:"6px" } }, h("span.pr-badge", {}, j === olderIdx ? "older" : "newer"), dateChip(o), AS.ui.regionTag(o.region)), h("b", {}, o.title), h("span", {}, o.place), museumLink(o))); });
      const older = pair[olderIdx]; AS.log.add({ mode:"older", kind:"duel", region:older.region, ok, pts:ok ? 5000 : 0, max:5000, ref:q.a.id + "|" + q.b.id, gap:q.years });
      foot.append(timeline(), h("div.row.between.pr-verdict", {}, h("div", {}, h("div.qc-verdict" + (ok ? ".ok" : ".no"), {}, ok ? "Correct" : "Not quite"), h("div.muted", { style:{ fontSize:"13px" } }, `${AS.fmtN(Math.round(q.years / 10) * 10)} years apart · minimum gap ${AS.fmtN(gapWas)} → ${AS.fmtN(st.gap)}`)),
        h("button.btn.primary.lg", { type:"button", onclick:hk.next }, hk.last ? "See results" : "Next")));
      hk.done({ pts:ok ? 5000 : 0, max:5000, ok }, { label:`${cut(q.a.title, 30)} / ${cut(q.b.title, 30)}`, note:`${AS.fmtN(Math.round(q.years / 10) * 10)} yr apart`, pts:ok ? 5000 : 0, max:5000 }); }
    const onKey = e => { if (!root.isConnected || e.metaKey || e.ctrlKey) return; if (!done && (e.key === "ArrowLeft" || e.key === "ArrowRight")){ e.preventDefault(); pick(e.key === "ArrowLeft" ? 0 : 1); } else if (done && e.key === "Enter"){ e.preventDefault(); hk.next(); } };
    document.addEventListener("keydown", onKey);
    return { destroy(){ document.removeEventListener("keydown", onKey); root.remove(); } };
  },

  lineup(q, body, hk){
    const T = q.T, prompt = h("span", {}, q.ask === "region" ? "Which of these was made in " : "Which was made in ", h("b.pr-hl", { style:{ "--c":q.color } }, q.label), "?");
    const hint = q.ask === "region" ? "The other three come from neighbouring regions." : q.age ? `That is the mnemonic "${q.age.name}" band. The others fall outside it.` : "One 250-year era. The others are from nearby eras.";
    const wrap = h("div.pr-lineup"); body.append(wrap);
    const task = Q.choiceTask(wrap, { prompt, hint, columns:4, nextLabel:hk.last ? "See results" : "Next", onNext:hk.next,
      options:q.opts.map(o => ({ node:h("div.pr-opt", {}, frame(o, "thumb")), correct:o.id === T.id, note:`${o.place} · ${o.dateLabel}` })),
      reveal:() => h("div.pr-reveal.inline", {}, h("div", {}, h("b.pr-title", {}, T.title), h("div.pr-meta", {}, [T.culture, T.type, cut(T.medium, 70)].filter(Boolean).join(" · "))), h("div.row.wrap", { style:{ gap:"6px" } }, AS.ui.regionTag(T.region), dateChip(T), museumLink(T))),
      onDone(res){ AS.log.add({ mode:"lineup", kind:q.ask, region:T.region, era:T.eraMid, ok:res.ok, pts:res.pts, max:5000, ref:T.id });
        hk.done({ pts:res.pts, max:5000, ok:res.ok }, { label:(q.ask === "region" ? "Region: " : "Era: ") + q.label, note:cut(T.title, 40), pts:res.pts, max:5000 }); } });
    return { destroy(){ task.destroy(); wrap.remove(); } };
  }
};

/* ============================ round engine ============================ */
const stats = () => AS.store.get("practice.stats", {});
const keyOf = p => JSON.stringify(Object.keys(p).sort().map(k => [k, p[k]]));
/* AS.setParams does not call update(); keep the view's render key in step so a later hashchange is not mistaken for a no-op */
const setP = o => { AS.setParams(o); if (AS.views.practice) AS.views.practice.key = keyOf(AS.params()); };
function engine(host, params, ctx, cfg){
  const focus = cfg.daily ? { regions:null, ages:null, weak:false } : parseFocus(params), total = cfg.plan.length;
  const wrap = h("div.pr-run"); host.append(wrap);
  let gone = false, gen = 0, task = null, round = null, S = null, st = null, i = 0, rows = [], nextP = null;
  const prep = k => GEN[cfg.plan[k]](S, st, k).catch(e => { console.error(e); return null; });
  const kill = () => { if (task){ try { task.destroy(); } catch(e){ console.error(e); } task = null; } };
  function start(){
    kill(); if (round) round.destroy(); closeLightbox(); gen++;
    S = makeSampler(focus, cfg.daily ? mulberry(daySeed()) : Math.random, !!cfg.daily);
    st = { gap:1500, same:!cfg.daily && params.same === "1", total, lineN:0, focus };
    i = 0; rows = []; nextP = null;
    round = Q.round(wrap, { title:cfg.title, total, accent:cfg.accent, onExit:ctx.exit });
    if (S.widened) AS.toast(S.widened, 4200);
    step();
  }
  function step(){
    if (i >= total) return finish();
    const body = round.begin(i), sk = h("div.pr-wait", {}, h("div.pr-skel"), h("span", {}, "Fetching from the museum…")); body.append(sk);
    const p = nextP || prep(i), my = gen, at = i; nextP = null;
    p.then(q => { if (gone || my !== gen || at !== i) return; sk.remove();
      if (!q) return rows.length ? finish("The focus ran out of objects, so the round ends here.") : starve(body);
      q.objs.forEach(S.mark);
      const eager = () => { if (at + 1 < total && !nextP) nextP = prep(at + 1); };
      task = SHOW[q.kind](q, body, { st, daily:!!cfg.daily, last:at === total - 1, refetch(){ nextP = null; },
        done(res, row){ round.award(res.pts, res.max, res.ok); rows.push(row); eager(); },
        next(){ if (gone || my !== gen || at !== i) return; kill(); i++; step(); } });
      if (cfg.plan[at + 1] && cfg.plan[at + 1] !== "older") eager(); });
  }
  function starve(body){ body.append(h("div.pr-starve", {}, h("div.eyebrow", {}, "Nothing to show"), h("h2", {}, objects().length ? "That focus is too narrow." : "The practice gallery is not loaded."),
    h("p.muted", {}, objects().length ? "No objects match, or their images would not load. Widen the focus, or check the connection: pictures are fetched live from the museums." : "data/gallery.js has no objects yet. Run build/pack.py once the gallery has been built."),
    h("button.btn.primary", { type:"button", onclick:ctx.exit }, "Back to practice"))); }
  function finish(note){
    kill(); const s = stats(), me = s[cfg.id] || { plays:0, best:0 }, score = round.score, max = round.max;
    const record = rows.length === total && score > (me.best || 0) && me.plays > 0;
    if (rows.length === total){ s[cfg.id] = { plays:(me.plays || 0) + 1, best:Math.max(me.best || 0, score), last:score, max }; AS.store.set("practice.stats", s);
      if (cfg.daily){ const d = AS.store.get("practice.daily", {}); AS.store.set("practice.daily", { day:AS.log.day(), pts:d.day === AS.log.day() ? Math.max(d.pts || 0, score) : score, max }); } }
    const extra = h("div.pr-fin", {}, record ? h("span.pr-record", {}, "New best") : null, note ? h("span.muted", {}, note) : null,
      cfg.id === "older" && st.minGap < 1e9 ? h("span.muted", {}, "Tightest pair you called: ", h("b.mono", {}, AS.fmtN(Math.round(st.minGap / 10) * 10) + " yr")) : null,
      cfg.daily ? h("span.muted", {}, "Same draw until midnight. Every answer went into your calibration.") : h("a", { href:AS.href("practice", Object.assign({ show:"residuals" }, focusParams(focus))) }, "See what this did to your calibration"));
    round.finish({ rows, onAgain:start, extra });
  }
  start();
  return { destroy(){ gone = true; kill(); if (round) round.destroy(); closeLightbox(); wrap.remove(); } };
}
const enough = () => objects().length >= 12;
const NOTE = "The practice gallery is not packed yet (data/gallery.js is empty).";
const rep = (k, n) => Array(n).fill(k);
[ { id:"daily", title:"Daily mix", blurb:"Eight objects, three games, one fixed draw per day.", accent:"#ecbd4f", glyph:ICON.daily, featured:true, daily:true, plan:["place", "older", "lineup", "place", "lineup", "older", "place", "lineup"] },
  { id:"place", title:"Place & date", blurb:"The real game on objects you have never seen: drop a pin, pick an era. Five per round.", accent:"#3fd08f", glyph:ICON.place, plan:rep("place", 5) },
  { id:"older", title:"Older or newer?", blurb:"Two objects, one question. The gap between them shrinks every time you get it right.", accent:"#5b86ff", glyph:ICON.older, plan:rep("older", 10), variants:[{ label:"Same region only", params:{ same:"1" } }] },
  { id:"lineup", title:"Which one is from…?", blurb:"Four objects in a row; pick the one from the named region or era. The decoys are neighbours.", accent:"#c56bd6", glyph:ICON.lineup, plan:rep("lineup", 8) }
].forEach(cfg => Q.register(Object.assign({ group:GROUP, available:enough, unavailableNote:NOTE, start:(host, params, ctx) => engine(host, params || {}, ctx || { exit(){ AS.go("practice"); } }, cfg) }, cfg)));

/* ============================ calibration dashboard ============================ */
function calc(log){
  const c = { n:log.length, fr:[], km:[], kmR:{}, biasA:{}, biasR:{}, conf:Array.from({ length:20 }, () => Array(20).fill(0)), confN:Array(20).fill(0), eraN:0, rc:{}, cell:{} };
  for (const e of log){ if (!e) continue; const f = fracOf(e), reg = e.region && AS.REGIONS.some(r => r.id === e.region) ? e.region : null; if (f != null) c.fr.push(f);
    const km = e.km == null ? NaN : +e.km; if (Number.isFinite(km)){ c.km.push(km); if (reg) (c.kmR[reg] = c.kmR[reg] || []).push(km); }
    const era = e.era == null ? NaN : +e.era, g = e.eraGuess == null ? NaN : +e.eraGuess, eraOk = Number.isInteger(era) && era >= 0 && era < 20;
    if (eraOk && Number.isInteger(g) && g >= 0 && g < 20){ c.conf[era][g]++; c.confN[era]++; c.eraN++; (c.biasA[ageIdx(era)] = c.biasA[ageIdx(era)] || []).push(g - era); if (reg) (c.biasR[reg] = c.biasR[reg] || []).push(g - era); }
    if (reg && e.regionGuess){ const m = c.rc[reg] = c.rc[reg] || { n:0, to:{} }; m.n++; m.to[e.regionGuess] = (m.to[e.regionGuess] || 0) + 1; }
    if (reg && eraOk && f != null){ const k = reg + "|" + ageIdx(era), x = c.cell[k] = c.cell[k] || { region:reg, age:ageIdx(era), n:0, sum:0 }; x.n++; x.sum += f; } }
  return c;
}
const tipOn = (el, html) => { el.addEventListener("mousemove", e => AS.tip.show(e, typeof html === "function" ? html() : html)); el.addEventListener("mouseleave", AS.tip.hide); return el; };
const thin = n => n < 3;
function panel(title, sub, body, cls){ return h("section.pr-panel" + (cls ? "." + cls : ""), {}, h("header", {}, h("h4", {}, title), sub ? h("span", {}, sub) : null), body); }

function pinChart(c){
  const rows = AS.REGIONS.filter(r => c.kmR[r.id]).map(r => ({ r, n:c.kmR[r.id].length, v:median(c.kmR[r.id]) })).sort((a, b) => b.v - a.v);
  if (!rows.length) return h("div.pr-none", {}, "No pins dropped yet. Play Place & date.");
  const x = km => 100 * AS.clamp((Math.log10(Math.max(10, km)) - 1) / 3, 0, 1), box = h("div.pr-bars");
  const axis = h("div.pr-axis", {}, [[50, "50 km"], [500, "500"], [5000, "5,000"]].map(([k, l]) => h("span" + (k === 50 ? ".good" : ""), { style:{ left:x(k) + "%" } }, l)));
  box.append(h("div.pr-brow.head", {}, h("span"), axis, h("span"), h("span")));
  for (const d of rows){ const row = h("div.pr-brow" + (thin(d.n) ? ".thin" : ""), {}, h("span.pr-blabel", {}, h("i", { style:{ background:d.r.color } }), d.r.short),
      h("div.pr-track", {}, h("u", { style:{ left:x(50) + "%" } }), h("i", { style:{ width:Math.max(1.500, x(d.v)) + "%", background:d.r.color } })), h("b.mono", {}, AS.fmtN(d.v) + " km"), h("span.pr-n.mono", {}, "n " + d.n));
    tipOn(row, `<div class="t">${AS.esc(d.r.name)}</div><div class="kv"><span>median pin error</span><span>${AS.fmtN(d.v)} km</span><span>best</span><span>${AS.fmtN(Math.min(...c.kmR[d.r.id]))} km</span><span>worst</span><span>${AS.fmtN(Math.max(...c.kmR[d.r.id]))} km</span><span>answers</span><span>${d.n}</span></div>${thin(d.n) ? '<div class="s">Fewer than 3 answers: not a pattern yet.</div>' : ""}`); box.append(row); }
  return box;
}
function biasChart(c, by){
  const src = by === "region" ? c.biasR : c.biasA;
  const groups = (by === "region" ? AS.REGIONS.map(r => ({ k:r.id, name:r.short, long:r.name, color:r.color })) : AS.AGES.map((a, i) => ({ k:i, name:a.name, long:`${a.name} (${ageSpan(a)})`, color:ageColor(a) }))).filter(g => src[g.k]).map(g => Object.assign(g, { n:src[g.k].length, v:mean(src[g.k]) }));
  if (!groups.length) return h("div.pr-none", {}, "No dated answers yet.");
  const box = h("div.pr-bars.bias"), R = 3;
  box.append(h("div.pr-brow.head", {}, h("span"), h("div.pr-axis.div", {}, h("span", { style:{ left:"0" } }, "← too early"), h("span", { style:{ left:"50%" } }, "0"), h("span", { style:{ left:"100%" } }, "too late →")), h("span"), h("span")));
  for (const g of groups){ const w = 50 * AS.clamp(Math.abs(g.v) / R, 0, 1), late = g.v > 0;
    const row = h("div.pr-brow" + (thin(g.n) ? ".thin" : ""), {}, h("span.pr-blabel", {}, h("i", { style:{ background:g.color } }), g.name),
      h("div.pr-track.div", {}, h("u", { style:{ left:"50%" } }), h("i" + (late ? ".late" : ".early"), { style:{ width:Math.max(.8, w) + "%", [late ? "left" : "right"]:"50%" } })), h("b.mono", {}, (g.v > 0 ? "+" : g.v < 0 ? "−" : "") + Math.abs(g.v).toFixed(1)), h("span.pr-n.mono", {}, "n " + g.n));
    tipOn(row, `<div class="t">${AS.esc(g.long)}</div><div class="s">mean signed error ${g.v > 0 ? "+" : ""}${g.v.toFixed(2)} eras (≈ ${AS.fmtN(Math.abs(g.v) * 250)} years ${late ? "late" : "early"}) over ${g.n} answer${g.n === 1 ? "" : "s"}${thin(g.n) ? " — too few to trust" : ""}</div>`); box.append(row); }
  return box;
}
function biasRead(c){
  const all = []; for (const r of AS.REGIONS) if (c.biasR[r.id] && c.biasR[r.id].length >= 3) all.push({ name:r.name, v:mean(c.biasR[r.id]) });
  AS.AGES.forEach((a, i) => { if (c.biasA[i] && c.biasA[i].length >= 3) all.push({ name:`the ${a.name}`, v:mean(c.biasA[i]) }); });
  if (!all.length) return c.eraN ? "Too few dated answers per group to call a lean (need 3)." : "Date a few objects and the lean shows up here.";
  const w = all.sort((a, b) => Math.abs(b.v) - Math.abs(a.v))[0];
  if (Math.abs(w.v) < .35) return "No systematic lean: your date misses are scatter, not bias.";
  return `You date ${w.name} ~${Math.abs(w.v).toFixed(1)} eras too ${w.v > 0 ? "late" : "early"} — about ${AS.fmtN(Math.round(Math.abs(w.v) * 250 / 50) * 50)} years.`;
}
function heatmap(c){
  const g = h("div.pr-heat"); const mx = Math.max(1, ...c.conf.map(r => Math.max(...r)));
  for (let t = 0; t < 20; t++){ const s = AS.eraStart(t);
    g.append(h("span.pr-hy.mono" + (thin(c.confN[t]) ? ".thin" : ""), { style:{ "--c":AS.eraColor(t) } }, t % 2 === 0 ? (s === 0 ? "1" : String(Math.abs(s))) : ""));
    for (let q = 0; q < 20; q++){ const n = c.conf[t][q], cell = h("i" + (t === q ? ".diag" : "") + (n ? ".has" : "") + (thin(c.confN[t]) ? ".thin" : ""), { style:n ? { "--a":(.22 + .78 * n / mx).toFixed(3) } : null }, n ? h("em.mono", {}, String(n)) : null);
      tipOn(cell, () => `<div class="t">True ${AS.eraLabel(t)}</div><div class="s">guessed ${AS.eraLabel(q)}${t === q ? " (exact)" : ` · ${Math.abs(q - t)} era${Math.abs(q - t) > 1 ? "s" : ""} too ${q > t ? "late" : "early"}`}</div><div class="kv"><span>answers</span><span>${n} of ${c.confN[t]}</span></div>${c.confN[t] && thin(c.confN[t]) ? '<div class="s">Row has fewer than 3 answers.</div>' : ""}`); g.append(cell); } }
  g.append(h("span")); for (let q = 0; q < 20; q++) g.append(h("span.pr-hx", { style:{ background:AS.eraColor(q) } }));
  g.append(h("span")); for (let q = 0; q < 20; q++){ const s = AS.eraStart(q); g.append(h("span.pr-hxl.mono", {}, q % 4 === 0 ? (s === 0 ? "1 CE" : s < 0 ? `${-s}` : String(s)) : "")); }
  return h("div.pr-heatwrap", {}, h("div.pr-heat-ylab", {}, "true era ↓"), g, h("div.pr-heat-xlab", {}, "guessed era →  ·  the outlined diagonal is exact  ·  left of it you guessed too early"));
}
function regionConf(c){
  const rows = AS.REGIONS.filter(r => c.rc[r.id]).map(r => { const m = c.rc[r.id], right = (m.to[r.id] || 0) / m.n, wrong = Object.keys(m.to).filter(k => k !== r.id).map(k => [m.to[k] / m.n, k]).sort((a, b) => b[0] - a[0]).slice(0, 2); return { r, n:m.n, right, wrong }; }).sort((a, b) => a.right - b.right);
  if (!rows.length) return h("div.pr-none", {}, "No pins dropped yet.");
  const box = h("div.pr-rc");
  for (const d of rows){ const bar = h("div.pr-stack", {}, d.right > 0 ? h("i", { style:{ width:100 * d.right + "%", background:d.r.color } }) : null, d.wrong.map(([f, k]) => h("i.w", { style:{ width:100 * f + "%", background:AS.regionColor(k) } })));
    const row = h("div.pr-rcrow" + (thin(d.n) ? ".thin" : ""), {}, h("span.pr-blabel", {}, h("i", { style:{ background:d.r.color } }), d.r.short), bar, h("b.mono", {}, Math.round(100 * d.right) + "%"),
      h("span.pr-rcto", {}, d.wrong.length ? ["→ ", d.wrong.map(([f, k], j) => [j ? ", " : "", h("span", {}, h("i", { style:{ background:AS.regionColor(k) } }), `${AS.region(k).short} ${Math.round(100 * f)}%`)])] : "never elsewhere"), h("span.pr-n.mono", {}, "n " + d.n));
    tipOn(row, `<div class="t">${AS.esc(d.r.name)}</div><div class="s">Where your pin landed for objects truly from here</div><div class="kv"><span>right region</span><span>${Math.round(100 * d.right)}%</span>${d.wrong.map(([f, k]) => `<span>${AS.esc(AS.region(k).name)}</span><span>${Math.round(100 * f)}%</span>`).join("")}<span>answers</span><span>${d.n}</span></div>`); box.append(row); }
  return box;
}
function weakCells(c){ return Object.values(c.cell).filter(x => x.n >= 3).map(x => Object.assign(x, { f:x.sum / x.n })).filter(x => x.f < .8).sort((a, b) => a.f - b.f).slice(0, 5); }
function weakList(c){
  const cells = weakCells(c); if (!cells.length) return h("div.pr-none", {}, c.n ? "Nothing qualifies yet: a weak spot needs 3 answers in one region and age band." : "Needs 3 answers in one region and age band.");
  return h("div.pr-weak", {}, cells.map(x => { const r = AS.region(x.region), a = AS.AGES[x.age];
    return h("div.pr-weakrow", { style:{ "--c":r.color } }, h("div", {}, h("b", {}, r.short), h("span", {}, ` · ${a.name}`), h("div.muted.mono", {}, `${Math.round(100 * x.f)}% of points · n ${x.n}`)),
      h("div.bar", { style:{ "--c":x.f < .35 ? "var(--bad)" : "var(--gold)" } }, h("i", { style:{ width:100 * x.f + "%" } })), h("a.btn.sm", { href:AS.href("practice", { mode:"place", region:x.region, ages:String(x.age) }) }, "Practice this")); }));
}
function ghost(){
  const g = h("div.pr-ghost-heat"); for (let t = 0; t < 12; t++) for (let q = 0; q < 12; q++){ const d = Math.abs(t - q), a = d === 0 ? .5 : d === 1 ? .2 : d === 2 && (t * 7 + q) % 3 === 0 ? .1 : 0; g.append(h("i", { style:a ? { background:`color-mix(in srgb, var(--gold) ${Math.round(a * 100)}%, transparent)` } : null })); }
  const bars = h("div.pr-ghost-bars"); [72, 55, 48, 33, 26, 14].forEach((w, i) => bars.append(h("i", { style:{ width:w + "%", background:AS.REGIONS[[0, 4, 7, 1, 11, 6][i]].color } })));
  return h("div.pr-empty", {}, h("div.pr-ghost", {}, bars, g), h("div.pr-empty-copy", {}, h("div.eyebrow", {}, "Calibration"), h("h3", {}, "No answers yet."),
    h("p", {}, "Answer a few questions and this fills in: how far your pins land by region, which way your dates lean, which eras you swap, and the cells worth drilling."),
    h("div.row.wrap", {}, Q.modes.place && Q.modes.place.available() ? h("a.btn.primary", { href:AS.href("practice", { mode:"place" }) }, "Play Place & date") : null, h("span.muted", { style:{ fontSize:"12.5px" } }, "Tells and Scripts quick tests count too."))));
}
function dashboard(params, rerender){
  const log = AS.log.all(), c = calc(log), box = h("div.pr-dash", { id:"pr-residuals" });
  const reset = h("button.btn.ghost.sm", { type:"button", onclick:() => { const m = AS.modal(h("div.pr-confirm", {}, h("h3", {}, "Reset history?"), h("p.muted", {}, `This deletes all ${AS.fmtN(log.length)} logged answers, so the calibration starts from nothing. Best scores and the streak stay.`),
    h("div.row", { style:{ justifyContent:"flex-end" } }, h("button.btn", { type:"button", onclick:() => m.close() }, "Keep it"), h("button.btn.pr-danger", { type:"button", onclick:() => { AS.log.clear(); m.close(); AS.toast("History cleared"); rerender(); } }, "Delete history"))), { width:440 }); } }, "Reset history");
  box.append(h("div.pr-sec", {}, h("div", {}, h("div.eyebrow", {}, "Calibration"), h("h2", {}, "Where you are off"), h("p.muted", {}, "Built from every answer in every room. Rows with fewer than three answers are greyed out.")), log.length ? reset : null));
  if (!log.length){ box.append(ghost()); return box; }
  const last = c.fr.slice(-50), med = median(c.km), streak = AS.log.streak();
  const tile = (v, label, sub) => h("div.pr-tile", {}, h("b", {}, v), h("span", {}, label), sub ? h("small", {}, sub) : null);
  box.append(h("div.pr-tiles", {}, tile(AS.fmtN(c.n), "answered", `${AS.fmtN(log.filter(e => AS.log.day(e.t) === AS.log.day()).length)} today`), tile(String(streak), streak === 1 ? "day streak" : "day streak", streak ? "keep it alive" : "play today to start one"),
    tile(last.length ? Math.round(100 * mean(last)) + "%" : "—", "of points", `last ${last.length} scored answers`), tile(med == null ? "—" : AS.fmtN(med), "km median pin error", med == null ? "no pins yet" : `${c.km.length} pins · 50 km is full marks`)));
  const by = params.bias === "region" ? "region" : "age", biasHost = h("div"), drawBias = v => { biasHost.innerHTML = ""; biasHost.append(biasChart(c, v)); };
  const seg = AS.ui.seg([{ value:"age", label:"By age" }, { value:"region", label:"By region" }], by, v => { setP({ bias:v === "region" ? "region" : null }); drawBias(v); }); drawBias(by);
  box.append(h("div.pr-grid", {},
    h("div.pr-stackcol", {}, panel("Pin error by region", "median km · log scale · dashed line = full marks", pinChart(c)),
      panel("Era confusion", `${AS.fmtN(c.eraN)} dated answers`, c.eraN ? heatmap(c) : h("div.pr-none", {}, "No dated answers yet."), "heat")),
    h("div.pr-stackcol", {}, panel("Era bias", "mean signed error, in eras", h("div", {}, h("div.pr-read", {}, biasRead(c)), h("div.row", { style:{ margin:"0 0 10px" } }, seg), biasHost)),
      panel("Region confusion", "where your pins land · solid = right region", regionConf(c)), panel("Weak spots", "worst region × age cells, n ≥ 3", weakList(c)))));
  return box;
}

/* ============================ hub ============================ */
function hub(el, params){
  const focus = parseFocus(params), objs = objects(), N = objs.length;
  const scroll = h("div.view-scroll"), page = h("div.page.pr-page"); scroll.append(page); el.append(scroll);
  const nSrc = new Set(objs.map(o => o.src)).size;
  /* header */
  const splits = h("div.pr-splits", { "aria-label":"Train, validation and test split" },
    h("div.pr-split", {}, h("span", {}, "train"), h("b", {}, "The other rooms"), h("small", {}, "priors, not pictures")),
    h("div.pr-split.on", {}, h("span", {}, "validation"), h("b", {}, N ? `${AS.fmtN(N)} objects` : "not loaded"), h("small", {}, N ? `${nSrc} other museum${nSrc === 1 ? "" : "s"} · you are here` : "run build/pack.py")),
    h("div.pr-split.locked", {}, h("span", {}, "test ", h("i", { html:ICON.lock })), h("b", {}, "The Met"), h("small", {}, "sealed · 0 objects here")));
  page.append(h("div.page-head", {}, h("div", {}, h("div.eyebrow", {}, "No overlap with the Met collection Anthropeum draws from!"), h("h1", {}, "Practice"),
    h("p.lede", {}, N ? `${AS.fmtN(N)} real objects from ${sourcesLine()}. None are from the Met, so practising here cannot spoil the real game.` : "The practice gallery has not been packed yet, so the picture games are closed."))));

  /* focus */
  const count = h("b.mono"), clear = h("button.btn.ghost.sm", { type:"button", onclick:() => { focus.regions = null; focus.ages = null; focus.weak = false; rc.set(new Set()); ac.set(new Set()); weakBtn.classList.remove("on"); sync(); } }, "Clear");
  const sync = () => { setP(focusParams(focus)); const n = objs.filter(o => inFocus(o, focus)).length, any = focus.regions || focus.ages || focus.weak;
    count.textContent = AS.fmtN(n); const low = N > 0 && n < 12; countWrap.classList.toggle("low", low);
    thinNote.textContent = !low ? "applies to whichever game you launch · nothing selected means everything" : `Only ${n} object${n === 1 ? "" : "s"} match${n === 1 ? "es" : ""}: too thin for a round, so games will drop the era filter (or widen further) and say so.`; thinNote.classList.toggle("pr-thin", low); clear.style.visibility = any ? "visible" : "hidden";
    page.querySelectorAll("a[data-mode]").forEach(a => { if (a.classList.contains("off")) return; a.href = AS.href("practice", Object.assign({ mode:a.dataset.mode }, a.dataset.daily ? {} : focusParams(focus), a.dataset.extra ? JSON.parse(a.dataset.extra) : {})); }); };
  const nR = {}; for (const o of objs) nR[o.region] = (nR[o.region] || 0) + 1;
  const rc = AS.ui.chips(AS.REGIONS.map(r => ({ value:r.id, label:r.short, color:r.color, n:N ? nR[r.id] || 0 : null })), new Set(focus.regions || []), v => { focus.regions = v.size ? new Set(v) : null; sync(); }, { multi:true });
  const ac = AS.ui.chips(AS.AGES.map((a, i) => ({ value:i, label:a.name, color:ageColor(a) })), new Set(focus.ages || []), v => { focus.ages = v.size ? new Set(v) : null; sync(); }, { multi:true });
  const weakBtn = h("button.chip.pr-weakbtn" + (focus.weak ? ".on" : ""), { type:"button", title:"Bias the draw toward regions and ages where your logged scores are worst", onclick:() => { focus.weak = !focus.weak; weakBtn.classList.toggle("on", focus.weak); sync(); } }, h("span.dot"), "Weak spots");
  const countWrap = h("span.pr-count", {}, count, " in focus"), thinNote = h("span.pr-fnote");
  page.append(h("div.pr-focus.card", {}, h("div.pr-focus-row", {}, h("span.pr-flabel", {}, "Where"), rc), h("div.pr-focus-row", {}, h("span.pr-flabel", {}, "When"), ac),
    h("div.pr-focus-row.foot", {}, h("span.pr-flabel", {}, "Bias"), weakBtn, thinNote, h("div", { style:{ flex:"1" } }), countWrap, clear)));

  /* daily */
  const st = stats(), daily = Q.modes.daily, dd = AS.store.get("practice.daily", {}), playedToday = dd.day === AS.log.day();
  if (daily){ const ok = daily.available();
    const strip = h("div.pr-strip"); if (ok){ const rng = mulberry(daySeed() ^ 0x9e3779b9), S = makeSampler({ regions:null, ages:null, weak:false }, rng, true); for (let i = 0; i < 6; i++){ const o = S.pick(); if (!o) break; const im = h("img", { alt:"", loading:"lazy", referrerpolicy:"no-referrer", src:o.thumb }); im.onerror = () => im.remove(); strip.append(im); } }
    const d = new Date(); const dateTxt = d.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });
    page.append(h("a.pr-daily" + (ok ? "" : ".off"), { href:ok ? AS.href("practice", { mode:"daily" }) : null, data:{ mode:"daily", daily:"1" } }, strip,
      h("div.pr-daily-copy", {}, h("div.eyebrow", {}, `Daily mix · ${dateTxt}`), h("h2", {}, "Eight objects, three games, one draw."), h("p", {}, ok ? "Three to place and date, two duels, three line-ups. The same draw all day; a new one tomorrow." : NOTE),
        h("div.row.wrap", {}, h("span.btn.primary.lg", {}, playedToday ? "Play it again" : "Play today's mix", h("span.kbd", {}, "D")),
          playedToday ? h("span.pr-dstat", {}, "today ", h("b.mono", {}, AS.fmtN(dd.pts)), ` / ${AS.fmtN(dd.max)}`) : h("span.pr-dstat", {}, "not played today"),
          st.daily ? h("span.pr-dstat", {}, "best ", h("b.mono", {}, AS.fmtN(st.daily.best)), ` · ${st.daily.plays} play${st.daily.plays === 1 ? "" : "s"}`) : null))));
  }

  /* mode cards */
  const logByMode = {}; for (const e of AS.log.all()) if (e && e.mode) (logByMode[e.mode] = logByMode[e.mode] || []).push(e);
  const card = m => { let ok = false; try { ok = !m.available || m.available(); } catch(e){ console.error(e); }
    const s = st[m.id], lg = logByMode[m.id] || [], glyph = h("div.pr-glyph"); if (/^\s*</.test(m.glyph || "")) glyph.innerHTML = m.glyph; else glyph.textContent = m.glyph || (m.title || "?").slice(0, 1);
    let stat;
    if (s && s.plays) stat = h("div.pr-cstats", {}, h("span", {}, h("b.mono", {}, AS.fmtN(s.best)), "best"), h("span", {}, h("b.mono", {}, AS.fmtN(s.last)), "last"), h("span", {}, h("b.mono", {}, String(s.plays)), s.plays === 1 ? "play" : "plays"));
    else if (lg.length){ const fr = lg.slice(-30).map(fracOf).filter(v => v != null); stat = h("div.pr-cstats", {}, h("span", {}, h("b.mono", {}, AS.fmtN(lg.length)), "answered"), fr.length ? h("span", {}, h("b.mono", {}, Math.round(100 * mean(fr)) + "%"), "recent") : null); }
    else stat = h("div.pr-cstats.none", {}, ok ? "Not played yet" : (m.unavailableNote || "Not available yet"));
    const a = h("a.pr-card" + (ok ? "" : ".off"), { href:ok ? AS.href("practice", { mode:m.id }) : null, style:{ "--acc":m.accent || "var(--gold)" }, data:{ mode:m.id }, "aria-disabled":ok ? null : "true" },
      h("div.pr-card-top", {}, glyph, h("span.pr-go", {}, ok ? "Play" : "Closed", ok ? h("i", {}, "→") : null)), h("h3", {}, m.title || m.id), h("p", {}, m.blurb || ""), stat);
    if (!ok) a.addEventListener("click", e => e.preventDefault());
    if (ok && m.variants && m.variants.length) return h("div.pr-cardwrap", {}, a, h("div.pr-variants", {}, m.variants.map(v => h("a.chip", { href:"#", data:{ mode:m.id, extra:JSON.stringify(v.params || {}) } }, "variant: " + v.label))));
    return h("div.pr-cardwrap", {}, a); };
  const modes = Object.values(Q.modes).filter(m => m && !m.featured), groups = [];
  for (const m of modes){ const g = m.group || "Other"; if (!groups.includes(g)) groups.push(g); }
  groups.sort((a, b) => (a === GROUP ? -1 : b === GROUP ? 1 : 0));
  if (!groups.includes("Drills")) groups.push("Drills");
  const SUB = { [GROUP]:"real objects you have not seen · images load live from the museums", "Drills":"no pictures, just knowledge: tells, scripts, dates, powers" };
  for (const g of groups){ const list = modes.filter(m => (m.group || "Other") === g);
    page.append(h("div.pr-group", {}, h("h2", {}, g), h("span", {}, SUB[g] || "")));
    page.append(list.length ? h("div.pr-cards", {}, list.map(card)) : h("div.pr-nodrills", {}, h("b", {}, "No drills registered yet."), " When the drill deck lands it will list itself here; until then the Tells and Scripts rooms have their own quick tests.")); }

  page.append(dashboard(params, () => { const y = scroll.scrollTop; el.innerHTML = ""; hub(el, AS.params()); el.querySelector(".view-scroll").scrollTop = y; }));
  sync();
  if (params.show === "residuals") setTimeout(() => { const t = document.getElementById("pr-residuals"); if (t) t.scrollIntoView({ block:"start" }); }, 0);
}

/* ============================ view ============================ */
const ROOMS = ["home", "atlas", "when", "tells", "scripts", "practice"];
AS.views.practice = {
  title:"Practice", ownsDigits:true, el:null, key:null, run:null,
  mount(el, params){ this.el = el; this.key = null; this.run = null;
    this.onKey = e => { if (this.run || e.metaKey || e.ctrlKey || e.altKey || document.querySelector(".modal-back,.pr-lb")) return; const t = e.target; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const n = parseInt(e.key, 10); if (n >= 1 && n <= ROOMS.length && AS.views[ROOMS[n - 1]]) AS.go(ROOMS[n - 1]); else if ((e.key === "d" || e.key === "D") && Q.modes.daily && Q.modes.daily.available()) AS.go("practice", { mode:"daily" }); };
    document.addEventListener("keydown", this.onKey); this.render(params || {}); },
  update(params){ this.render(params || {}); },
  render(params){
    const key = keyOf(params); if (key === this.key) return;
    this.teardown(); this.key = key; const el = this.el; el.innerHTML = ""; AS.tip.hide();
    const m = params.mode ? Q.modes[params.mode] : null, back = () => AS.go("practice", focusParams(parseFocus(params)));
    if (!params.mode) return hub(el, params);
    let ok = false; try { ok = !!m && (!m.available || m.available()); } catch(e){ console.error(e); }
    if (!ok){ el.append(h("div.pr-starve", {}, h("div.eyebrow", {}, m ? m.title : "Unknown mode"), h("h2", {}, m ? "This one is closed for now." : "No such game."), h("p.muted", {}, m ? (m.unavailableNote || "It is not available yet.") : `Nothing is registered as "${params.mode}".`), h("button.btn.primary", { type:"button", onclick:back }, "Back to practice"))); return; }
    const host = h("div.pr-host"); el.append(host); document.title = m.title + " · Practice · Anthropeum Study";
    try { this.run = m.start(host, params, { exit:back }) || {}; } catch(e){ console.error(e); host.append(h("div.empty", {}, "This mode failed to start: " + e.message)); this.run = {}; }
  },
  teardown(){ if (this.run){ try { this.run.destroy && this.run.destroy(); } catch(e){ console.error(e); } this.run = null; } closeLightbox(); },
  unmount(){ this.teardown(); document.removeEventListener("keydown", this.onKey); this.key = null; }
};
})();
