/* Anthropeum Study — variant "Game Board": static comp built from the real data + the shared map engine. */
(function(){
"use strict";
const AS = window.AS, D = window.AS_DATA, h = AS.h, esc = AS.esc, fmtN = AS.fmtN;
const page = document.getElementById("page");
if (D.scripts && D.scripts.fontsCss) document.head.append(h("link", { rel:"stylesheet", href:D.scripts.fontsCss }));

/* ---------- colour system ---------- */
const INK = "#1a1814", WHITE = "#fffdf7";
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
const lum = c => { const [r, g, b] = hex(c).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
const tx = c => lum(c) > .3 ? INK : "#ffffff";
/* eras: five hues, one per millennium; four steps light → full inside each */
const ERA_HUES = ["#ffc42e", "#f2553d", "#ee4f9c", "#7b4fe0", "#2e6fe6"], ERA_NAMES = ["Yellow", "Red", "Pink", "Violet", "Blue"];
const ERA = []; for (let i = 0; i < 20; i++) ERA.push(mix(ERA_HUES[i >> 2], "#fffaf0", [.66, .44, .22, 0][i & 3]));
const eraC = i => ERA[AS.clamp(i, 0, 19)];
/* regions: hue family = part of the world */
const REG = { eas:"#e5432d", sas:"#ff8c2b", sea:"#ff7fb2", cas:"#a8482a", wan:"#ffc42e", egy:"#c48a00", ssa:"#7a4a21",
  eur_s:"#7b4fe0", eur_nw:"#6fb1ff", eur_e:"#b79cf7", nam:"#1fa971", mes:"#a6d93a", and:"#0c6b4b", oce:"#22c7c7" };
const RSHORT = { eas:"E Asia", sas:"S Asia", sea:"SE Asia", cas:"C Asia", wan:"W Asia", egy:"Egypt", ssa:"Africa", eur_s:"S Eur", eur_nw:"NW Eur", eur_e:"E Eur", nam:"N Am", mes:"Meso", and:"Andes", oce:"Oceania" };
const FAMS = [["Asia", ["eas", "sas", "sea", "cas"]], ["West Asia and Africa", ["wan", "egy", "ssa"]], ["Europe", ["eur_s", "eur_nw", "eur_e"]], ["Americas", ["nam", "mes", "and"]], ["Pacific", ["oce"]]];
const rname = id => AS.region(id).name, rshort = id => AS.region(id).short;

/* ---------- shared bits ---------- */
const IC = {
  Desk:'<rect x="3" y="4" width="18" height="12" rx="2.5"/><path d="M8 20.5h8M12 16v4.5"/>',
  Atlas:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.2 3 3.2 15 0 18M12 3c-3.2 3-3.2 15 0 18"/>',
  When:'<path d="M6 3h12M6 21h12M7.5 3c0 5 9 5 9 9s-9 4-9 9M16.5 3c0 5-9 5-9 9s9 4 9 9"/>',
  Tells:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
  Scripts:'<path d="M3 19L8 5l5 14M5 14.5h6M15.5 9h6M18.5 9v10"/>',
  Practice:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>' };
const PIN = c => `<svg viewBox="0 0 38 48"><path d="M19 2.5C9.9 2.5 2.5 9.6 2.5 18.4 2.5 30 19 45.5 19 45.5S35.5 30 35.5 18.4C35.5 9.6 28.1 2.5 19 2.5z" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="19" cy="18" r="6" fill="${WHITE}" stroke="${INK}" stroke-width="3"/></svg>`;
function shell(active){
  const tabs = ["Desk", "Atlas", "When", "Tells", "Scripts", "Practice"].map(n =>
    `<a class="tab${n === "Practice" ? " play" : ""}${n === active ? " on" : ""}"><svg viewBox="0 0 24 24">${IC[n]}</svg>${n}</a>`).join("");
  return `<header class="bar">
    <div class="brand"><i><svg viewBox="0 0 38 48"><path d="M19 3C10 3 3 10 3 18.5 3 30 19 45 19 45S35 30 35 18.5C35 10 28 3 19 3z" fill="${WHITE}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><circle cx="19" cy="18" r="5" fill="${INK}"/></svg></i>
      <div>Anthropeum Study<small>Where and when</small></div></div>
    <nav class="tabs">${tabs}</nav><div class="sp"></div>
    <div class="piece"><b>7</b><span><strong>day streak</strong>best 19</span></div>
    <div class="piece sq"><b class="num">6,680</b><span><strong>last object</strong>out of 10,000</span></div>
  </header>`;
}
function eraBar(o = {}){
  const cells = []; for (let i = 0; i < 20; i++){ const s = AS.eraStart(i), c = eraC(i);
    cells.push(`<div class="c${o.on === i ? " on" : ""}" style="--c:${c};--t:${tx(c)}">${s < 0 ? -s : s || 1}<small>${s < 0 ? "BCE" : "CE"}</small></div>`); }
  let out = `<div class="era ${o.cls || ""}">${cells.join("")}</div>`;
  if (o.ages) out += `<div class="ages">${AS.AGES.map(a => `<span style="grid-column:${a.from + 1}/${a.to + 2}">${esc(a.name)}</span>`).join("")}</div>`;
  return out;
}
const strip = (from, to) => { let s = ""; for (let i = 0; i < 20; i++){ const on = AS.eraEnd(i) > from && AS.eraStart(i) < to; s += `<i class="${on ? "on" : ""}" style="--c:${eraC(i)}"></i>`; } return `<div class="strip">${s}</div>`; };
const eraTag = (y0, y1) => { const c = eraC(AS.eraOf((y0 + y1) / 2)); return `<span class="tag" style="--c:${c};--t:${tx(c)}">${esc(AS.rangeLabel(y0, y1))}</span>`; };
const regTag = id => { const c = REG[id]; return `<span class="tag" style="--c:${c};--t:${tx(c)}">${esc(rshort(id))}</span>`; };
let nFrame = 0;
function frame(name, line, room, body, style){
  nFrame++;
  page.append(h("div.cap", { html:`<b>${String(nFrame).padStart(2, "0")}</b><h2>${name}</h2><p>${line}</p>` }));
  const s = h("section.screen", { style:style || null, html:shell(room) + `<div class="body">${body}</div>` }); page.append(s); return s;
}

/* ---------- map overlay: chunky DOM markers laid over the canvas map, kept in sync with pan/zoom ---------- */
function overlay(host, map, items, lines){
  const ov = h("div.ov"); host.append(ov);
  const NS = "http://www.w3.org/2000/svg"; const svg = document.createElementNS(NS, "svg"); ov.append(svg);
  const ls = (lines || []).map(l => { const a = document.createElementNS(NS, "line"), b = document.createElementNS(NS, "line");
    a.setAttribute("stroke", WHITE); a.setAttribute("stroke-width", 9); a.setAttribute("stroke-linecap", "round");
    b.setAttribute("stroke", INK); b.setAttribute("stroke-width", 4); b.setAttribute("stroke-linecap", "round"); b.setAttribute("stroke-dasharray", "2 10");
    svg.append(a, b); const lab = l.label ? h("div.lb.dist", l.label) : null; return { l, a, b, lab }; });
  const els = items.map(it => { let m;
    if (it.type === "pin") m = h("div.mk.pin", { html:PIN(it.color) });
    else { m = h("div.mk" + (it.r < 7 ? ".sm" : "") + (it.type === "pow" ? ".pow" : ""), { style:{ "--c":it.color, width:it.r * 2 + "px", height:it.r * 2 + "px" } }); }
    ov.append(m); return { it, m, l:it.label ? h("div.lb" + (it.cls ? "." + it.cls : ""), it.label) : null }; });
  for (const e of els) if (e.l) ov.append(e.l); for (const e of ls) if (e.lab) ov.append(e.lab);
  const order = els.filter(e => e.l).sort((a, b) => (b.it.always ? 1e9 : 0) + (b.it.pri || 0) - (a.it.always ? 1e9 : 0) - (a.it.pri || 0));
  function lay(){
    const W = host.clientWidth, H = host.clientHeight;
    for (const e of els){ const p = map.project(e.it.lon, e.it.lat); e.x = p[0]; e.y = p[1]; e.m.style.left = p[0] + "px"; e.m.style.top = p[1] + "px"; }
    const boxes = [];
    for (const e of order){ const up = e.it.type === "pin" ? 52 : e.it.r + 6; const w = e.w || (e.w = e.l.offsetWidth || 60), hh = 22; const x = e.x, y = e.y - up;
      const b = [x - w / 2 - 2, y - hh - 2, x + w / 2 + 2, y + 2]; const out = b[0] < 4 || b[2] > W - 4 || b[1] < 4 || b[3] > H - 4;
      if (out || (!e.it.always && boxes.some(q => !(b[2] < q[0] || b[0] > q[2] || b[3] < q[1] || b[1] > q[3])))){ e.l.style.display = "none"; continue; }
      boxes.push(b); e.l.style.display = ""; e.l.style.left = x + "px"; e.l.style.top = y + "px"; }
    for (const e of ls){ const p = map.project(e.l.from[0], e.l.from[1]), q = map.project(e.l.to[0], e.l.to[1]);
      for (const n of [e.a, e.b]){ n.setAttribute("x1", p[0]); n.setAttribute("y1", p[1]); n.setAttribute("x2", q[0]); n.setAttribute("y2", q[1]); }
      if (e.lab){ e.lab.style.left = (p[0] + q[0]) / 2 + 52 + "px"; e.lab.style.top = (p[1] + q[1]) / 2 + 20 + "px"; } }
  }
  let timer = 0, n = 0; const kick = () => { n = 0; if (timer) return; timer = setInterval(() => { lay(); if (++n > 45){ clearInterval(timer); timer = 0; } }, 40); };
  for (const ev of ["wheel", "pointerdown", "pointermove", "pointerup", "dblclick"]) host.addEventListener(ev, kick, { passive:true });
  window.addEventListener("resize", kick); kick(); return { lay, kick };
}
function makeMap(host, opts, items, lines){ const map = AS.createMap(host, Object.assign({ controls:false }, opts)); const o = overlay(host, map, items || [], lines); return { map, kick:o.kick }; }

/* ================= 1. Shell + Desk ================= */
const DESK_ERA = 12, powers = D.empires.eras[DESK_ERA].empires;
frame("Shell + Desk", "Top tab bar of six labelled buttons; the room you are in is the pressed one. Streak and score sit in the bar as pieces.", "Desk", `
<div class="desk">
  <div class="left">
    <div><div class="eyebrow">Sunday 15 November</div><h1>Your desk</h1><p class="lede">Ten practice objects are ready. Three weak spots to drill first if you have time.</p></div>
    <div class="card cta">
      <div class="row"><div class="grow" style="white-space:nowrap"><div class="eyebrow" style="color:${INK};margin-bottom:5px">Practice round</div><h3>Object 4 of 10</h3></div><span class="tag">about 5 min left</span></div>
      <div class="pips" style="gap:6px">${Array.from({ length:10 }, (_, i) => `<i style="flex:1;height:12px" class="${i < 3 ? "d" : i === 3 ? "cur" : ""}"></i>`).join("")}</div>
      <div class="row"><a class="btn red big">Continue round</a><span style="font-weight:600;font-size:13.5px;line-height:1.3">19,410 so far<br>avg 6,470 per object</span></div>
    </div>
    <div class="trio">
      <div class="card stat" style="--c:${ERA_HUES[1]};--t:#fff"><b>7</b><span>day streak</span></div>
      <div class="card stat"><b>312</b><span>objects answered</span></div>
      <div class="card stat"><b>61<small>%</small></b><span>average score</span></div>
    </div>
    <div class="card todo" style="flex:1">
      <h4 style="margin-bottom:4px">Work on these</h4>
      <div class="it"><i class="sw" style="--c:${REG.cas}"></i><p class="grow">Central Asia &amp; Steppe<span>median pin error 2,310 km over 18 objects</span></p><a class="btn sm">Atlas</a></div>
      <div class="it"><i class="sw" style="--c:${eraC(9)}"></i><p class="grow">750–500 BCE<span>right era 3 times out of 11</span></p><a class="btn sm">When</a></div>
      <div class="it"><i class="sw" style="--c:${REG.sea}"></i><p class="grow">Khmer vs Thai vs Burmese Buddhas<span>missed twice this week</span></p><a class="btn sm">Tells</a></div>
      <div class="it"><i class="sw" style="--c:${WHITE}"></i><p class="grow">14 tells due for review<span>last reviewed 4 days ago</span></p><a class="btn sm yellow">Review</a></div>
    </div>
  </div>
  <div class="right">
    <div class="maphead"><h3>The world in ${AS.eraLabel(DESK_ERA)}</h3><span class="tag">Borders c. ${AS.mapKeyLabel(AS.ERA2MAP[DESK_ERA])}</span><div class="grow"></div>
      <span class="key"><i style="width:22px;height:22px;--c:${ERA_HUES[0]}"></i>Major power</span><span class="key"><i style="width:17px;height:17px;--c:${WHITE}"></i>Regional</span><span class="key"><i style="width:12px;height:12px;--c:${WHITE}"></i>Local</span></div>
    <div class="map" id="m-desk" style="flex:1;min-height:470px"><div class="zoom"><b>+</b><b>−</b></div></div>
    <div class="card erawrap">${eraBar({ on:DESK_ERA, ages:true })}</div>
  </div>
</div>`);
const md = makeMap(document.getElementById("m-desk"), { year:AS.ERA2MAP[DESK_ERA], mode:"polities" },
  powers.map(p => ({ lon:p.lon, lat:p.lat, type:"pow", r:[0, 6.5, 9, 12][p.strength], color:p.strength === 3 ? ERA_HUES[0] : WHITE, label:p.name, cls:p.strength === 3 ? "big" : "", pri:p.strength, always:p.strength === 3 })));

setTimeout(() => { md.map.flyTo(12, 20, 1.17, 0); md.kick(); }, 250);
/* ================= 2. Atlas ================= */
const G = D.agg.global, places = D.agg.places.map(p => { let s = 0, n = 0; for (let e = 0; e < 20; e++){ if (G[e][0] > 0){ s += p.counts[e][0] / G[e][0]; n++; } }
  return { name:p.name, lon:p.lon, lat:p.lat, total:p.total, share:s / n, reg:AS.regionOfPoint(p.lon, p.lat) }; }).sort((a, b) => b.share - a.share);
const maxS = places[0].share, top3 = places.slice(0, 3).reduce((s, p) => s + p.share, 0);
const pct = v => v >= .1 ? Math.round(v * 100) + "%" : (v * 100).toFixed(1) + "%";
const regShare = {}; for (const p of places) regShare[p.reg] = (regShare[p.reg] || 0) + p.share;
const regTop = Object.keys(regShare).sort((a, b) => regShare[b] - regShare[a]).slice(0, 5);
frame("Atlas", "Flat board map with outlined region-coloured counters; the ranked list is a plain table with bars, kept dense.", "Atlas", `
<div class="row">
  <div class="seg">${["Places", "Powers", "Materials", "Instruments", "Animals"].map((n, i) => `<button class="${i ? "" : "on"}">${n}</button>`).join("")}</div>
  <div class="grow"></div>
  <span class="toggle"><i></i>Exclude works on paper</span>
  <div class="seg y">${["Balanced", "Raw", "Signature"].map((n, i) => `<button class="${i ? "" : "on"}">${n}</button>`).join("")}</div>
</div>
<div class="row" style="align-items:flex-start"><a class="btn ink sm" style="height:36px;box-shadow:none">All eras</a><div class="grow">${eraBar({ cls:"sm" })}</div></div>
<div class="atlas">
  <div class="map" id="m-atlas" style="min-height:560px">
    <div class="mapkey kstrip"><span class="eyebrow">Share by region</span>${regTop.map(r => `<span><i class="dot" style="--c:${REG[r]}"></i>${esc(rshort(r))} <em>${pct(regShare[r])}</em></span>`).join("")}
      <div class="sizes"><i style="width:10px;height:10px"></i>1%<i style="width:22px;height:22px;margin-left:5px"></i>10%<i style="width:30px;height:30px;margin-left:5px"></i>40%</div></div>
    <div class="zoom top"><b>+</b><b>−</b></div>
  </div>
  <div class="side">
    <div class="trio">
      <div class="card stat" style="--c:${ERA_HUES[0]}"><b style="font-size:27px">${fmtN(D.agg.meta.dated)}</b><span>dated objects</span></div>
      <div class="card stat"><b style="font-size:27px">${places.length}</b><span>places on the map</span></div>
      <div class="card stat"><b style="font-size:27px">${Math.round(top3 * 100)}<small>%</small></b><span>held by the top three</span></div>
    </div>
    <div class="card rank">
      <div class="hd"><h4>Top places</h4><span>share · objects</span></div>
      ${places.slice(0, 15).map((p, i) => `<div class="rk${i === 0 ? " on" : ""}"><i>${i + 1}</i><b>${esc(p.name)}</b><div class="bar2"><u style="--c:${REG[p.reg]};width:${p.share / maxS * 100}%"></u></div><span class="p">${pct(p.share)}</span><span class="n">${fmtN(p.total)}</span></div>`).join("")}
    </div>
  </div>
</div>`);
const ma = makeMap(document.getElementById("m-atlas"), { year:AS.MODERN_MAP, mode:"quiet" },
  places.map((p, i) => ({ lon:p.lon, lat:p.lat, r:Math.max(4, 3 + 27 * Math.sqrt(p.share / maxS)), color:REG[p.reg], label:i < 16 ? p.name : null, pri:p.share, cls:i === 0 ? "big" : "", always:i === 0 })));

setTimeout(() => { ma.map.flyTo(14, 24, 1.13, 0); ma.kick(); }, 250);
/* ================= 3. Tells ================= */
const tell = id => D.tells.tells.find(t => t.id === id), strengthPips = n => `<span class="pipsd">${[1, 2, 3].map(i => `<i class="${i <= n ? "f" : ""}"></i>`).join("")}</span>`;
function tellCard(id, state){ const t = tell(id), c = REG[t.place.region];
  const head = `<div class="top" style="--c:${c};--t:${tx(c)}">${esc(rname(t.place.region))}<span class="tag">${esc(t.medium)}</span></div>`;
  let body = `<h3>${esc(t.title)}</h3><p class="cue">${esc(t.cue)}</p>`;
  if (state === "covered") body += `<div class="cover"><b>What does it tell you?</b><a class="btn yellow">Show answer</a></div>`;
  else { body += `<div class="ans"><div class="where"><span class="tag" style="--c:${INK};--t:${WHITE}">${esc(t.place.label)}</span>${eraTag(t.years[0], t.years[1])}<span class="tag">strength&nbsp;${strengthPips(t.strength)}</span></div><p>${esc(t.infer)}</p></div>
      <div class="warn"><b>Misleads when</b><p>${esc(t.caveat)}</p></div>`;
    body += state === "known" ? `<div class="stamp">Knew it · next review in 9 days</div>` : `<div class="acts"><a class="btn green">Knew it</a><a class="btn">Didn't</a></div>`; }
  return `<div class="card tell">${head}<div class="in">${body}</div></div>`; }
const LK = D.tells.lookalikes[0], media = ["ceramics", "sculpture", "metalwork", "painting", "textile", "jewelry", "glass", "manuscript", "coins", "lacquer", "arms", "mask"];
const contC = [ERA_HUES[1], ERA_HUES[0], ERA_HUES[4]];
frame("Tells", "Tells are cards you flip: cue on top, answer under a cover, caveat in red, two big answer buttons.", "Tells", `
<div class="row"><div class="seg"><button class="on">Study</button><button>Quiz</button><button>Lookalikes</button></div><div class="grow"></div>
  <span style="font-weight:600;font-size:14px;color:var(--mute)"><b style="color:${INK}">${D.tells.tells.length}</b> tells · 14 due · 86 known</span><a class="btn sm">Shuffle</a></div>
<div class="filters">
  <span class="eyebrow">Region</span><div class="ch"><span class="chip on">All</span>${AS.REGIONS.map(r => `<span class="chip"><i style="--c:${REG[r.id]}"></i>${esc(r.short)}</span>`).join("")}</div>
  <span class="eyebrow">Medium</span><div class="ch"><span class="chip on">All</span>${media.map(m => `<span class="chip">${m}</span>`).join("")}</div>
</div>
<div class="tells">${tellCard("fayum-portrait", "covered")}${tellCard("goryeo-inlaid-celadon", "open")}${tellCard("cycladic-figure", "known")}${tellCard("ife-striated-head", "covered")}</div>
<div class="card look">
  <div><span class="tag" style="--c:${INK};--t:${WHITE}">Lookalikes</span><h3>${esc(LK.title)}</h3><p class="blurb">${esc(LK.blurb)}</p><div class="quick"><b>Quick test</b>${esc(LK.quickTest)}</div></div>
  ${LK.contenders.map((c, i) => `<div class="cont"><h4 style="--c:${contC[i]};--t:${tx(contC[i])}">${esc(c.label)}</h4><ul>${c.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul></div>`).join("")}
</div>`);

/* ================= 4. When ================= */
const T = id => D.techniques.techniques.find(t => t.id === id);
const rows = ["potters-wheel", "iron-smelting", "coinage", "paper", "glassblowing", "stirrups", "porcelain", "woodblock-printing", "tin-glaze", "blue-and-white", "oil-painting", "photography"].map(T), SEL = "glassblowing";
const X = y => (y + 3000) / 50, yr = y => "c. " + AS.fmtYear(y);
function trow(t){ const o = t.origin.year, end = t.end && t.end.year != null ? t.end.year : 2000, c = REG[t.origin.region], x0 = Math.max(0, X(o));
  const ticks = t.arrivals.filter(a => a.year >= -3000).map(a => `<i class="a" style="left:${X(a.year)}%;--c:${REG[a.region]}"></i>`).join("");
  return `<div class="trow${t.id === SEL ? " on" : ""}"><div class="nm">${esc(t.name.replace(/ \(.*/, ""))}<small>${o < -3000 ? "before 3000 BCE" : yr(o)} · ${esc(t.origin.place.replace(/ \(.*/, ""))}</small></div>
    <div class="trk"><i class="b${o < -3000 ? " open" : ""}${end < 2000 ? "" : " cut"}" style="left:${x0}%;width:${X(end) - x0}%;--c:${mix(c, "#fffaf0", .45)}"></i>${o >= -3000 ? `<i class="o" style="left:${x0}%"></i>` : ""}${ticks}</div></div>`; }
const sel = T(SEL), ruleM = sel.rule.match(/^(.*?[^c])\. (?=[A-Z])/), rule1 = (ruleM ? ruleM[1] : sel.rule).split("⇒"), ruleRest = ruleM ? sel.rule.slice(ruleM[0].length) : "";
const tickRegs = []; for (const t of rows) for (const a of t.arrivals) if (!tickRegs.includes(a.region)) tickRegs.push(a.region);
frame("When", "First appearances as a chart: one row per technique, bar starts where it starts, a dot each time it reaches a new region.", "When", `
<div class="row"><div class="seg"><button class="on">First appearances</button><button>Rules</button><button>Quiz</button></div>
  <div class="ch" style="display:flex;gap:6px;margin-left:8px"><span class="chip on">All ${D.techniques.techniques.length}</span>${D.techniques.groups.slice(0, 8).map(g => `<span class="chip">${esc(g.name.replace(/[,&].*/, "").trim())}</span>`).join("")}</div>
  <div class="grow"></div><span class="toggle"><i></i>Sort by date</span></div>
<div class="when">
  <div class="card tl">
    <div class="tlg" style="margin-bottom:8px"><div class="eyebrow">Technique · first seen</div>${eraBar({ cls:"xs" })}</div>
    <div class="tlg">${rows.map(trow).join("")}</div>
    <div class="row" style="margin-top:12px;flex-wrap:wrap;gap:6px 14px;font:600 12.5px/1 var(--f-body)"><span class="eyebrow">Arrives in</span>${AS.REGIONS.filter(r => tickRegs.includes(r.id)).map(r => `<span class="row" style="gap:5px"><i class="dot" style="--c:${REG[r.id]}"></i>${esc(r.short)}</span>`).join("")}</div>
  </div>
  <div class="card rule">
    <div class="row"><span class="tag" style="--c:${INK};--t:${WHITE}">Rule</span>${regTag(sel.origin.region)}<span class="tag">confidence: ${esc(sel.confidence)}</span></div>
    <div class="big">${esc(rule1[0].trim())} <em>⇒ ${esc((rule1[1] || "").trim())}</em></div>
    <p>${esc(ruleRest)}</p>
    <div><div class="eyebrow" style="margin-bottom:5px">Look for</div><p>${esc(sel.lookFor.split("; ").slice(0, 2).join("; "))}.</p></div>
    <div><div class="eyebrow" style="margin-bottom:7px">Starts, then arrives</div>
      <div class="arr"><i class="dot" style="--c:${REG[sel.origin.region]}"></i><b>${esc(sel.origin.place)}</b><em>${AS.fmtYear(sel.origin.year)}</em>
      ${sel.arrivals.map(a => `<i class="dot" style="--c:${REG[a.region]}"></i><span>${esc(a.place)}</span><em>${AS.fmtYear(a.year)}</em>`).join("")}</div></div>
  </div>
</div>`);

/* ================= 5. Scripts ================= */
const S = id => D.scripts.scripts.find(s => s.id === id), SSEL = "arabic-kufic";
const stiles = ["egyptian-hieroglyphs", "cuneiform", "chinese", "greek", "arabic-kufic", "devanagari", "runic", "tibetan"].map(S), ssel = S(SSEL);
const ff = s => `font-family:'${s.font}',serif;direction:${s.dir === "rtl" ? "rtl" : "ltr"}`, sname = s => s.name.replace(/ \(.*/, "").replace(/:.*/, m => m === ": Kufic (angular) styles" ? " Kufic" : m);
frame("Scripts", "Each script is a tile: specimen on its region colour, name, dates, and the 20-era strip so you can read the span at a glance.", "Scripts", `
<div class="row"><div class="seg"><button class="on">Specimens</button><button>Map</button><button>Quiz</button></div>
  <div class="ch" style="display:flex;gap:6px;margin-left:8px"><span class="chip on">All ${D.scripts.scripts.length}</span>${["East Asia", "South Asia", "West Asia", "Egypt", "Europe", "Americas"].map(n => `<span class="chip">${n}</span>`).join("")}</div>
  <div class="grow"></div><div class="seg y"><button class="on">Oldest first</button><button>A–Z</button></div></div>
<div class="scripts">
  <div class="sgrid">${stiles.map(s => { const c = mix(REG[s.areas[0].region], "#fffaf0", .58);
    return `<div class="card sc${s.id === SSEL ? " on" : ""}"><div class="sm" style="--c:${c};${ff(s)};font-size:${[...s.sample].length > 15 ? 30 : [...s.sample].length > 11 ? 37 : 46}px">${esc(s.sample)}</div>
      <div class="inf"><h4>${esc(sname(s))}</h4><div class="dt">${esc(AS.rangeLabel(s.from, s.to))}</div>${strip(s.from, s.to)}</div></div>`; }).join("")}</div>
  <div class="card spec">
    <div class="sm" style="${ff(ssel)}">${esc(ssel.sample)}<small style="direction:ltr">${esc(ssel.sampleMeaning.split(",")[0])}</small></div>
    <div class="in">
      <div><h3>${esc(sname(ssel))}</h3><div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap">${eraTag(ssel.from, ssel.to)}${[...new Set(ssel.areas.map(a => a.region))].map(regTag).join("")}<span class="tag">right to left</span></div></div>
      ${strip(ssel.from, ssel.to)}
      <div class="eyebrow">Look for</div>
      <ol>${ssel.look.slice(0, 4).map(l => `<li><span>${esc(l)}</span></li>`).join("")}</ol>
      <div class="eyebrow" style="margin-top:3px">Usually on</div><p style="font-size:13.8px;line-height:1.4">${esc(ssel.onWhat)}</p>
      <div class="row" style="margin-top:auto"><a class="btn yellow">Compare with Naskh</a><a class="btn">Where it was used</a></div>
    </div>
  </div>
</div>`);

/* ================= 6. Practice ================= */
const OBJ = D.gallery.objects.find(o => o.id === "cma-136466") || D.gallery.objects.find(o => o.src === "cma");
const GUESS = { lon:104.1, lat:30.6, era:6, near:"Sichuan basin" };
const km = AS.geo.havKm(GUESS.lon, GUESS.lat, OBJ.lon, OBJ.lat), dE = Math.abs(GUESS.era - OBJ.era);
const sPlace = Math.round(5000 * Math.exp(-km / 2500) / 10) * 10, sEra = [5000, 3500, 2000, 900, 300][Math.min(4, dE)], sTot = sPlace + sEra;
const pips = (done, cur) => `<div class="pips">${Array.from({ length:10 }, (_, i) => `<i class="${i < done ? "d" : i === cur ? "cur" : ""}"></i>`).join("")}</div>`;
frame("Practice · question", "Your turn: photo left, two numbered steps right, one red button. Nothing else competes with Lock in.", "Practice", `
<div class="pgrid">
  <div class="card photo"><img src="${esc(OBJ.img)}" alt="Practice object">
    <div class="q"><span class="tag" style="--c:${ERA_HUES[0]}">Object 4 of 10</span>${pips(3, 3)}</div>
    <span class="tag cr">Photo: ${esc(OBJ.credit)}</span></div>
  <div class="playr">
    <div class="step"><b>1</b>Where was it made?<span>Click the map to move your pin.</span></div>
    <div class="map" id="m-q" style="flex:1;min-height:380px"><div class="mapnote"><span class="tag">Modern borders</span></div><div class="zoom"><b>+</b><b>−</b></div></div>
    <div class="step"><b>2</b>When?<span>Pick one of the twenty eras.</span></div>
    <div style="padding-top:7px">${eraBar({ cls:"pick", on:GUESS.era })}</div>
    <div class="card lock" style="margin-top:10px"><p class="grow"><b>${GUESS.near} · ${AS.eraLabel(GUESS.era)}</b>Pin at ${GUESS.lat.toFixed(1)}°N ${GUESS.lon.toFixed(1)}°E, ${esc(rname(AS.regionOfPoint(GUESS.lon, GUESS.lat)))}</p>
      <a class="btn">Clear pin</a><a class="btn red big">Lock in</a></div>
  </div>
</div>`);
const mq = makeMap(document.getElementById("m-q"), { year:AS.MODERN_MAP, mode:"quiet", crosshair:true }, [{ lon:GUESS.lon, lat:GUESS.lat, type:"pin", color:ERA_HUES[1], label:"Your pin", cls:"guess", always:true }]);
setTimeout(() => { mq.map.flyTo(88, 30, 2.3, 0); mq.kick(); }, 250);

const regErr = { eas:640, sas:980, sea:1420, cas:2310, wan:890, egy:310, ssa:1760, eur_s:520, eur_nw:470, eur_e:1240, nam:1390, mes:760, and:1080, oce:2650 }, maxErr = 2650;
frame("Practice · reveal and calibration", "The score is the biggest thing on the screen. Place and era are scored on separate bars; calibration sits underneath as tiles.", "Practice", `
<div class="reveal">
  <div class="card obj"><div class="ph"><img src="${esc(OBJ.img)}" alt="Practice object"></div>
    <div class="in"><h3>${esc(OBJ.title)}</h3>
      <dl class="dl"><dt>Place</dt><dd>${esc(OBJ.place)}</dd><dt>Date</dt><dd>${esc(OBJ.dateText || OBJ.dateLabel)} · ${esc(OBJ.culture)}</dd><dt>Made of</dt><dd>${esc(OBJ.medium)}</dd><dt>Held by</dt><dd>${esc(OBJ.credit)}</dd></dl>
      <div class="row" style="margin-top:auto;gap:6px">${regTag(OBJ.region)}${eraTag(OBJ.y0, OBJ.y1)}<span class="tag">${esc(OBJ.type)}</span></div></div></div>
  <div class="map" id="m-r"><div class="mapnote"><span class="tag" style="--c:var(--green);--t:#fff">Answer</span><span class="tag" style="--c:var(--red);--t:#fff">Your pin</span></div></div>
  <div class="score">
    <div class="card total"><div class="row"><div class="eyebrow grow" style="color:${INK}">Object 4 of 10</div>${pips(4, -1)}</div><b class="num" style="font-family:var(--f-display)">${fmtN(sTot)}<small>/ 10,000</small></b></div>
    <div class="card ln"><div class="t">Place<em>${fmtN(sPlace)} / 5,000</em></div><div class="m"><u style="--c:var(--green);width:${sPlace / 50}%"></u></div><p><b>${fmtN(Math.round(km / 10) * 10)} km off.</b> Right country, wrong river valley: Anyang is on the north China plain.</p></div>
    <div class="card ln"><div class="t">Era<em>${fmtN(sEra)} / 5,000</em></div><div class="m"><u style="--c:${eraC(OBJ.era)};width:${sEra / 50}%"></u></div><p><b>One era early.</b> You picked ${AS.eraLabel(GUESS.era)}; it is ${AS.eraLabel(OBJ.era)}.</p></div>
    <div class="row" style="font:600 13.5px/1.3 var(--f-body);color:var(--mute);padding:0 4px"><span class="grow">Round so far <b style="color:${INK}">26,090</b></span><span>average <b style="color:${INK}">6,520</b> per object</span></div>
    <div class="row" style="margin-top:auto"><a class="btn grow">See the tell</a><a class="btn red big grow">Next object</a></div>
  </div>
</div>
<div class="row" style="margin-top:4px"><h3 style="font:800 21px/1 var(--f-display)">Calibration</h3><div class="seg"><button>7 days</button><button class="on">30 days</button><button>All</button></div></div>
<div class="calib">
  <div class="card stat"><span>Answered</span><b>312</b><span>26 rounds finished</span></div>
  <div class="card stat" style="--c:${ERA_HUES[0]}"><span>Average score</span><b>61<small>%</small></b><span>up 4 points on last month</span></div>
  <div class="card stat"><span>Median pin error</span><b>1,180<small>km</small></b><span>half your pins land closer</span></div>
  <div class="card stat"><span>Right era</span><b>38<small>%</small></b><span>within one era: 71%</span></div>
  <div class="card chart"><div class="hd"><h4 style="font:800 17px/1 var(--f-display)">Median pin error by region</h4><span>km · lower is better</span></div>
    <div class="bars">${AS.REGIONS.map(r => `<div><em>${fmtN(regErr[r.id])}</em><u style="--c:${REG[r.id]};height:${regErr[r.id] / maxErr * 76}px"></u></div>`).join("")}</div>
    <div class="barl">${AS.REGIONS.map(r => `<span>${RSHORT[r.id]}</span>`).join("")}</div></div>
</div>`);
const mr = makeMap(document.getElementById("m-r"), { year:AS.ERA2MAP[OBJ.era], mode:"quiet" },
  [{ lon:GUESS.lon, lat:GUESS.lat, type:"pin", color:ERA_HUES[1], label:GUESS.near, cls:"guess", always:true }, { lon:OBJ.lon, lat:OBJ.lat, type:"pin", color:"#1fa971", label:"Anyang", cls:"truth", always:true }],
  [{ from:[GUESS.lon, GUESS.lat], to:[OBJ.lon, OBJ.lat], label:fmtN(Math.round(km / 10) * 10) + " km" }]);
setTimeout(() => { mr.map.flyTo(109.5, 33.6, 8.5, 0); mr.kick(); }, 250);

/* ================= 7. Design notes ================= */
const PAL = [["Ink", INK], ["Paper", "#fbf6ea"], ["Board", "#ece2cc"], ["Sea", "#2a66d9"], ["Land", "#fff3d6"], ["Red", "#f2553d"], ["Yellow", "#ffc42e"], ["Pink", "#ee4f9c"], ["Violet", "#7b4fe0"], ["Green", "#1fa971"]];
frame("Design notes", "Palette, type, the two colour codes, and what this direction costs.", "Desk", `
<div class="notes">
  <div class="card panel"><h4>Palette</h4><div class="swatches">${PAL.map(p => `<div><i style="--c:${p[1]}"></i>${p[0]}<em>${p[1]}</em></div>`).join("")}</div>
    <h4 style="margin-top:18px">Era scale: colour = millennium, depth = quarter</h4>${eraBar({ cls:"xs nolabel" })}
    <div class="strip" style="grid-template-columns:repeat(5,1fr);gap:4px;margin-top:8px">${["3000–2000 BCE", "2000–1000 BCE", "1000–1 BCE", "1–1000 CE", "1000–2000 CE"].map((n, i) => `<span style="font:700 11px/1 var(--f-body);border-top:2.5px solid ${INK};padding-top:5px">${n}</span>`).join("")}</div>
    <h4 style="margin-top:20px">Regions: hue family = part of the world</h4>
    <div class="regs">${FAMS.map(f => `<div class="col"><span class="fam">${f[0]}</span>` + f[1].map(id => `<div><i style="--c:${REG[id]}"></i>${esc(rshort(id))}</div>`).join("") + `</div>`).join("")}</div>
    <h4 style="margin-top:20px">Map pieces</h4>
    <div class="comp" style="gap:12px"><span class="key"><i style="width:26px;height:26px;--c:${ERA_HUES[0]}"></i>Power</span><span class="key"><i style="width:18px;height:18px;--c:${REG.eas}"></i>Place counter</span>
      <span class="key"><span style="width:26px;display:inline-block">${PIN(ERA_HUES[1])}</span>Your pin</span><span class="key"><span style="width:26px;display:inline-block">${PIN("#1fa971")}</span>Answer</span><span class="lb" style="position:static;transform:none">Label</span><span class="lb big" style="position:static;transform:none">Major label</span></div></div>
  <div class="card panel type"><h4>Type</h4>
    <small>Display · Bricolage Grotesque 800</small><div class="d">Where and when</div>
    <small>Body · Figtree 400–700</small><div class="b">Celadon with black-and-white inlay points to Goryeo Korea, c. 1150–1400. <b>The cue is on top, the answer under a cover.</b></div>
    <small>Numbers · DM Mono, and the display face for scores</small><div class="n">445,063 · 1,130 km · 40% <span style="font:800 26px/1 var(--f-display)">6,680</span></div>
    <h4 style="margin-top:20px">Controls</h4>
    <div class="comp"><a class="btn red">Primary</a><a class="btn yellow">Secondary</a><a class="btn">Plain</a><div class="seg"><button class="on">On</button><button>Off</button></div>
      <span class="chip on">Chip on</span><span class="chip"><i style="--c:${REG.sas}"></i>Chip</span>${eraTag(-500, -250)}${regTag("eur_s")}<span class="tag">tag</span></div></div>
  <div class="card panel"><h4>What this is going for</h4>
    <ul class="bul">
      <li><b>It looks like a game you play daily.</b> Cream board, 2.5&nbsp;px ink outline on everything, solid offset shadows, no gradients, no glow, no transparency.</li>
      <li><b>One obvious next move per screen.</b> The primary action is always the red button; the room you are in is the pressed yellow tab.</li>
      <li><b>Colour carries two codes and nothing else.</b> Era colour means time (five hues, four steps each); region colour means place (hue family per continent). Everything else is ink, paper or yellow.</li>
      <li><b>Data screens stay dense.</b> Atlas list and When chart keep small mono numerals and tight rows; only the frames around them are chunky.</li>
    </ul>
    <h4 style="margin-top:14px">Trade-offs against the dark version</h4>
    <ul class="bul">
      <li>Photos sit on a light page, so they have less drama than on the night background. Practice puts them on a dark mat to compensate.</li>
      <li>Outlines and shadows take space: about 10% fewer rows fit per screen.</li>
      <li>The map markers are DOM pieces laid over the canvas map. Fine for a few hundred; the Atlas at full zoom-in detail would want them drawn in the canvas.</li>
      <li>The stepped era scale is easier to name (“late red”) but less smooth than the current continuous ramp.</li>
    </ul></div>
</div>`, "min-height:0");
})();
