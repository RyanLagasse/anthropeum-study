/* Atlas — base rates: where and when the collection's objects were made, sliced by lens.
   Lenses: places · powers · materials · instruments · animals. Metrics: balanced (share within an era,
   every era weighted equally) · raw (counts) · signature (lift vs. the place's share of everything).
   URL: #/atlas?lens=&era=&metric=&mat=&sub=&itype=&animal=&place=&xpaper=1&animat=1&prints=1&vol=1 */
(function(){ "use strict";
const AS = window.AS, h = AS.h, esc = AS.esc, fmtN = AS.fmtN;

const LENSES = [
  { value:"places", label:"Places" }, { value:"powers", label:"Powers" }, { value:"materials", label:"Materials" },
  { value:"instruments", label:"Instruments" }, { value:"animals", label:"Animals" } ];
const LENS_ALIAS = { hotspots:"places", empires:"powers" };
const METRICS = [
  { value:"balanced", label:"Balanced", title:"Share of the era's objects. On All eras: the mean of per-era shares, so 1900 counts no more than 1900 BCE." },
  { value:"raw", label:"Raw", title:"Plain object counts. Honest, and heavily tilted to 1750–2000 and works on paper." },
  { value:"signature", label:"Signature", title:"Lift: this place's share of the selection ÷ its share of everything. What is characteristic, not merely numerous." } ];
const CATS = [
  { key:"stone",  ci:1, label:"Stone & gems",           short:"Stone",       color:"#5b9bff" },
  { key:"metal",  ci:2, label:"Metal",                  short:"Metal",       color:"#f5a13a" },
  { key:"perish", ci:3, label:"Perishables (organic)",  short:"Perishables", color:"#37d39a" },
  { key:"other",  ci:4, label:"Ceramic, glass & other", short:"Ceramic · glass", color:"#e06cf0" } ];
const C_INST = "#9d8cff", C_ANI = "#ff7a59", C_PLACE = "#ecbd4f";
const EXCLUDE_SUBS = new Set(["stone_other", "metal_other", "unspecified", "textile", "ceramic"]);
const STRENGTH = { 3:{ label:"superpower of its era", short:"superpower", color:"#ecbd4f", r:11 }, 2:{ label:"major power", short:"major", color:"#f1ebdd", r:8 }, 1:{ label:"regional culture", short:"regional", color:"#aab3d0", r:5.5 } };
const MIN_N = 5, DEFAULT_POWER_ERA = 12, NEAR_KM = 1200, E20 = Array.from({ length:20 }, (_, i) => i);
/* AS.regionOfPoint is a coarse lon/lat box test; these centroids land in the wrong box */
const REGION_FIX = { "Micronesia":"oce", "Marquesas":"oce", "Indonesia (Java/Bali)":"sea", "Cyprus":"eur_s", "Greece (Crete)":"eur_s", "Greece (Rhodes)":"eur_s",
  "Tunisia (Carthage)":"egy", "Byzantium":"eur_e", "Hungary":"eur_e", "Romania":"eur_e", "Switzerland":"eur_nw", "Venezuela":"and" };
const shortLabel = s => String(s).replace(/ \(.*\)$/, "");

/* ---------- data index (built once) ---------- */
let X = null;
function index(){
  if (X) return X; const D = window.AS_DATA || {}, A = D.agg; if (!A || !A.places) return null;
  const byEra = (obj, f) => { const out = []; for (const e in (obj || {})) out[+e] = f(obj[e]); return out; };
  const pairs = a => Object.fromEntries(a), rows = a => { const o = {}; for (const r of a) o[r[0]] = r; return o; };
  X = { A, P:A.places, SUBM:A.meta.submats || [], ITY:A.meta.instypes || [], ANI:A.meta.animals || [], EMP:(D.empires || {}).eras || [], N:D.notes || {},
    S:A.places.map(p => byEra(p.sub, pairs)), I:A.places.map(p => byEra(p.inst, pairs)), An:A.places.map(p => byEra(p.ani, rows)),
    GS:byEra(A.gsub, pairs), GI:byEra(A.ginst, pairs), GA:byEra(A.gani, rows),
    reg:A.places.map(p => REGION_FIX[p.name] || AS.regionOfPoint(p.lon, p.lat)) };
  X.STRAT = X.N.STRATEGY || {}; X.SUBNOTES = X.N.SUBNOTES || {}; X.ANINOTES = X.N.ANIMALNOTES || {};
  X.groups = [...new Set(X.ANI.map(a => a.group))];
  return X;
}

/* ---------- state ---------- */
let S = null, el = null, map = null, bar = null, barKey = null, ui = {}, lastPlace = null, lastSideKey = null, power = null, autoEra = false, openGroup = null, showAll = false, pendingFly = null;
function parse(q){
  const s = { lens:"places", era:null, metric:"balanced", mat:"stone", sub:null, itype:null, animal:null, place:null, xpaper:false, animat:false, prints:false, vol:false };
  const lens = LENS_ALIAS[q.lens || q.tab] || q.lens || q.tab; if (LENSES.some(l => l.value === lens)) s.lens = lens;
  if (q.era != null && q.era !== "" && !isNaN(+q.era)) s.era = AS.clamp(Math.round(+q.era), 0, 19);
  if (METRICS.some(m => m.value === q.metric)) s.metric = q.metric;
  if (CATS.some(c => c.key === q.mat)) s.mat = q.mat;
  if (q.sub){ const i = X.SUBM.findIndex(x => x.key === q.sub); if (i >= 0){ s.sub = i; s.mat = X.SUBM[i].cat; } }
  if (q.itype){ const i = X.ITY.findIndex(x => x.key === q.itype); if (i >= 0) s.itype = i; }
  if (q.animal){ const i = X.ANI.findIndex(x => x.key === q.animal); if (i >= 0) s.animal = i; }
  if (q.place){ const n = q.place.toLowerCase(); let i = X.P.findIndex(p => p.name.toLowerCase() === n); if (i < 0) i = X.P.findIndex(p => p.name.toLowerCase().startsWith(n)); if (i >= 0) s.place = i; }
  s.xpaper = q.xpaper === "1"; s.animat = q.animat === "1" || q.animat === "true"; s.prints = q.prints === "1"; s.vol = q.vol === "1";
  return s;
}
function normalize(){
  if ((S.lens === "places" || S.lens === "powers") && S.metric === "signature") S.metric = "balanced";
  if (S.lens === "powers"){ S.place = null; if (S.era == null){ S.era = DEFAULT_POWER_ERA; autoEra = true; } } else { autoEra = false; power = null; }
}
function toParams(){
  return { lens:S.lens === "places" ? null : S.lens, tab:null, era:S.era, metric:S.metric === "balanced" ? null : S.metric,
    mat:S.lens === "materials" && S.sub == null && S.mat !== "stone" ? S.mat : null, sub:S.lens === "materials" && S.sub != null ? X.SUBM[S.sub].key : null,
    itype:S.lens === "instruments" && S.itype != null ? X.ITY[S.itype].key : null, animal:S.lens === "animals" && S.animal != null ? X.ANI[S.animal].key : null,
    place:S.place != null ? X.P[S.place].name : null, xpaper:S.xpaper ? "1" : null, animat:S.animat ? "1" : null, prints:S.prints ? "1" : null, vol:S.vol ? "1" : null };
}
function commit(patch, push){
  const eraChanged = "era" in patch && patch.era !== S.era; Object.assign(S, patch); if (eraChanged) autoEra = false; if ("lens" in patch || "mat" in patch) showAll = false;
  normalize(); AS.setParams(toParams(), { replace:!push }); render();
}

/* ---------- the numbers ---------- */
const aniRow = r => !r ? 0 : S.animat ? r[2] : Math.max(0, r[1] - (S.prints ? 0 : r[3]));
const noPaper = () => S.lens === "animals" && !S.animat && !S.prints;
const baseP = (i, e) => { const c = X.P[i].counts[e]; return Math.max(0, c[0] - (noPaper() ? c[6] : 0)); };
const baseG = e => { const c = X.A.global[e]; return Math.max(0, c[0] - (noPaper() ? c[6] : 0)); };
/* n = raw count, share = balanced share, lift = signature (null when the sample is too small) — for the current era or all eras */
function stats(nP, nG, bP, bG){
  let n = 0, share = 0, base = 0;
  if (S.era != null){ const e = S.era, g = nG(e), b = bG(e); n = nP(e); share = g ? n / g : 0; base = b ? bP(e) / b : 0; }
  else { let k = 0; for (const e of E20){ const g = nG(e); if (!(g > 0)) continue; k++; const v = nP(e), b = bG(e); n += v; share += v / g; base += b ? bP(e) / b : 0; } if (k){ share /= k; base /= k; } }
  return { n, share, lift:(n >= MIN_N && base > 0) ? share / base : null };
}
function selection(){
  const L = S.lens; let cell, label, color, key, kind = "objects";
  if (L === "materials"){ const c = CATS.find(x => x.key === S.mat); color = c.color;
    if (S.sub != null){ const sid = S.sub; cell = (i, e) => (X.S[i][e] && X.S[i][e][sid]) || 0; label = X.SUBM[sid].label; key = "m:" + sid; }
    else { cell = (i, e) => X.P[i].counts[e][c.ci]; label = c.label; key = "c:" + c.key; } }
  else if (L === "instruments"){ color = C_INST;
    if (S.itype != null){ const t = S.itype; cell = (i, e) => (X.I[i][e] && X.I[i][e][t]) || 0; label = X.ITY[t].label; key = "i:" + t; }
    else { cell = (i, e) => X.P[i].counts[e][5]; label = "All instruments"; key = "i"; } }
  else if (L === "animals"){ color = C_ANI; const fl = (S.animat ? "m" : "") + (S.prints ? "p" : "");
    if (S.animal != null){ const a = S.animal; cell = (i, e) => aniRow(X.An[i][e] && X.An[i][e][a]); label = shortLabel(X.ANI[a].label); key = "a:" + a + fl; }
    else { cell = (i, e) => { const o = X.An[i][e]; let v = 0; if (o) for (const a in o) v += aniRow(o[a]); return v; }; label = "All animals"; key = "a" + fl; } }
  else { color = C_PLACE; const x = L === "places" && S.xpaper; cell = (i, e) => { const c = X.P[i].counts[e]; return Math.max(0, c[0] - (x ? c[6] : 0)); };
    label = x ? "All objects, works on paper excluded" : "All objects"; key = "p" + (x ? "x" : ""); }
  const M = X.P.map((p, i) => E20.map(e => cell(i, e))), G = E20.map(e => { let t = 0; for (const r of M) t += r[e]; return t; });
  return { key, label, color, kind, M, G };
}
/* one entry per place with anything to show, sorted by the active metric */
function placeValues(sel){
  const out = [], low = [];
  X.P.forEach((p, i) => { const st = stats(e => sel.M[i][e], e => sel.G[e], e => baseP(i, e), baseG); if (st.n <= 0) return;
    const v = S.metric === "raw" ? st.n : S.metric === "signature" ? st.lift : st.share, x = { i, p, v, n:st.n, share:st.share, lift:st.lift }; (v == null || !(v > 0) ? low : out).push(x); });
  out.sort((a, b) => b.v - a.v || b.n - a.n); out.low = low; /* low: present, but too few objects for an honest lift */
  return out;
}
const fmtPct = x => { const p = x * 100; return p >= 99.95 ? "100%" : p >= 10 ? Math.round(p) + "%" : p >= 0.095 ? p.toFixed(1) + "%" : p > 0 ? "<0.1%" : "0%"; };
const fmtLift = l => l == null ? "–" : "×" + (l >= 100 ? fmtN(l) : l >= 10 ? l.toFixed(0) : l.toFixed(1));
const fmtV = (v, m) => (m || S.metric) === "raw" ? fmtN(v) : (m || S.metric) === "signature" ? fmtLift(v) : fmtPct(v);
const eraTxt = () => S.era == null ? "all eras" : AS.eraLabel(S.era);
const metricNoun = () => S.metric === "raw" ? "objects" : S.metric === "signature" ? "lift vs. the place's usual share" : S.era == null ? "mean share per era" : "share of the era";

/* ---------- view ---------- */
AS.views.atlas = {
  title:"Atlas",
  mount(host, params){
    el = host;
    if (!index()){ el.append(h("div.empty", {}, h("h3", {}, "The atlas has no data"), h("p", {}, "data/agg.js did not load. Run python3 build/pack.py and reload."))); return; }
    S = parse(params || {}); normalize();
    ui.lens = AS.ui.seg(LENSES, S.lens, v => commit({ lens:v }, true));
    ui.metric = h("div.seg.gold.at-metric", { role:"group", "aria-label":"Metric" });
    ui.toggles = h("div.at-toggles");
    ui.barHost = h("div.at-erabar");
    ui.stage = h("div.stage"); ui.side = h("aside.side.at-side");
    ui.readout = h("div.glass.at-readout"); ui.stage.append(h("div.map-overlay.tl", {}, ui.readout));
    el.append(h("div.topbar", {}, h("h2", {}, "Atlas"), ui.lens, h("div.grow"), ui.toggles, ui.metric), ui.barHost, h("div.split", {}, ui.stage, ui.side));
    map = AS.createMap(ui.stage, { year:AS.MODERN_MAP, mode:"quiet" });
    map.on("click", ({ marker }) => { if (!marker || !marker.data) return;
      if (marker.data.kind === "place") commit({ place:S.place === marker.data.i ? null : marker.data.i }, true);
      else if (marker.data.kind === "power"){ power = marker.data.k; map.flyTo(marker.lon, marker.lat, Math.max(2.6, map.zoom), 600); render(); } });
    document.addEventListener("keydown", onKey);
    lastPlace = null; lastSideKey = null; barKey = null; bar = null;
    if (toParamsDiffers(params || {})) AS.setParams(toParams());
    render(true);
  },
  update(params){ if (!X || !S) return; S = parse(params || {}); normalize(); if (toParamsDiffers(params || {})) AS.setParams(toParams()); render(); },
  unmount(){ document.removeEventListener("keydown", onKey); if (bar) bar.destroy(); if (map) map.destroy(); AS.tip.hide(); map = bar = el = S = null; ui = {}; barKey = null; }
};
function toParamsDiffers(q){ const t = toParams(); for (const k in t){ if ((t[k] == null ? "" : String(t[k])) !== (q[k] == null ? "" : String(q[k]))) return true; } return false; }
function onKey(e){
  if (!S || e.metaKey || e.ctrlKey || e.altKey || document.querySelector(".modal-back")) return; const t = e.target; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
  const lo = S.lens === "powers" ? 0 : null;
  if (e.key === "ArrowRight"){ e.preventDefault(); if (bar) bar.stop(); commit({ era:S.era == null ? 0 : Math.min(19, S.era + 1) }); }
  else if (e.key === "ArrowLeft"){ e.preventDefault(); if (bar) bar.stop(); commit({ era:S.era == null ? 19 : S.era === 0 ? lo : S.era - 1 }); }
  else if (e.key === "Escape"){ if (bar) bar.stop();
    if (S.place != null) commit({ place:null }, true); else if (power != null){ power = null; render(); }
    else if (S.lens === "materials" && S.sub != null) commit({ sub:null }); else if (S.lens === "instruments" && S.itype != null) commit({ itype:null });
    else if (S.lens === "animals" && S.animal != null) commit({ animal:null }); else if (S.era != null && S.lens !== "powers") commit({ era:null }); }
  else if (e.key === "m" || e.key === "M"){ const ok = METRICS.filter(m => metricAllowed(m.value)); if (ok.length > 1) commit({ metric:ok[(ok.findIndex(m => m.value === S.metric) + 1) % ok.length].value }); }
}
const metricAllowed = m => S.lens !== "powers" && (m !== "signature" || S.lens !== "places");

function render(first){
  if (!el || !S) return;
  const sel = selection(), vals = S.lens === "powers" ? [] : placeValues(sel);
  renderTop(); renderBar(sel); renderMap(sel, vals, first); renderReadout(sel, vals); renderSide(sel, vals);
}

/* ---------- top bar ---------- */
function toggle(label, on, title, fn, disabled){ return h("button.chip.at-toggle" + (on ? ".on" : ""), { type:"button", title, "aria-pressed":on ? "true" : "false", disabled:disabled || null, onclick:fn }, h("span.at-check"), label); }
function renderTop(){
  ui.lens.set(S.lens);
  ui.metric.innerHTML = ""; ui.metric.classList.toggle("at-off", S.lens === "powers");
  for (const m of METRICS){ const ok = metricAllowed(m.value);
    const why = ok ? m.title : S.lens === "powers" ? "Metrics apply to object counts. The Powers lens shows polities, not objects." : "Signature compares a selection against everything a place made. With no selection there is nothing to compare — pick Materials, Instruments or Animals.";
    ui.metric.append(h("button" + (m.value === S.metric && S.lens !== "powers" ? ".on" : "") + (ok ? "" : ".at-dis"), { type:"button", "aria-disabled":ok ? null : "true",
      onclick:() => ok ? (S.metric !== m.value && commit({ metric:m.value })) : AS.toast(S.lens === "powers" ? "Metrics don't apply to Powers" : "Signature needs a material, instrument or animal", 2400),
      onmousemove:e => AS.tip.show(e, `<div class="t">${m.label}</div><div class="s">${esc(why)}</div>`), onmouseleave:AS.tip.hide }, m.label)); }
  ui.toggles.innerHTML = "";
  if (S.lens === "places") ui.toggles.append(toggle("Exclude works on paper", S.xpaper, "Prints, drawings and photographs: about 210k objects that skew hard to the US and France", () => commit({ xpaper:!S.xpaper })));
  if (S.lens === "animals") ui.toggles.append(
    toggle("Materials only", S.animat, "Count only animal-derived materials: wool, silk, ivory, feathers, shell…", () => commit({ animat:!S.animat })),
    toggle("Exclude prints", !S.prints && !S.animat, "Prints, drawings and photos of animals swamp the ancient signal", () => commit({ prints:!S.prints }), S.animat));
}
function renderBar(sel){
  if (barKey !== sel.key + "|" + S.lens){ if (bar) bar.destroy(); ui.barHost.innerHTML = ""; barKey = sel.key + "|" + S.lens;
    const unit = S.lens === "powers" || S.lens === "places" ? "objects" : sel.label.toLowerCase() + (S.lens === "materials" && S.sub != null ? " objects" : "");
    bar = AS.ui.eraBar(ui.barHost, { play:true, value:S.era, values:sel.G, tipUnit:unit, allowAll:true, onChange:i => { if (i == null && S.lens === "powers"){ autoEra = true; bar.set(S.era); AS.toast("Powers need an era — borders move"); render(); return; } commit({ era:i }); } }); }
  else if (bar.value !== S.era) bar.set(S.era);
}

/* ---------- map ---------- */
function breakdown(i, kind, n = 5){
  const acc = {}, src = kind === "sub" ? X.S[i] : kind === "inst" ? X.I[i] : X.An[i];
  for (const e of E20){ if (S.era != null && e !== S.era) continue; const o = src[e]; if (!o) continue;
    for (const id in o){ if (kind === "sub" && X.SUBM[id].cat !== S.mat) continue; const v = kind === "ani" ? aniRow(o[id]) : o[id]; if (v > 0) acc[id] = (acc[id] || 0) + v; } }
  const lab = id => kind === "sub" ? X.SUBM[id].label : kind === "inst" ? X.ITY[id].label : shortLabel(X.ANI[id].label);
  return Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, n).map(([id, v]) => `${esc(lab(id))} ${fmtN(v)}`).join(" · ");
}
function placeTip(x, sel){
  const p = x.p, kv = (k, v, on) => `<span${on ? ' style="color:var(--gold-2)"' : ""}>${k}</span><span${on ? ' style="color:var(--gold-2)"' : ""}>${v}</span>`;
  let extra = "";
  if (S.lens === "materials"){ const b = breakdown(x.i, "sub"); if (b) extra += `<div class="s">${esc(CATS.find(c => c.key === S.mat).short)} here: ${b}</div>`; }
  if (S.lens === "instruments"){ const b = breakdown(x.i, "inst"); if (b) extra += `<div class="s">families here: ${b}</div>`; if (p.instr && p.instr.length) extra += `<div class="s">e.g. ${esc(p.instr.slice(0, 4).join(", "))}</div>`; }
  if (S.lens === "animals"){ const b = breakdown(x.i, "ani"); if (b) extra += `<div class="s">animals here: ${b}</div>`; }
  return `<div class="t">${esc(p.name)}</div><div class="s">${esc(sel.label)} · ${eraTxt()}</div><div class="kv">` +
    kv(S.era == null ? "Mean share per era" : "Share of the era", fmtPct(x.share), S.metric === "balanced") + kv("Objects", fmtN(x.n), S.metric === "raw") +
    (S.lens !== "places" ? kv("Signature", x.lift == null ? `n &lt; ${MIN_N}` : fmtLift(x.lift), S.metric === "signature") : "") + `</div>${extra}` +
    (p.cultures && p.cultures.length ? `<div class="s">cultures: ${esc(p.cultures.slice(0, 4).join(", "))}</div>` : "") +
    (p.top && p.top.length ? `<div class="s">makes: ${esc(p.top.slice(0, 5).map(shortLabel).join(" · "))}</div>` : "");
}
let scale = null; /* { r(v), stops:[{v,r}] } for the legend */
function makeScale(vals){
  const R = AS.clamp((ui.stage.clientWidth || 1100) / 32, 16, 34), vmax = vals.length ? vals[0].v : 1;
  if (S.metric === "signature"){ const lm = Math.max(8, vmax), r = v => v <= 1 ? 3 : 4 + (R - 4) * Math.log(v) / Math.log(lm);
    return { r, stops:[lm, Math.sqrt(lm), 1].map(v => ({ v, r:r(v) })) }; }
  const r = v => Math.max(2.5, R * Math.sqrt(v / vmax));
  return { r, stops:[1, 1 / 4, 1 / 16].map(f => ({ v:vmax * f, r:r(vmax * f) })) };
}
function renderMap(sel, vals, first){
  if (S.lens === "powers"){
    const era = S.era, emps = (X.EMP[era] || {}).empires || [];
    map.setBase({ year:AS.ERA2MAP[era], mode:"polities", featureTip:f => f.name ? `<div class="t">${esc(f.name)}</div>${f.sub && f.sub !== f.name ? `<div class="s">under ${esc(f.sub)}</div>` : ""}<div class="s">borders c. ${AS.mapKeyLabel(AS.ERA2MAP[era])}</div>` : "" });
    map.setMarkers(emps.map((e, k) => { const st = STRENGTH[e.strength] || STRENGTH[1];
      return { id:"pw" + k, lon:e.lon, lat:e.lat, r:st.r, shape:"diamond", color:st.color, fill:.95, glow:e.strength >= 3, label:e.name, priority:e.strength * 10 - k * .01, labelAlways:e.strength >= 3, selected:power === k, data:{ kind:"power", k },
        tip:`<div class="t">${esc(e.name)}</div><div class="s">${st.label} · ${AS.eraLabel(era)}</div><div style="margin-top:5px">${esc(e.note || "")}</div>` }; }));
    if (pendingFly){ map.flyTo(pendingFly[0], pendingFly[1], 2.8, first ? 0 : 700); pendingFly = null; }
    lastPlace = null; scale = null; return;
  }
  map.setBase({ year:S.era == null ? AS.MODERN_MAP : AS.ERA2MAP[S.era], mode:"quiet", featureTip:null });
  scale = makeScale(vals);
  const labelled = new Set(vals.slice(0, 30).map(x => x.i));
  const marks = vals.map(x => { const r = scale.r(x.v), dim = S.metric === "signature" && x.v <= 1;
    return { id:"p" + x.i, lon:x.p.lon, lat:x.p.lat, r, color:S.lens === "places" ? AS.regionColor(X.reg[x.i]) : sel.color, glow:r >= 5 && !dim, fill:dim ? .3 : null,
      label:labelled.has(x.i) || S.place === x.i ? x.p.name : null, priority:r + x.v * 1e-6, selected:S.place === x.i, tip:placeTip(x, sel), data:{ kind:"place", i:x.i } }; });
  for (const x of vals.low || []) marks.push({ id:"p" + x.i, lon:x.p.lon, lat:x.p.lat, r:2.5, color:"#8f93a6", fill:.45, label:S.place === x.i ? x.p.name : null, selected:S.place === x.i, tip:placeTip(x, sel), data:{ kind:"place", i:x.i } });
  if (S.place != null && !vals.some(x => x.i === S.place) && !(vals.low || []).some(x => x.i === S.place)){ const p = X.P[S.place]; /* selected place has nothing in this slice: keep a ghost so the dossier still has an anchor */
    marks.push({ id:"p" + S.place, lon:p.lon, lat:p.lat, r:4, color:"#8f93a6", fill:.25, label:p.name, selected:true, data:{ kind:"place", i:S.place }, tip:`<div class="t">${esc(p.name)}</div><div class="s">Nothing for ${esc(sel.label.toLowerCase())} · ${eraTxt()}</div>` }); }
  map.setMarkers(marks);
  if (S.place !== lastPlace){ if (S.place != null){ const p = X.P[S.place]; map.flyTo(p.lon, p.lat, Math.max(3, Math.min(map.zoom, 5)), first ? 0 : 700); } else if (!first) map.reset(600); lastPlace = S.place; }
}

/* ---------- readout card ---------- */
function sizeLegend(color, fmt){
  const st = scale.stops, R = Math.max(...st.map(s => s.r)), k = Math.min(1, 22 / R), W = 2 * R * k + 4, H = 2 * R * k + 4;
  let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">`;
  for (const s of st){ const r = Math.max(1.5, s.r * k); svg += `<circle cx="${W / 2}" cy="${H - 2 - r}" r="${r}" fill="${color}" fill-opacity=".16" stroke="${color}" stroke-width="1.1"/>`; }
  return h("div.at-size", {}, h("div", { html:svg + "</svg>" }), h("div.at-size-l", {}, st.map(s => h("span.mono", {}, fmt(s.v)))));
}
function renderReadout(sel, vals){
  const r = ui.readout; r.innerHTML = "";
  const eraLine = h("div.at-eraline", {}, S.era == null ? h("span.tag.plain", {}, "All eras") : AS.ui.eraChip(S.era),
    h("span.at-borders", {}, S.era == null ? "modern borders" : `${AS.ageOf(S.era).name} · borders c. ${AS.mapKeyLabel(AS.ERA2MAP[S.era])}`));
  if (S.lens === "powers"){ const emps = (X.EMP[S.era] || {}).empires || [];
    r.append(h("div.eyebrow", {}, "Powers"), h("h3.at-rt", {}, "Who ran the world"), eraLine,
      autoEra ? h("div.at-auto", {}, `“All eras” has no borders to draw, so this lens opened on ${AS.eraLabel(S.era)}. Pick any era.`) : "",
      h("div.at-read", {}, emps.filter(e => e.strength >= 3).map(e => e.name).join(" · ") || "No superpower in this era."),
      h("div.at-key", {}, [3, 2, 1].map(k => h("span.at-kitem", {}, h("i.at-dia", { style:{ "--c":STRENGTH[k].color, "--s":(5 + k * 2) + "px" } }), STRENGTH[k].short))),
      h("div.at-hint", {}, "Hover a territory for its polity · click a diamond"));
    return; }
  const lensName = LENSES.find(l => l.value === S.lens).label, mName = METRICS.find(m => m.value === S.metric).label;
  r.append(h("div.eyebrow", {}, `${lensName} · ${mName}`), h("h3.at-rt", { style:S.lens === "places" ? null : { color:`color-mix(in srgb, ${sel.color} 70%, white)` } }, sel.label), eraLine);
  if (!vals.length){ r.append(h("div.at-read", {}, S.metric === "signature" ? `No place reaches ${MIN_N} objects here, so there is no honest lift to show.${vals.low.length ? " Grey dots mark where the few are." : ""} Try Balanced.` : `Nothing recorded for this slice. ${S.era != null ? "Try another era." : ""}`)); return; }
  const top = vals.slice(0, 3).map(x => h("span", {}, x.p.name + " ", h("b.mono", {}, fmtV(x.v))));
  r.append(h("div.at-read", {}, S.metric === "signature" ? h("span.muted", {}, "Most characteristic of: ") : null, top.reduce((a, s, i) => a.concat(i ? [h("span.faint", {}, " · "), s] : [s]), [])));
  const leg = h("div.at-legend", {}, sizeLegend(S.lens === "places" ? "#f1ebdd" : sel.color, v => fmtV(v)));
  if (S.lens === "places"){ const tot = {}; let sum = 0; for (const x of vals){ tot[X.reg[x.i]] = (tot[X.reg[x.i]] || 0) + x.v; sum += x.v; }
    leg.append(h("div.at-regkey", {}, Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, v]) => h("span.at-kitem", { title:AS.region(id).name }, h("i.at-dot", { style:{ "--c":AS.regionColor(id) } }), AS.region(id).short, h("b.mono", {}, fmtPct(v / sum)))))); }
  else leg.append(h("div.at-legtxt", {}, h("div", {}, "size = ", h("b", {}, metricNoun())), S.metric === "signature" ? h("div.muted", {}, `log scale · faint = below ×1 · grey = under ${MIN_N} objects`) : h("div.muted", {}, `${vals.length} places · ${fmtN(S.era == null ? sel.G.reduce((a, b) => a + b, 0) : sel.G[S.era])} objects`)));
  r.append(leg);
}

/* ---------- side panel ---------- */
function sect(title, right){ return h("div.section-title", {}, h("h4", {}, title), right ? h("span.at-st-r", {}, right) : null); }
function row({ rank, name, sub, v, v2, frac, color, on, onclick, title, indent }){
  return h("div.at-row" + (on ? ".on" : "") + (indent ? ".at-indent" : ""), { role:"button", tabindex:"0", title:title || null, style:{ "--c":color || "var(--gold)" }, onclick, onkeydown:e => { if (e.key === "Enter" || e.key === " "){ e.preventDefault(); onclick(e); } } },
    h("i.at-fill", { style:{ width:Math.max(0, Math.min(100, (frac || 0) * 100)) + "%" } }), h("span.at-rk.mono", {}, rank == null ? "" : String(rank)),
    h("span.at-nm", {}, name, sub ? h("small", {}, " " + sub) : null), h("span.at-v.mono", {}, v, v2 != null ? h("small", {}, v2) : null));
}
function notes(arr, title){ if (!arr || !arr.length) return null;
  return h("details.at-notes", { open:true }, h("summary", {}, title || "Priors worth memorising", h("span.mono", {}, String(arr.length))), arr.map(t => h("div.note", { html:t }))); }
function facts(){ const f = X.STRAT.facts; if (!f || !f.length) return null; return h("details.at-notes", {}, h("summary", {}, "Game facts & scoring", h("span.mono", {}, String(f.length))), f.map(t => h("div.note", { html:t }))); }
function placeList(vals, sel, n, opts = {}){
  if (!vals.length) return h("div.empty.at-empty", {}, S.metric === "signature" ? `No place has ${MIN_N}+ of these here.` : "Nothing in this slice.", S.era != null ? h("div", {}, h("button.btn.sm", { type:"button", onclick:() => commit({ era:null }) }, "Look across all eras")) : null);
  const vmax = vals[0].v, lf = S.metric === "signature" ? v => v <= 1 ? .04 : Math.log(v) / Math.log(Math.max(8, vmax)) : v => v / vmax;
  return h("div.at-list", {}, vals.slice(0, n).map((x, k) => row({ rank:k + 1, name:x.p.name, sub:opts.instr && S.era == null && x.p.instr && x.p.instr.length ? "· " + shortLabel(x.p.instr[0]) : null,
    v:fmtV(x.v), v2:S.metric === "raw" ? fmtPct(x.share) : fmtN(x.n), frac:lf(x.v), color:S.lens === "places" ? AS.regionColor(X.reg[x.i]) : sel.color, on:S.place === x.i,
    title:`${x.p.name} — ${fmtPct(x.share)} share · ${fmtN(x.n)} objects${x.lift != null && S.lens !== "places" ? " · " + fmtLift(x.lift) : ""}`, onclick:() => commit({ place:x.i }, true) })));
}
function head(title, sub){ return h("div.at-head", {}, h("h3", {}, title), h("div.at-headsub", {}, S.era == null ? h("span.tag.plain", {}, "All eras") : AS.ui.eraChip(S.era), sub ? h("span.muted", {}, sub) : null)); }
const placesTitle = () => S.metric === "signature" ? "Most characteristic of" : "Top places";
const placesRight = () => S.metric === "raw" ? "objects · share" : S.metric === "signature" ? "lift · objects" : "share · objects";
/* drill list with "show all" folding */
function drill(items, selId, color, allLabel, total, onPick, keep = 9){
  const live = items.filter(x => x.v > 0), vmax = Math.max(1, ...live.map(x => x.v)), shown = showAll ? live : live.filter((x, k) => k < keep || x.id === selId);
  const box = h("div.at-list", {}, row({ name:h("b", {}, allLabel), v:fmtN(total), on:selId == null, color, frac:0, onclick:() => onPick(null) }),
    shown.map((x, k) => row({ rank:live.indexOf(x) + 1, name:x.label, v:fmtN(x.v), v2:total ? fmtPct(x.v / total) : null, frac:x.v / vmax, color, on:selId === x.id, onclick:() => onPick(selId === x.id ? null : x.id) })));
  if (live.length > shown.length || (showAll && live.length > keep)) box.append(h("button.btn.sm.ghost.at-more", { type:"button", onclick:() => { showAll = !showAll; render(); } }, showAll ? "Show fewer" : `Show ${live.length - shown.length} more`));
  if (!live.length) box.append(h("div.at-none.muted", {}, "None recorded in this era."));
  return box;
}
const gval = (G, id, f) => { if (S.era != null) return f(G[S.era] && G[S.era][id]); let v = 0; for (const e of E20) v += f(G[e] && G[e][id]); return v; };
const num = v => v || 0;

function matChart(){
  const W = 360, H = 120, n = 20, gap = 2, cw = (W - gap * (n - 1)) / n, rows = X.A.global, maxTot = Math.max(...rows.map(r => r[0]));
  let s = "";
  for (let i = 0; i < n; i++){ const r = rows[i], tot = r[0] || 1, colH = S.vol ? Math.max(r[0] > 0 ? 3 : 0, H * Math.sqrt(r[0] / maxTot)) : H, x = i * (cw + gap); let y = H;
    const dim = S.era != null && S.era !== i ? ' opacity=".45"' : "";
    for (const c of CATS){ let hh = r[c.ci] / tot * colH; if (hh <= 0) continue; if (hh < 1) hh = 1; y -= hh;
      s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cw.toFixed(1)}" height="${Math.max(.5, hh - .8).toFixed(1)}" rx="1.5" fill="${c.color}" data-era="${i}" data-cat="${c.key}"${dim}${c.key === S.mat ? "" : ' fill-opacity=".62"'}/>`; }
    s += `<rect x="${x.toFixed(1)}" y="${H + 4}" width="${cw.toFixed(1)}" height="${S.era === i ? 6 : 4}" rx="1.5" fill="${AS.eraColor(i)}" data-era="${i}"/>`;
    if (S.era === i) s += `<rect x="${(x - 1).toFixed(1)}" y="0" width="${(cw + 2).toFixed(1)}" height="${H + 1}" rx="2.5" fill="none" stroke="#fff" stroke-width="1.2" pointer-events="none"/>`; }
  const box = h("div.at-chart", { html:`<svg viewBox="0 0 ${W} ${H + 26}" role="img" aria-label="Material mix by era">${s}<text x="0" y="${H + 23}">3000 BCE</text><text x="${W / 2}" y="${H + 23}" text-anchor="middle">1 CE</text><text x="${W}" y="${H + 23}" text-anchor="end">2000 CE</text></svg>` });
  box.addEventListener("click", e => { const r = e.target.closest("[data-era]"); if (r) commit({ era:+r.dataset.era === S.era ? null : +r.dataset.era }); });
  box.addEventListener("mousemove", e => { const r = e.target.closest("[data-era]"); if (!r) return AS.tip.hide(); const i = +r.dataset.era, g = rows[i];
    AS.tip.show(e, `<div class="t">${AS.eraLabel(i)}</div><div class="kv">${CATS.map(c => `<span style="color:${c.color}">${c.short}</span><span>${fmtN(g[c.ci])} · ${Math.round(100 * g[c.ci] / (g[0] || 1))}%</span>`).join("")}</div><div class="s">${fmtN(g[0])} objects this era</div>`); });
  box.addEventListener("mouseleave", AS.tip.hide);
  return box;
}

function renderSide(sel, vals){
  const side = ui.side, key = S.lens + "|" + S.place, keep = key === lastSideKey ? side.scrollTop : 0; lastSideKey = key; side.innerHTML = "";
  if (S.place != null) side.append(dossier(S.place, sel, vals)); else side.append(lensPanel(sel, vals));
  side.scrollTop = keep;
}
function lensPanel(sel, vals){
  const f = document.createDocumentFragment(), L = S.lens, add = (...a) => a.forEach(x => x != null && f.append(x));
  if (L === "places"){
    const G = S.era == null ? sel.G.reduce((a, b) => a + b, 0) : sel.G[S.era], top3 = vals.slice(0, 3).reduce((a, x) => a + x.share, 0);
    add(head("Where things were made", S.xpaper ? "works on paper excluded" : null),
      h("div.at-stats", {}, h("div.stat", {}, h("b", {}, fmtN(G)), h("span", {}, "objects in this slice")), h("div.stat", {}, h("b", {}, String(vals.length)), h("span", {}, "places on the map")), h("div.stat", {}, h("b", {}, fmtPct(top3)), h("span", {}, "held by the top three"))),
      S.era == null && S.metric === "balanced" ? h("div.at-explain", {}, "Balanced on All eras averages each place's share across the twenty eras, so the print-heavy 1750–2000 pile gets one vote, not 400,000.") : null,
      sect(placesTitle(), placesRight()), placeList(vals, sel, 18), notes(X.STRAT.hotspots), facts(),
      h("div.at-foot.faint.mono", {}, `${fmtN(X.A.meta.rows)} catalogued · ${fmtN(X.A.meta.dated)} placed and dated`));
  } else if (L === "powers"){
    const E = X.EMP[S.era] || { empires:[] };
    add(head("Dominant powers", `${E.empires.length} on the board`), h("div.at-powers", {}, E.empires.map((e, k) => h("div.card.hover.at-power" + (power === k ? ".on" : ""), { role:"button", tabindex:"0",
      onclick:() => { power = k; map.flyTo(e.lon, e.lat, 3, 700); render(); }, onkeydown:ev => { if (ev.key === "Enter"){ power = k; map.flyTo(e.lon, e.lat, 3, 700); render(); } } },
      h("div.at-power-h", {}, h("h4", {}, e.name), AS.ui.pips(e.strength, 3)), h("div.at-power-s", {}, (STRENGTH[e.strength] || STRENGTH[1]).label), h("p", {}, e.note || "")))),
      notes(X.STRAT.empires), facts());
    requestAnimationFrame(() => { const on = ui.side && ui.side.querySelector(".at-power.on"); if (on && on.scrollIntoView) on.scrollIntoView({ block:"nearest" }); });
  } else if (L === "materials"){
    const cat = CATS.find(c => c.key === S.mat), subs = X.SUBM.map((s, id) => ({ id, key:s.key, cat:s.cat, label:s.label, v:gval(X.GS, id, num) })).filter(s => s.cat === S.mat).sort((a, b) => b.v - a.v);
    const tot = subs.reduce((a, x) => a + x.v, 0), sk = S.sub != null ? X.SUBM[S.sub].key : null;
    add(head("Materials", S.sub != null ? cat.label : null),
      AS.ui.chips(CATS.map(c => ({ value:c.key, label:c.short, color:c.color })), S.mat, v => commit({ mat:v || S.mat, sub:null }), { allowNone:false }),
      sect(cat.label, "objects · of category"), drill(subs, S.sub, cat.color, "All " + cat.label.toLowerCase(), tot, id => commit({ sub:id })),
      sk && X.SUBNOTES[sk] ? h("div.note.at-selnote", { style:{ "--nc":cat.color }, html:`<b>${esc(X.SUBM[S.sub].label)}.</b> ${X.SUBNOTES[sk]}` }) : null,
      sect(placesTitle(), placesRight()), placeList(vals, sel, 12),
      sect("Materials over time", h("button.at-link", { type:"button", onclick:() => commit({ vol:!S.vol }) }, S.vol ? "show as share" : "show by volume")), matChart(),
      h("div.at-key", {}, CATS.map(c => h("span.at-kitem", {}, h("i.at-dot", { style:{ "--c":c.color } }), c.short))),
      notes(X.STRAT.materials, "Material dating rules"), facts());
  } else if (L === "instruments"){
    const types = X.ITY.map((t, id) => ({ id, label:t.label, v:gval(X.GI, id, num) })).sort((a, b) => b.v - a.v), tot = types.reduce((a, x) => a + x.v, 0);
    add(head("Musical instruments", "14 families"), sect("By family", "objects · of all"), drill(types, S.itype, C_INST, "All instruments", tot, id => commit({ itype:id }), 14),
      sect(placesTitle(), placesRight()), placeList(vals, sel, 14, { instr:true }), notes(X.STRAT.instruments), facts());
  } else {
    const items = X.ANI.map((a, id) => ({ id, key:a.key, group:a.group, label:a.label, v:gval(X.GA, id, aniRow) })), tot = items.reduce((a, x) => a + x.v, 0);
    const selG = S.animal != null ? X.ANI[S.animal].group : null, gmax = Math.max(1, ...X.groups.map(g => items.filter(x => x.group === g).reduce((a, x) => a + x.v, 0)));
    const list = h("div.at-list", {}, row({ name:h("b", {}, "All animals"), v:fmtN(tot), on:S.animal == null, color:C_ANI, frac:0, onclick:() => commit({ animal:null }) }));
    for (const g of X.groups){ const rows = items.filter(x => x.group === g && x.v > 0).sort((a, b) => b.v - a.v), gt = rows.reduce((a, x) => a + x.v, 0), open = openGroup === g || selG === g; if (!rows.length) continue;
      list.append(h("div.at-row.at-group" + (open ? ".open" : ""), { role:"button", tabindex:"0", style:{ "--c":C_ANI }, onclick:() => { openGroup = open && selG !== g ? null : g; if (open && selG === g){ openGroup = null; commit({ animal:null }); } else render(); } },
        h("i.at-fill", { style:{ width:(100 * gt / gmax) + "%" } }), h("span.at-rk.at-caret", {}, open ? "▾" : "▸"), h("span.at-nm", {}, g, h("small", {}, ` ${rows.length}`)), h("span.at-v.mono", {}, fmtN(gt))));
      if (open){ const m = Math.max(1, rows[0].v); for (const x of rows) list.append(row({ name:x.label, v:fmtN(x.v), frac:x.v / m, color:C_ANI, on:S.animal === x.id, indent:true, onclick:() => commit({ animal:S.animal === x.id ? null : x.id }) })); } }
    const sa = S.animal != null ? X.ANI[S.animal] : null;
    add(head("Animals", S.animat ? "as material only" : S.prints ? "depicted or used · prints included" : "depicted or used · prints excluded"),
      sect("7 groups → 50 animals", "objects"), list,
      sa && X.ANINOTES[sa.key] ? h("div.note.at-selnote", { style:{ "--nc":C_ANI }, html:`<b>${esc(sa.label)}.</b> ${X.ANINOTES[sa.key]}` }) : null,
      sect(placesTitle(), placesRight()), placeList(vals, sel, 12), notes(X.STRAT.animals), facts());
  }
  return f;
}

/* ---------- place dossier ---------- */
function sigItems(i, kind, n = 6){
  const out = [], ids = kind === "sub" ? X.SUBM : kind === "inst" ? X.ITY : X.ANI, P = kind === "sub" ? X.S[i] : kind === "inst" ? X.I[i] : X.An[i], G = kind === "sub" ? X.GS : kind === "inst" ? X.GI : X.GA, f = kind === "ani" ? aniRow : num;
  const paper = kind === "ani" && !S.animat && !S.prints, bp = e => { const c = X.P[i].counts[e]; return Math.max(0, c[0] - (paper ? c[6] : 0)); }, bg = e => { const c = X.A.global[e]; return Math.max(0, c[0] - (paper ? c[6] : 0)); };
  ids.forEach((d, id) => { if (kind === "sub" && EXCLUDE_SUBS.has(d.key)) return; if (kind === "inst" && d.key === "other") return;
    const st = stats(e => f(P[e] && P[e][id]), e => f(G[e] && G[e][id]), bp, bg); if (st.n > 0) out.push({ id, d, n:st.n, lift:st.lift, share:st.share }); });
  const good = out.filter(x => x.lift != null).sort((a, b) => b.lift - a.lift);
  return good.length ? { lifted:true, rows:good.slice(0, n) } : { lifted:false, rows:out.sort((a, b) => b.n - a.n).slice(0, n) };
}
function sigList(res, color, label, onPick){
  if (!res.rows.length) return h("div.at-none.muted", {}, "None recorded.");
  const m = res.lifted ? Math.log(Math.max(2, res.rows[0].lift)) : res.rows[0].n;
  return h("div.at-list", {}, res.rows.map(x => row({ name:label(x.d), v:res.lifted ? fmtLift(x.lift) : fmtN(x.n), v2:res.lifted ? fmtN(x.n) : null, color,
    frac:res.lifted ? (x.lift <= 1 ? .04 : Math.log(x.lift) / m) : x.n / m, title:`${fmtN(x.n)} objects · holds ${fmtPct(x.share)} of them${x.lift != null ? " · " + fmtLift(x.lift) + " its usual share" : ""}`, onclick:() => onPick(x) })));
}
function dossier(i, sel, vals){
  const p = X.P[i], reg = X.reg[i], f = document.createDocumentFragment(), add = (...a) => a.forEach(x => x != null && f.append(x));
  const rank = vals.findIndex(x => x.i === i), me = rank >= 0 ? vals[rank] : (vals.low || []).find(x => x.i === i) || null;
  const tot = E20.map(e => p.counts[e][0]), shares = E20.map(e => X.A.global[e][0] ? tot[e] / X.A.global[e][0] : 0), smax = Math.max(1e-9, ...shares);
  add(h("div.at-dhead", {}, h("button.btn.sm.at-back", { type:"button", onclick:() => commit({ place:null }, true) }, "← ", LENSES.find(l => l.value === S.lens).label), h("span.kbd", {}, "Esc")),
    h("h2.at-dname", {}, p.name), h("div.at-headsub", {}, AS.ui.regionTag(reg), S.era == null ? h("span.tag.plain", {}, "All eras") : AS.ui.eraChip(S.era)),
    h("div.at-stats", {}, h("div.stat", {}, h("b", {}, me && me.v != null ? fmtV(me.v) : me ? `n<${MIN_N}` : "–"), h("span", {}, `${sel.label.toLowerCase()} · ${S.metric}`)),
      h("div.stat", {}, h("b", {}, rank >= 0 ? "#" + (rank + 1) : "–"), h("span", {}, `of ${vals.length} places`)), h("div.stat", {}, h("b", {}, fmtN(me ? me.n : 0)), h("span", {}, "objects in slice"))),
    sect("Share of each era", "click a bar"),
    h("div.at-spark", {}, E20.map(e => h("div.at-sbar" + (S.era === e ? ".on" : "") + (tot[e] ? "" : ".zero"), { style:{ "--c":AS.eraColor(e) }, role:"button", tabindex:"0", "aria-label":AS.eraLabel(e),
      onclick:() => commit({ era:S.era === e ? null : e }), onmousemove:ev => AS.tip.show(ev, `<div class="t">${AS.eraLabel(e)}</div><div class="kv"><span>Share of the era</span><span>${fmtPct(shares[e])}</span><span>Objects</span><span>${fmtN(tot[e])}</span></div>`), onmouseleave:AS.tip.hide },
      h("i", { style:{ height:(tot[e] ? Math.max(5, 100 * Math.sqrt(shares[e] / smax)) : 0) + "%" } })))),
    h("div.at-sparkax.mono.faint", {}, h("span", {}, "3000 BCE"), h("span", {}, "1 CE"), h("span", {}, "2000 CE")));
  if (p.top && p.top.length) add(sect("What it makes", "all eras"), h("div.at-tags", {}, p.top.map(t => { const m = /^(.*) \((\d+)\)$/.exec(t); return h("span.at-make", {}, m ? m[1] : t, m ? h("b.mono", {}, fmtN(+m[2])) : null); })));
  if (p.cultures && p.cultures.length) add(sect("Catalogued as"), h("div.at-tags", {}, p.cultures.map(c => h("span.tag.plain", {}, c))));
  const sm = sigItems(i, "sub"), si = sigItems(i, "inst", 5), sa = sigItems(i, "ani");
  const why = r => r.lifted ? "lift · objects" : `counts · under ${MIN_N} each`;
  add(sect("Signature materials", eraTxt() + " · " + why(sm)), sigList(sm, "var(--gold)", d => d.label, x => commit({ lens:"materials", mat:x.d.cat, sub:x.id }, true)));
  if (si.rows.length || (p.instr && p.instr.length)) add(sect("Instruments", why(si)), si.rows.length ? sigList(si, C_INST, d => d.label, x => commit({ lens:"instruments", itype:x.id }, true)) : null,
    p.instr && p.instr.length ? h("div.at-eg.muted", {}, "e.g. " + p.instr.slice(0, 5).map(shortLabel).join(", ")) : null);
  if (sa.rows.length) add(sect("Animals", why(sa)), sigList(sa, C_ANI, d => shortLabel(d.label), x => commit({ lens:"animals", animal:x.id }, true)));
  const near = []; X.EMP.forEach((E, e) => (E.empires || []).forEach((m, k) => { const km = AS.geo.havKm(p.lon, p.lat, m.lon, m.lat); if (km <= NEAR_KM) near.push({ e, k, m, km }); }));
  add(sect("Powers here", `within ${fmtN(NEAR_KM)} km`), near.length ? h("div.at-pw", {}, near.map(x => h("div.at-pwrow" + (S.era === x.e ? ".on" : ""), { role:"button", tabindex:"0", title:x.m.note || "",
      onclick:() => { power = x.k; pendingFly = [x.m.lon, x.m.lat]; commit({ lens:"powers", era:x.e }, true); } }, AS.ui.eraChip(x.e), h("span.at-nm", {}, x.m.name), AS.ui.pips(x.m.strength, 3))))
    : h("div.at-none.muted", {}, "No listed power had its heartland this close. Somebody's periphery, usually."));
  add(sect("Study this region"), h("div.at-links", {},
    h("a.btn.sm", { href:AS.href("tells", { region:reg }) }, "Tells for " + AS.region(reg).short), h("a.btn.sm", { href:AS.href("scripts", { region:reg }) }, "Scripts used here"),
    h("a.btn.sm.primary", { href:AS.href("practice", { mode:"place", region:reg }) }, "Practice this region")));
  return f;
}
})();
