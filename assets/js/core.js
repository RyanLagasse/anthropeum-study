/* Anthropeum Study — core: namespace, eras, regions, helpers, storage, router, shared UI.
   Everything hangs off window.AS. Data lives on window.AS_DATA (filled by data/*.js).
   Classic scripts (no modules) so the site also works from file://. */
(function(){
"use strict";
const AS = window.AS = window.AS || {};
const D = window.AS_DATA = window.AS_DATA || {};
try { if (typeof BORDERS !== "undefined") D.borders = BORDERS; } catch(e){}
/* ?still=1 (before the #) freezes continuous animations — headless screenshots come out blank while a rAF loop is running */
AS.still = /[?&]still=1/.test(location.search);

/* ---------- eras ---------- */
AS.N_ERAS = 20;
AS.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
AS.eraStart = i => -3000 + 250 * i;
AS.eraEnd = i => -2750 + 250 * i;
AS.eraOf = y => AS.clamp(Math.floor((y + 3000) / 250), 0, 19);
AS.fmtYear = y => y < 0 ? `${-y} BCE` : `${y === 0 ? 1 : y} CE`;
AS.fmtYearShort = y => y < 0 ? `${-y} BCE` : `${y === 0 ? 1 : y}`;
AS.eraLabel = i => { const a = AS.eraStart(i), b = AS.eraEnd(i);
  if (b <= 0 && a < 0) return `${-a}–${b === 0 ? "1" : -b} BCE`.replace("–1 BCE", " BCE – 1 CE");
  return `${a === 0 ? 1 : a}–${b} CE`; };
AS.rangeLabel = (y0, y1) => { if (y0 === y1) return AS.fmtYear(y0);
  if (y0 < 0 && y1 < 0) return `${-y0}–${-y1} BCE`; if (y0 >= 0) return `${y0 || 1}–${y1} CE`; return `${-y0} BCE – ${y1} CE`; };
/* one colour per era: ochre (Bronze Age) → rust → crimson → purple → lapis → azure → teal → mint (modern) */
AS.ERA_COLORS = ["#c99a4b","#d39245","#dc8840","#e27c3f","#e66f43","#e7624d","#e5565c","#df4d70","#d44a87","#c44d9f",
                 "#ad55b6","#9160c9","#766dd8","#5f7de2","#4c8fe6","#3fa1e2","#38b1d6","#37bfc2","#3fcaa8","#57d38c"];
AS.eraColor = i => AS.ERA_COLORS[AS.clamp(i, 0, 19)];
/* mnemonic "ages" (Old-World-centric labels; a memory aid, not a claim) */
AS.AGES = [
  { name:"Early Bronze Age", from:0, to:3 }, { name:"Later Bronze Age", from:4, to:6 }, { name:"Iron Age", from:7, to:9 },
  { name:"Classical", from:10, to:11 }, { name:"Imperial · Late Antique", from:12, to:13 }, { name:"Medieval", from:14, to:16 },
  { name:"Early modern", from:17, to:18 }, { name:"Modern", from:19, to:19 } ];
AS.ageOf = i => AS.AGES.find(a => i >= a.from && i <= a.to);
/* which historical-basemap snapshot to show for each era */
AS.ERA2MAP = ["bc3000","bc3000","bc2000","bc2000","bc2000","bc1500","bc1500","bc1000","bc1000","bc700","bc400","bc100","100","400","600","900","1100","1400","1600","1880"];
AS.MODERN_MAP = "2000";
AS.mapKeyLabel = k => k.startsWith("bc") ? `${k.slice(2)} BCE` : `${k} CE`;

/* ---------- regions ---------- */
AS.REGIONS = [
  { id:"eas",    name:"East Asia",                      short:"E Asia",     color:"#ef5350", lat:34,  lon:112 },
  { id:"sas",    name:"South Asia & Himalaya",          short:"S Asia",     color:"#f6a821", lat:23,  lon:79 },
  { id:"sea",    name:"Southeast Asia",                 short:"SE Asia",    color:"#2ec27e", lat:8,   lon:106 },
  { id:"cas",    name:"Central Asia & Steppe",          short:"C Asia",     color:"#d2b48c", lat:42,  lon:66 },
  { id:"wan",    name:"West Asia",                      short:"W Asia",     color:"#22b5c9", lat:33,  lon:44 },
  { id:"egy",    name:"Egypt, Nubia & North Africa",    short:"Egypt · N Africa", color:"#edd15a", lat:27, lon:30 },
  { id:"ssa",    name:"Sub-Saharan Africa",             short:"Africa",     color:"#e07a3f", lat:3,   lon:18 },
  { id:"eur_s",  name:"Southern Europe & Aegean",       short:"S Europe",   color:"#9b7bea", lat:41,  lon:15 },
  { id:"eur_nw", name:"Western & Northern Europe",      short:"NW Europe",  color:"#5d8ff2", lat:50,  lon:5 },
  { id:"eur_e",  name:"Eastern Europe, Russia & Byzantium", short:"E Europe", color:"#c56bd6", lat:50, lon:30 },
  { id:"nam",    name:"North America",                  short:"N America",  color:"#8fb9c9", lat:40,  lon:-98 },
  { id:"mes",    name:"Mesoamerica & Caribbean",        short:"Mesoamerica",color:"#9bd84a", lat:18,  lon:-95 },
  { id:"and",    name:"Andes & South America",          short:"S America",  color:"#f06f9b", lat:-13, lon:-73 },
  { id:"oce",    name:"Oceania & Australia",            short:"Oceania",    color:"#4dd6c1", lat:-12, lon:150 },
];
AS.region = id => AS.REGIONS.find(r => r.id === id) || { id, name:id, short:id, color:"#8f93a6", lat:0, lon:0 };
AS.regionColor = id => AS.region(id).color;
/* lon/lat → region id: nearest of a set of labelled anchor points (for data that only has coordinates) */
const ANCH = { eas:[[116,40],[112,34],[121,31],[113,23],[104,30],[103,36],[127,37],[129,35],[136,35],[140,36],[141,43],[124,42],[121,24],[117,42]],
  sas:[[77,28],[73,19],[80,13],[88,23],[85,27.5],[91,29.6],[80,7.5],[72,34],[68,27],[78,21],[76,10],[74,32],[91,24],[85,20]],
  sea:[[100,14],[105,12],[106,21],[96,19],[102,18],[108,15],[101,4],[110,-7.5],[115,-8.3],[121,15],[124,8],[114,3],[101,0],[120,-3],[125,-8.5]],
  cas:[[106,47],[101,47],[109,40],[94,40],[89,43],[82,41.5],[62.2,34.3],[67,39.6],[69,41],[62,37.6],[59,42],[77,43],[66,48],[75,39.5],[69,34.5],[65,36.7],[72,51],[90,51],[80,50]],
  wan:[[44.4,33.3],[43,36.3],[51.4,35.7],[52.5,29.6],[59.6,36.3],[35.2,31.8],[36.3,33.5],[37,36.2],[32.9,39.9],[28.98,41.03],[29.5,40.3],[27,38.4],[38,38],[44.5,40.2],[44.8,41.7],[49.9,40.4],[46.7,24.7],[44.2,15.4],[39.8,21.4],[56,24],[35.5,33.9],[47,31],[30,37]],
  egy:[[31.2,30],[32.6,25.7],[32.9,24],[31.5,20],[32.5,16],[10.2,36.8],[3,36.7],[-6,33],[-8,31.6],[13.2,32.9],[22,32],[25,29],[30.5,19.5]],
  ssa:[[38.7,9],[39,14.1],[-4,14],[-1.6,6.7],[5.6,6.3],[4.5,7.5],[8.5,12],[12,4],[15.3,-4.3],[23,-5],[28,-11],[18,-12],[31,-17.8],[28,-26],[18.5,-34],[36.8,-1.3],[39.3,-6.8],[47.5,-18.9],[-13.2,9],[-16,14],[-10,6.5],[-5,7.5],[2.4,9.5],[32.5,0.3],[45,2],[9.5,0.4],[13,-9],[25,-18]],
  eur_s:[[23.7,38],[25,35.2],[22.9,40.6],[12.5,41.9],[11.3,43.8],[12.3,45.4],[9.2,45.5],[14.3,40.8],[13.4,38.1],[9,40],[-3.7,40.4],[-5.98,37.4],[2.2,41.4],[-3.6,37.2],[-9.1,38.7],[33.4,35.1],[28.2,36.4],[14.5,35.9],[-8.5,42.9],[16.9,41.1]],
  eur_nw:[[2.35,48.9],[4.8,45.8],[5.4,43.3],[1.4,43.6],[4.9,52.4],[4.4,50.8],[6.96,50.9],[11.6,48.1],[13.4,52.5],[9.99,53.6],[11.1,49.5],[13.7,51.05],[8.5,47.4],[6.1,46.2],[16.4,48.2],[-0.1,51.5],[-3.2,55.95],[-6.3,53.3],[-1.5,53.8],[12.6,55.7],[18.1,59.3],[10.7,59.9],[24.9,60.2],[-21.9,64.1],[-1.6,47.2],[7.75,48.6],[11.4,47.3]],
  eur_e:[[37.6,55.75],[30.3,59.9],[30.5,50.45],[21,52.2],[19.9,50.06],[14.4,50.1],[19.05,47.5],[26.1,44.4],[23.3,42.7],[20.5,44.8],[16,45.8],[18.4,43.85],[26.5,42.5],[34,45],[44,56.3],[24.1,56.95],[25.3,54.7],[49.1,55.8],[39.7,47.2],[27.6,53.9],[21.4,42],[23.6,46.8],[33.5,47.5],[60.6,56.8]],
  nam:[[-74,40.7],[-71.1,42.4],[-77,38.9],[-87.6,41.9],[-90.2,38.6],[-84.4,33.7],[-90.1,30],[-97,32.8],[-105.9,35.7],[-111,33.5],[-109,36.5],[-118.2,34],[-122.4,37.8],[-122.3,47.6],[-128,51],[-132.5,54],[-135,58],[-150,61.2],[-100,46],[-104,41],[-97,49.9],[-79.4,43.7],[-73.6,45.5],[-63.6,44.6],[-95,64],[-68,63.7],[-51.7,64.2],[-112,46.6],[-96,36.2],[-81,28.5],[-110,53]],
  mes:[[-99.1,19.4],[-96.7,17.1],[-98.8,19.7],[-89.6,20.97],[-90.5,14.6],[-89.2,13.7],[-87.2,14.1],[-86.3,12.1],[-84.1,9.9],[-80.9,8.4],[-103.4,20.7],[-104,19.2],[-96.1,19.2],[-92.9,17],[-88.6,17.2],[-82.4,23.1],[-70,18.5],[-66.1,18.4],[-76.8,18],[-61.5,15.4],[-106,24],[-100.3,25.7],[-72.3,18.6]],
  and:[[-77,-12],[-79,-8.1],[-72,-13.5],[-75.7,-14.8],[-68.1,-16.5],[-78.5,-0.2],[-80,-2.2],[-74.1,4.7],[-75.6,6.25],[-76.5,3.4],[-66.9,10.5],[-70.7,-33.4],[-70.3,-18.5],[-65.3,-24.8],[-58.4,-34.6],[-47.9,-15.8],[-43.2,-22.9],[-60,-3.1],[-55.2,5.8],[-57.6,-25.3],[-49,-1.4],[-38.5,-12.97],[-70,-45],[-64.2,-31.4],[-58,5]],
  oce:[[144,-6],[147,-9.4],[143.6,-4.2],[138,-5.5],[152,-4.2],[160,-9.4],[167,-16],[166,-21.5],[178,-18],[-172,-13.8],[-175,-21],[-149.5,-17.6],[-140,-9.5],[-109.4,-27.1],[-157,21],[175,-37],[172,-43.5],[133,-25],[151,-33.9],[131,-12.5],[145,-37.8],[116,-32],[145.7,-17],[158,7],[171,7],[134.5,7.4],[145,14],[-160,-21],[173,1.4],[140.7,-2.5],[136,-4]] };
const ANCH_FLAT = []; for (const r in ANCH) for (const a of ANCH[r]) ANCH_FLAT.push([a[0], a[1], r]);
AS.regionOfPoint = (lon, lat) => { let best = "eur_nw", bd = 1e18; const r = Math.PI / 180, cl = Math.cos(lat * r);
  for (const a of ANCH_FLAT){ let dl = Math.abs(a[0] - lon); if (dl > 180) dl = 360 - dl; const dx = dl * cl, dy = a[1] - lat, d = dx * dx + dy * dy; if (d < bd){ bd = d; best = a[2]; } } return best; };

/* ---------- tiny helpers ---------- */
AS.esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
AS.fmtN = n => Math.round(n).toLocaleString("en-US");
AS.rand = a => a[Math.floor(Math.random() * a.length)];
AS.shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
AS.sample = (a, n) => AS.shuffle(a).slice(0, n);
/* hyperscript: AS.h("div.card.hover", {onclick, style, html, data:{k:v}}, child, "text", [children]) */
AS.h = function(sel, attrs){
  const parts = String(sel).split("."); const tag = parts[0] || "div";
  const SVG = /^(svg|path|circle|rect|line|g|polyline|polygon|text|ellipse|defs|linearGradient|stop|tspan)$/.test(tag);
  const e = SVG ? document.createElementNS("http://www.w3.org/2000/svg", tag) : document.createElement(tag);
  if (parts.length > 1) e.setAttribute("class", parts.slice(1).join(" "));
  let i = 1;
  if (attrs && typeof attrs === "object" && !(attrs instanceof Node) && !Array.isArray(attrs)){
    i = 2;
    for (const k in attrs){ const v = attrs[k]; if (v == null || v === false) continue;
      if (k === "html") e.innerHTML = v; else if (k === "text") e.textContent = v;
      else if (k === "style" && typeof v === "object") for (const s in v){ if (s.startsWith("--")) e.style.setProperty(s, v[s]); else e.style[s] = v[s]; }
      else if (k === "class") e.setAttribute("class", ((e.getAttribute("class") || "") + " " + v).trim());
      else if (k === "data") for (const d in v) e.dataset[d] = v[d];
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v); }
  }
  const add = c => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else e.append(c instanceof Node ? c : document.createTextNode(String(c))); };
  for (; i < arguments.length; i++) add(arguments[i]);
  return e;
};
AS.geo = {
  havKm(lon1, lat1, lon2, lat2){ const R = 6371, r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.min(1, Math.sqrt(a))); },
  /* point at bearing (deg) and distance (km) from lon/lat */
  dest(lon, lat, brg, km){ const r = Math.PI / 180, d = km / 6371, b = brg * r, p1 = lat * r, l1 = lon * r;
    const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
    const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
    return [((l2 / r + 540) % 360) - 180, p2 / r]; },
  /* n points along the great circle */
  arc(lon1, lat1, lon2, lat2, n = 32){ const r = Math.PI / 180, p1 = lat1 * r, l1 = lon1 * r, p2 = lat2 * r, l2 = lon2 * r;
    const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2));
    if (d < 1e-6) return [[lon1, lat1], [lon2, lat2]]; const out = [];
    for (let i = 0; i <= n; i++){ const f = i / n, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
      const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2), y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2), z = A * Math.sin(p1) + B * Math.sin(p2);
      out.push([Math.atan2(y, x) / r, Math.atan2(z, Math.sqrt(x * x + y * y)) / r]); }
    return out; }
};
/* game-style scoring: 5,000 for place + 5,000 for era */
AS.score = {
  pin(km, fullKm = 50, scaleKm = 900){ return km <= fullKm ? 5000 : Math.round(5000 * Math.exp(-(km - fullKm) / scaleKm)); },
  era(guess, truth){ const set = Array.isArray(truth) ? truth : [truth]; let best = 99; for (const e of set) best = Math.min(best, Math.abs(e - guess));
    return best === 0 ? 5000 : best === 1 ? 2500 : best === 2 ? 1000 : 0; }
};

/* ---------- storage + practice log ---------- */
const NS = "anthro.v2.";
AS.store = {
  get(k, def){ try { const v = localStorage.getItem(NS + k); return v == null ? def : JSON.parse(v); } catch(e){ return def; } },
  set(k, v){ try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch(e){} },
  del(k){ try { localStorage.removeItem(NS + k); } catch(e){} }
};
/* One entry per answered question, from any mode. Fields (all optional except mode):
   { t, mode, kind, region, era (true idx), eraGuess, km, pts, max, ok (bool), ref (item id) } */
AS.log = {
  all(){ return AS.store.get("log", []); },
  add(e){ const a = AS.log.all(); e.t = e.t || Date.now(); a.push(e); if (a.length > 5000) a.splice(0, a.length - 5000); AS.store.set("log", a); AS.log.touchStreak(); document.dispatchEvent(new CustomEvent("as:log", { detail:e })); return e; },
  clear(){ AS.store.del("log"); },
  day(t){ const d = new Date(t || Date.now()); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; },
  touchStreak(){ const s = AS.store.get("streak", { last:null, n:0 }), today = AS.log.day();
    if (s.last === today) return s; const y = AS.log.day(Date.now() - 864e5); s.n = s.last === y ? s.n + 1 : 1; s.last = today; AS.store.set("streak", s); return s; },
  streak(){ const s = AS.store.get("streak", { last:null, n:0 }); const today = AS.log.day(), y = AS.log.day(Date.now() - 864e5); return (s.last === today || s.last === y) ? s.n : 0; }
};
/* Leitner-style spaced repetition for card decks (tells, scripts, techniques). box 0..5 */
AS.srs = {
  _k: deck => "srs." + deck,
  state(deck){ return AS.store.get(AS.srs._k(deck), {}); },
  grade(deck, id, ok){ const s = AS.srs.state(deck), c = s[id] || { box:0, due:0, seen:0, right:0 };
    c.seen++; if (ok){ c.right++; c.box = Math.min(5, c.box + 1); } else c.box = Math.max(0, c.box - 2);
    c.due = Date.now() + [0, 1, 3, 7, 16, 35][c.box] * 864e5; s[id] = c; AS.store.set(AS.srs._k(deck), s); return c; },
  /* ids sorted: due-and-seen first (lowest box), then unseen, then not-yet-due */
  order(deck, ids){ const s = AS.srs.state(deck), now = Date.now();
    const key = id => { const c = s[id]; if (!c) return 1e6 + Math.random(); if (c.due <= now) return c.box * 1000 + Math.random(); return 2e6 + c.due / 1e9; };
    return ids.map(id => [key(id), id]).sort((a, b) => a[0] - b[0]).map(x => x[1]); },
  summary(deck, ids){ const s = AS.srs.state(deck); let seen = 0, known = 0, due = 0; const now = Date.now();
    for (const id of ids){ const c = s[id]; if (!c) continue; seen++; if (c.box >= 3) known++; if (c.due <= now) due++; } return { total:ids.length, seen, known, due }; }
};

/* ---------- tooltip / toast / modal ---------- */
let tipEl;
AS.tip = {
  show(ev, html){ if (!tipEl){ tipEl = AS.h("div", { id:"tip" }); document.body.append(tipEl); }
    tipEl.innerHTML = html; tipEl.style.display = "block";
    const x = ev.clientX, y = ev.clientY, w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    tipEl.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x + 16)) + "px";
    tipEl.style.top = Math.max(8, (y + 18 + h > window.innerHeight ? y - h - 12 : y + 18)) + "px"; },
  hide(){ if (tipEl) tipEl.style.display = "none"; }
};
AS.toast = (msg, ms = 2200) => { let host = document.getElementById("toasts"); if (!host){ host = AS.h("div", { id:"toasts" }); document.body.append(host); }
  const t = AS.h("div.toast", { text:msg }); host.append(t); setTimeout(() => { t.style.transition = "opacity .3s"; t.style.opacity = 0; setTimeout(() => t.remove(), 320); }, ms); };
AS.modal = (content, opts = {}) => {
  const close = () => { back.remove(); document.removeEventListener("keydown", onKey); if (opts.onClose) opts.onClose(); };
  const onKey = e => { if (e.key === "Escape") close(); };
  const box = AS.h("div.modal", { style: opts.width ? { width:`min(${opts.width}px,100%)` } : null }, AS.h("button.btn.ghost.icon.x", { "aria-label":"Close", onclick:close }, "✕"), content);
  const back = AS.h("div.modal-back", { onclick:e => { if (e.target === back) close(); } }, box);
  document.body.append(back); document.addEventListener("keydown", onKey); return { close, el:box };
};

/* ---------- small UI builders ---------- */
AS.ui = {
  regionTag(id){ const r = AS.region(id); return AS.h("span.tag", { style:{ "--c":r.color }, title:r.name }, r.short); },
  eraChip(i, label){ return AS.h("span.era-chip", { style:{ "--c":AS.eraColor(i) } }, label || AS.eraLabel(i)); },
  /* chip for an arbitrary year or [y0,y1] span, coloured by the era of its midpoint */
  yearChip(y0, y1){ const mid = y1 == null ? y0 : (y0 + y1) / 2; return AS.h("span.era-chip", { style:{ "--c":AS.eraColor(AS.eraOf(mid)) } }, y1 == null || y1 === y0 ? AS.fmtYear(y0) : AS.rangeLabel(y0, y1)); },
  pips(n, max = 3){ const p = AS.h("span.pips", { title:`strength ${n}/${max}` }); for (let i = 0; i < max; i++) p.append(AS.h("i" + (i < n ? ".on" : ""))); return p; },
  /* segmented control. options: [{value,label}] */
  seg(options, value, onChange, cls = ""){ const el = AS.h("div.seg" + (cls ? "." + cls : ""));
    const render = v => { el.innerHTML = ""; for (const o of options) el.append(AS.h("button" + (o.value === v ? ".on" : ""), { type:"button", title:o.title || null, onclick:() => { if (o.value !== el.value){ el.value = o.value; render(o.value); onChange(o.value); } } }, o.label)); };
    el.value = value; el.set = v => { el.value = v; render(v); }; render(value); return el; },
  /* chip toggle group (single or multi). options: [{value,label,color,n}] ; value: scalar|null or Set */
  chips(options, value, onChange, { multi = false, allowNone = true } = {}){ const el = AS.h("div.chips");
    const isOn = v => multi ? value.has(v) : value === v;
    const render = () => { el.innerHTML = ""; for (const o of options){
      el.append(AS.h("button.chip" + (isOn(o.value) ? ".on" : ""), { type:"button", style:o.color ? { "--c":o.color } : null, onclick:() => {
        if (multi){ value.has(o.value) ? value.delete(o.value) : value.add(o.value); } else value = (value === o.value && allowNone) ? null : o.value;
        render(); onChange(value); } }, o.color ? AS.h("span.dot") : null, o.label, o.n != null ? AS.h("span.n", {}, String(o.n)) : null)); } };
    el.set = v => { value = v; render(); }; render(); return el; },
  /* Era bar: 20 coloured cells (+ optional "All eras" and play buttons, histogram fills, age labels).
     opts: { value:null|0..19, allowAll:true, values:number[20]|null, onChange(i|null), ages:true, compact:false, play:false, log:true }
     returns { el, set(i), setValues(arr), setMarks({truth:[i..], guess:i}|null), setDim(fn|null), destroy() } */
  eraBar(host, opts = {}){
    const o = Object.assign({ value:null, allowAll:true, values:null, ages:true, compact:false, play:false, log:true, onChange(){} }, opts);
    const wrap = AS.h("div.erabar-wrap"), bar = AS.h("div.erabar" + (o.compact ? ".compact" : "")), track = AS.h("div.track");
    let timer = null; const cells = [];
    const allBtn = o.allowAll ? AS.h("button.all", { type:"button", onclick:() => api.set(null, true) }, "All eras") : null;
    const playBtn = o.play ? AS.h("button.play", { type:"button", title:"Play through time", onclick:() => timer ? stop() : start() }, "▶") : null;
    const start = () => { playBtn.textContent = "❚❚"; if (o.value == null || o.value >= 19) api.set(0, true); timer = setInterval(() => { if (o.value >= 19) return stop(); api.set(o.value + 1, true); }, o.playMs || 1100); };
    const stop = () => { clearInterval(timer); timer = null; if (playBtn) playBtn.textContent = "▶"; };
    for (let i = 0; i < 20; i++){ const s = AS.eraStart(i);
      const c = AS.h("div.cell", { style:{ "--c":AS.eraColor(i) }, role:"button", tabindex:"0", "aria-label":AS.eraLabel(i),
        onclick:() => { stop(); api.set(i, true); }, onkeydown:e => { if (e.key === "Enter" || e.key === " "){ e.preventDefault(); api.set(i, true); } },
        onmousemove:e => AS.tip.show(e, `<div class="t">${AS.eraLabel(i)}</div><div class="s">${AS.ageOf(i).name}${o.values && o.tipUnit ? ` · ${AS.fmtN(o.values[i])} ${o.tipUnit}` : ""}</div>`), onmouseleave:AS.tip.hide },
        AS.h("div.fill"), AS.h("div.yr", { html:`${s === 0 ? 1 : Math.abs(s)}<small>${s < 0 ? "BCE" : "CE"}</small>` }));
      cells.push(c); track.append(c); }
    if (playBtn) bar.append(playBtn); if (allBtn) bar.append(allBtn); bar.append(track); wrap.append(bar);
    if (o.ages){ const ag = AS.h("div.erabar-ages", { style:{ marginLeft:"0" } }); for (const a of AS.AGES) ag.append(AS.h("span", { style:{ gridColumn:`${a.from + 1} / ${a.to + 2}` } }, a.name));
      const pad = AS.h("div", { style:{ display:"flex", gap:"8px" } }); if (playBtn) pad.append(AS.h("div", { style:{ width:"38px", flex:"none" } })); if (allBtn) pad.append(AS.h("div.all-pad", { style:{ flex:"none", visibility:"hidden", padding:"0 12px", fontSize:"12px", fontWeight:"600", border:"1px solid transparent", height:"0", overflow:"hidden" } }, "All eras")); ag.style.flex = "1"; pad.append(ag); wrap.append(pad); }
    const paint = () => { cells.forEach((c, i) => c.classList.toggle("on", o.value === i)); if (allBtn) allBtn.classList.toggle("on", o.value == null);
      const v = o.values; if (v){ const f = o.log ? (x => Math.log(1 + x)) : (x => x); const mx = Math.max(1e-9, ...v.map(f)); cells.forEach((c, i) => c.firstChild.style.height = (v[i] > 0 ? Math.max(6, 100 * f(v[i]) / mx) : 0) + "%"); } else cells.forEach(c => c.firstChild.style.height = "0"); };
    const api = { el:wrap, get value(){ return o.value; },
      set(i, fire){ o.value = i; paint(); if (fire) o.onChange(i); },
      setValues(arr){ o.values = arr; paint(); },
      setMarks(m){ cells.forEach((c, i) => { c.classList.toggle("truth", !!m && (m.truth || []).includes(i)); c.classList.toggle("guess", !!m && m.guess === i); }); },
      setDim(fn){ cells.forEach((c, i) => c.classList.toggle("dim", !!fn && fn(i))); },
      stop, destroy(){ stop(); wrap.remove(); } };
    paint(); if (host) host.append(wrap); return api;
  }
};

/* ---------- router ----------
   Views register as AS.views[name] = { title, mount(el, params), unmount?(), update?(params) }.
   URL: #/name?k=v&k2=v2 . AS.go(name, params) navigates; AS.setParams(obj, {replace}) updates the
   URL params of the current view in place (no remount, no update() call: the caller re-renders itself;
   update() is only called on real hash changes such as back/forward and cross-links). */
AS.views = AS.views || {};
let cur = null, curName = null, curParams = {};
const parseHash = () => { const h = location.hash.replace(/^#\/?/, ""); const [name, q] = h.split("?"); const p = {};
  if (q) for (const kv of q.split("&")){ const [k, v] = kv.split("="); if (k) p[decodeURIComponent(k)] = decodeURIComponent(v || ""); } return { name:name || "home", params:p }; };
const makeHash = (name, params) => { const q = Object.entries(params || {}).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&"); return `#/${name}${q ? "?" + q : ""}`; };
AS.params = () => Object.assign({}, curParams);
AS.go = (name, params) => { location.hash = makeHash(name, params); };
AS.href = makeHash;
AS.setParams = (obj, { replace = true } = {}) => { const p = Object.assign({}, curParams, obj); for (const k in p) if (p[k] == null || p[k] === "") delete p[k];
  curParams = p; const hsh = makeHash(curName, p); if (replace) history.replaceState(null, "", hsh); else history.pushState(null, "", hsh); };
function route(){
  const { name, params } = parseHash(); const view = AS.views[name] ? name : "home"; const host = document.getElementById("view"); if (!host) return;
  if (view === curName && cur && cur.update){ curParams = params; cur.update(params); return; }
  if (cur && cur.unmount){ try { cur.unmount(); } catch(e){ console.error(e); } }
  AS.tip.hide(); host.innerHTML = ""; curName = view; curParams = params; cur = AS.views[view];
  const el = AS.h("div.view", { data:{ view } }); host.append(el);
  document.querySelectorAll("#rail a.nav").forEach(a => a.classList.toggle("on", a.dataset.view === view));
  document.title = (cur && cur.title ? cur.title + " · " : "") + "Anthropeum Study";
  if (!cur){ el.append(AS.h("div.empty", {}, "This room is still being built.")); return; }
  try { cur.mount(el, params); } catch(e){ console.error(e); el.append(AS.h("div.empty", {}, "Something broke while opening this view: " + e.message)); }
}
AS.start = () => { window.addEventListener("hashchange", route); route(); const s = document.querySelector("#rail .streak b"); if (s){ const upd = () => s.textContent = AS.log.streak(); upd(); document.addEventListener("as:log", upd); } };
/* global keys: g then a/w/t/s/p handled lightly — digits 1-6 jump between rooms unless typing */
document.addEventListener("keydown", e => { if (e.metaKey || e.ctrlKey || e.altKey) return; const t = e.target; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
  const order = ["home", "atlas", "when", "tells", "scripts", "practice"]; const n = parseInt(e.key, 10); if (n >= 1 && n <= order.length && AS.views[order[n - 1]] && !document.querySelector(".modal-back") && !(cur && cur.ownsDigits)) AS.go(order[n - 1]); });
})();
