/* Museum Label — static design comp. Builds seven frames from the real data files. No router, no state. */
(function(){
"use strict";
const AS = window.AS, D = window.AS_DATA, esc = AS.esc, $ = s => document.querySelector(s);
const fmtN = n => Math.round(n).toLocaleString("en-US");

/* ---------- colour: data only ---------- */
/* OKLCH → sRGB hex, reducing chroma until the colour fits the gamut */
function oklch(L, C, hDeg){
  const h = hDeg * Math.PI / 180; let c = C, rgb;
  for (let n = 0; n < 60; n++){
    const a = c * Math.cos(h), b = c * Math.sin(h);
    const l = Math.pow(L + .3963377774 * a + .2158037573 * b, 3), m = Math.pow(L - .1055613458 * a - .0638541728 * b, 3), s = Math.pow(L - .0894841775 * a - 1.291485548 * b, 3);
    rgb = [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s];
    if (rgb.every(v => v >= -.0005 && v <= 1.0005)) break; c -= .004;
  }
  return "#" + rgb.map(v => { v = Math.max(0, Math.min(1, v)); v = v <= .0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - .055; return Math.round(v * 255).toString(16).padStart(2, "0"); }).join("");
}
/* 20 eras: one even-lightness sweep, ochre (3000 BCE) → red → magenta → violet → blue → teal → green (2000 CE) */
const ERA = []; for (let i = 0; i < 20; i++) ERA.push(oklch(.635, .155, 85 - i * 15));
/* 14 regions: categorical, tuned for white paper */
const RC = { eas:"#d12c3f", sas:"#e2940f", sea:"#2e9e5b", cas:"#9a8250", wan:"#1297a8", egy:"#c9a400", ssa:"#b35a2a",
  eur_s:"#7b5bd6", eur_nw:"#3f78d8", eur_e:"#b04fc2", nam:"#6f8fa3", mes:"#7bb02a", and:"#e0559a", oce:"#18b39d" };
const ACCENT = "#f03a17", INK = "#111214";
const R = id => AS.REGIONS.find(r => r.id === id) || { id, name:id, short:id };
const dot = id => `<i class="dot" style="--c:${RC[id]}"></i>`;

/* ---------- shared pieces ---------- */
const ROOMS = ["Desk", "Atlas", "When", "Tells", "Scripts", "Practice"];
const bar = on => `<header class="bar"><a class="brand"><i></i>Anthropeum Study</a><nav>${ROOMS.map(r => `<a class="${r === on ? "on" : ""}">${r}</a>`).join("")}</nav>
  <div class="bar-r"><span>Streak <b>6 days</b></span><span>Sun 15 Nov</span></div></header>`;
const yrNum = i => { const y = AS.eraStart(i); return y < 0 ? -y : (y === 0 ? 1 : y); };
function eraBar(sel, o = {}){
  const cells = ERA.map((c, i) => `<button class="era${i === sel ? " on" : ""}" style="--c:${c}"><b>${yrNum(i)}</b><span>${AS.eraStart(i) < 0 ? "BCE" : "CE"}</span></button>`).join("");
  const ages = AS.AGES.map(a => `<span class="${sel >= a.from && sel <= a.to ? "on" : ""}" style="grid-column:${a.from + 1}/${a.to + 2}">${esc(a.name)}</span>`).join("");
  return `<div class="erabar${o.tight ? " tight" : ""}">${o.all ? `<button class="era-all on">All eras</button>` : ""}<div class="era-col"><div class="eras">${cells}</div><div class="ages">${ages}</div></div></div>`;
}
const strip = (from, to) => `<div class="strip">${ERA.map((c, i) => `<i${AS.eraStart(i) <= to && AS.eraEnd(i) > from ? ` class="f" style="--c:${c}"` : ""}></i>`).join("")}</div>`;
const strength = n => `<span class="str">${[1, 2, 3].map(i => `<i${i <= n ? ` class="f"` : ""}></i>`).join("")}</span>`;
const yr = y => (y < 0 ? `${-y} BCE` : `${y} CE`);
const range = (a, b) => (a < 0 && b < 0 ? `${-a}–${-b} BCE` : a >= 0 ? `${a}–${b} CE` : `${-a} BCE – ${b} CE`);

/* ================= 01 Desk ================= */
(function(){
  const E = 12, era = D.empires.eras[E], key = AS.ERA2MAP[E];
  const pow = era.empires.map(e => Object.assign({ region:AS.regionOfPoint(e.lon, e.lat) }, e));
  $("#s-desk").innerHTML = bar("Desk") + `<div class="desk">
    <aside class="desk-l">
      <div class="eyebrow">Desk · the world in one era</div>
      <div class="era-tag" style="--c:${ERA[E]}"><i></i>Era 13 of 20 · Imperial · Late Antique</div>
      <h1 class="mega">1<i>–</i>250<small>CE</small></h1>
      <p class="lede">Borders as of <b>${esc(AS.mapKeyLabel(key))}</b>. ${pow.length} major powers; ${pow.filter(p => p.strength === 3).length} at full strength.</p>
      <div class="powers-h"><span class="eyebrow">Major powers</span><span class="eyebrow">Strength</span></div>
      <ol class="powers">${pow.map((p, i) => `<li><span class="n">${String(i + 1).padStart(2, "0")}</span>${dot(p.region)}<b>${esc(p.name)}</b>${strength(p.strength)}</li>`).join("")}</ol>
      <div class="today">
        <div class="eyebrow">Today</div>
        <div class="today-row"><div><b>Daily mix</b>8 objects · not played</div><button class="btn go">Start practice</button></div>
        <div class="today-row"><div><b>12 tells due</b>4 new · 8 review</div><button class="btn">Review</button></div>
      </div>
    </aside>
    <div class="desk-map"><div class="maphost" id="m-desk"></div>
      <div class="mapnote"><b>${esc(AS.mapKeyLabel(key))}</b> · fill = polity · dot = major power, coloured by region</div></div>
  </div>
  <div class="desk-eras">${eraBar(E)}</div>`;
  const map = AS.createMap($("#m-desk"), { year:key, mode:"polities", controls:false });
  map.setMarkers(pow.map(p => ({ id:p.name, lon:p.lon, lat:p.lat, r:5 + p.strength * 2.4, color:RC[p.region], fill:1, ring:"#ffffff", label:p.name, labelAlways:true, labelSize:13, fixed:true })));
  map.flyTo(12, 16, 1.2, 0);
})();

/* ================= 02 Atlas ================= */
(function(){
  const P = D.agg.places, tot = []; for (let e = 0; e < 20; e++) tot.push(P.reduce((s, p) => s + p.counts[e][0], 0));
  const live = tot.filter(t => t > 0).length;
  const rows = P.map(p => { let s = 0; for (let e = 0; e < 20; e++) if (tot[e]) s += p.counts[e][0] / tot[e]; return { p, share:s / live, region:AS.regionOfPoint(p.lon, p.lat) }; }).sort((a, b) => b.share - a.share);
  const max = rows[0].share, top3 = rows.slice(0, 3).reduce((s, r) => s + r.share, 0), sum = P.reduce((s, p) => s + p.total, 0);
  const pc = v => (v >= .1 ? Math.round(v * 100) : (v * 100).toFixed(1)) + "%";
  const byReg = {}; rows.forEach(r => byReg[r.region] = (byReg[r.region] || 0) + r.share);
  const regs = Object.keys(byReg).sort((a, b) => byReg[b] - byReg[a]).slice(0, 6);
  const lens = ["Places", "Powers", "Materials", "Instruments", "Animals"], metric = ["Balanced", "Raw", "Signature"];
  $("#s-atlas").innerHTML = bar("Atlas") + `<div class="tool"><h2>Atlas</h2>
      <div class="seg">${lens.map((l, i) => `<a class="${i ? "" : "on"}">${l}</a>`).join("")}</div>
      <label class="check sp"><i></i>Exclude works on paper</label>
      <div class="seg"><span class="seg-l" style="align-self:center">Metric</span>${metric.map((l, i) => `<a class="${i ? (i === 2 ? "off" : "") : "on"}">${l}</a>`).join("")}</div></div>
    <div class="atlas-eras">${eraBar(-1, { all:true })}</div>
    <div class="atlas">
      <div class="atlas-map"><div class="maphost" id="m-atlas"></div>
        <div class="readout"><div class="eyebrow">Places · balanced · all eras</div><h4>Share of objects, averaged over eras</h4>
          <div class="sizes"><span><i style="width:44px;height:44px"></i>${pc(max)}</span><span><i style="width:22px;height:22px"></i>${pc(max / 4)}</span><span><i style="width:10px;height:10px"></i>${pc(max / 19)}</span><em>bubble area<br>= share</em></div>
          <div class="rg">${regs.map(id => `<span>${dot(id)}${esc(R(id).short)}<b>${pc(byReg[id])}</b></span>`).join("")}</div></div>
      </div>
      <aside class="atlas-side">
        <div class="eyebrow">All objects · all eras</div>
        <h3 style="margin-top:9px">Where things were made</h3>
        <div class="statrow"><div><b>${fmtN(sum)}</b><span>objects in this slice</span></div><div><b>${P.length}</b><span>places</span></div><div><b>${pc(top3)}</b><span>held by the top three</span></div></div>
        <p class="side-note">Balanced gives each of the twenty eras an equal vote, so the large 1750–2000 print collections do not swamp the map.</p>
        <div class="rank-h eyebrow"><span>#</span><span>Place</span><span>Share</span><span>Objects</span></div>
        <ol class="rank">${rows.slice(0, 12).map((r, i) => `<li><span class="n">${i + 1}</span><span class="nm">${esc(r.p.name)}</span><span class="pc">${pc(r.share)}</span><span class="ct">${fmtN(r.p.total)}</span><i class="bar-x" style="--c:${RC[r.region]};width:${(r.share / max * 62).toFixed(1)}%"></i></li>`).join("")}</ol>
      </aside>
    </div>`;
  const map = AS.createMap($("#m-atlas"), { year:AS.MODERN_MAP, mode:"quiet", controls:false });
  map.setMarkers(rows.map((r, i) => ({ id:r.p.name, lon:r.p.lon, lat:r.p.lat, r:Math.max(2.6, 34 * Math.sqrt(r.share / max)), color:RC[r.region], fill:i < 12 ? .82 : .95, ring:"#ffffff",
    label:i < 16 ? r.p.name : null, priority:1000 - i, labelSize:i < 4 ? 13.5 : 12, fixed:true })));})();

/* ================= 03 Tells ================= */
(function(){
  const T = D.tells.tells, by = id => T.find(t => t.id === id);
  const cards = [["tang-sancai", true], ["fayum-portrait", false], ["palmyra-bust", true], ["moche-stirrup", false]];
  const med = {}; T.forEach(t => med[t.medium] = (med[t.medium] || 0) + 1);
  const meds = Object.keys(med).sort((a, b) => med[b] - med[a]).slice(0, 11);
  const reg = {}; T.forEach(t => reg[t.place.region] = (reg[t.place.region] || 0) + 1);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1).replace("-", " & ");
  const card = ([id, open]) => { const t = by(id);
    return `<article class="tell"><div class="tell-top">${dot(t.place.region)}${esc(R(t.place.region).short)} · ${esc(t.medium)}${strength(t.strength)}</div>
      <h3>${esc(t.title)}</h3><p class="cue">${esc(t.cue)}</p>` + (open ?
      `<div class="ans"><div class="eyebrow">Reads as</div><p>${esc(t.infer)}</p>
         <div class="where">${dot(t.place.region)}${esc(t.place.label)}<span class="num">${range(t.years[0], t.years[1])}</span></div>${strip(t.years[0], t.years[1])}
         <div class="warn"><div class="eyebrow">Misleads when</div><p>${esc(t.caveat)}</p></div></div>
       <div class="tell-btns"><button class="btn">Didn’t</button><button class="btn ink">Knew it</button></div>` :
      `<div class="cover"><b>What does it tell you?</b><button class="btn">Show answer <kbd>Space</kbd></button></div>`) + `</article>`; };
  const L = D.tells.lookalikes[0];
  $("#s-tells").innerHTML = bar("Tells") + `<div class="tool"><h2>Tells</h2>
      <div class="seg"><a class="on">Study</a><a>Browse all ${T.length}</a><a>Lookalikes ${D.tells.lookalikes.length}</a></div>
      <span class="sp num" style="font-size:12px;color:var(--ink-2)">12 due · 61 known · 127 unseen</span></div>
    <div class="filters">
      <span class="eyebrow">Region</span><div class="chips"><span class="chip on">All <span class="num">${T.length}</span></span>${AS.REGIONS.map(r => `<span class="chip">${dot(r.id)}${esc(r.short)} <span class="num">${reg[r.id] || 0}</span></span>`).join("")}</div>
      <span class="eyebrow">Medium</span><div class="chips"><span class="chip on">All</span>${meds.map(m => `<span class="chip">${esc(cap(m))} <span class="num">${med[m]}</span></span>`).join("")}</div>
    </div>
    <div class="tells">${cards.map(card).join("")}</div>
    <div class="look">
      <div><div class="eyebrow">Lookalikes</div><h3>${esc(L.title)}</h3><p class="blurb">${esc(L.blurb)}</p>
        <div class="quick"><div class="eyebrow">Quick test</div><p>${esc(L.quickTest)}</p></div></div>
      <div class="cont">${L.contenders.slice(0, 3).map((c, i) => `<div><h4>${dot(c.region)}${esc(c.label)}<span class="mono">${"ABC"[i]}</span></h4><ul>${c.points.slice(0, 4).map(p => `<li>${esc(p)}</li>`).join("")}</ul></div>`).join("")}</div>
    </div>`;
})();

/* ================= 04 When ================= */
(function(){
  const T = D.techniques.techniques, G = D.techniques.groups;
  const ids = ["tin-bronze", "iron-smelting", "coinage", "paper", "glassblowing", "stirrups", "porcelain", "lustreware", "gunpowder-firearms", "blue-and-white", "oil-painting", "photography"];
  const SEL = "glassblowing", short = { "gunpowder-firearms":"Gunpowder firearms", "blue-and-white":"Underglaze blue-and-white", "oil-painting":"Oil painting" };
  const x = y => Math.max(0, Math.min(100, (y + 3000) / 50));
  const rows = ids.map(id => T.find(t => t.id === id)).sort((a, b) => a.origin.year - b.origin.year);
  const row = t => { const x0 = x(t.origin.year), x1 = x(t.end ? t.end.year : 2000);
    const ticks = t.arrivals.filter(a => a.year > t.origin.year && a.year <= 2000).map(a => `<i class="tick${a.independent ? " ind" : ""}" style="left:${x(a.year).toFixed(2)}%;--c:${RC[a.region]}"></i>`).join("");
    return `<div class="tl-row${t.id === SEL ? " on" : ""}"><span class="nm">${esc(short[t.id] || t.name)}</span><span class="yr">c. ${yr(t.origin.year)}</span>
      <div class="track">${"<u></u>".repeat(20)}<i class="barx" style="left:${x0}%;width:${(x1 - x0).toFixed(2)}%"></i><i class="cap0" style="left:${x0}%;--c:${RC[t.origin.region]}"></i>${ticks}</div></div>`; };
  const s = T.find(t => t.id === SEL); const parts = s.rule.split(/\. (?=[A-Z])/); const head = parts[0].replace(/\.$/, "").split(" ⇒ ");
  const arr = s.arrivals.slice().sort((a, b) => a.year - b.year).slice(0, 7);
  $("#s-when").innerHTML = bar("When") + `<div class="tool"><h2>When</h2>
      <div class="seg"><a class="on">First appearances</a><a>Sort the eras</a><a>Older or newer</a></div>
      <span class="sp num" style="font-size:12px;color:var(--ink-2)">${T.length} techniques · 12 shown</span></div>
    <div class="filters" style="grid-template-columns:76px 1fr"><span class="eyebrow">Group</span><div class="chips"><span class="chip on">All <span class="num">${T.length}</span></span>${G.map(g => `<span class="chip">${esc(g.name)} <span class="num">${T.filter(t => t.group === g.id).length}</span></span>`).join("")}</div></div>
    <div class="when">
      <div class="tl">
        <div class="tl-row tl-head"><span class="eyebrow">Technique</span><span class="eyebrow" style="text-align:right;padding-right:14px">First</span>
          <div class="cols">${ERA.map((c, i) => `<span style="--c:${c}">${yrNum(i)}</span>`).join("")}</div></div>
        ${rows.map(row).join("")}
        <div class="tl-key"><span><i style="width:5px;height:18px;background:${RC.wan}"></i>first appearance, coloured by region</span><span><i style="width:3px;height:14px;background:${RC.eas}"></i>arrival elsewhere</span>
          <span><i style="width:9px;height:9px;border-radius:50%;border:1.5px solid ${RC.mes}"></i>independent invention</span><span><i style="width:34px;height:8px;background:var(--fill-2)"></i>in use</span></div>
      </div>
      <aside class="rule">
        <div class="eyebrow">Rule · ${esc(s.name)}</div>
        <h3>${esc(head[0])} <em>⇒</em><br>${esc(head[1] || "")}</h3>
        <p class="more">${esc(parts.slice(1, 3).join(". ").replace(/\.?$/, "."))}</p>
        <dl><div class="first"><dt>${yr(s.origin.year)}</dt>${dot(s.origin.region)}<dd>${esc(s.origin.place)} · first</dd></div>
          ${arr.map(a => `<div><dt>${yr(a.year)}</dt>${dot(a.region)}<dd>${esc(a.place)}</dd></div>`).join("")}</dl>
        <div style="margin-top:auto;padding-top:16px;display:flex;gap:10px"><button class="btn ink">Drill this rule</button><button class="btn">Show on map</button></div>
      </aside>
    </div>`;
})();

/* ================= 05 Scripts ================= */
(function(){
  const S = D.scripts.scripts, by = id => S.find(s => s.id === id);
  const link = document.createElement("link"); link.rel = "stylesheet"; link.href = D.scripts.fontsCss; document.head.append(link);
  const ids = ["egyptian-hieroglyphs", "cuneiform", "chinese", "greek", "arabic-kufic", "devanagari", "tibetan", "runic"], BIG = "egyptian-hieroglyphs";
  const nm = s => s.name.replace(/ \(.*\)$/, "").replace(/^Arabic: /, "").replace(" (angular) styles", "");
  const fam = s => `font-family:'${s.font}',var(--f-body)`;
  const size = { chinese:42, "arabic-kufic":44, devanagari:40, tibetan:38, greek:27, runic:38, cuneiform:42, "egyptian-hieroglyphs":50 };
  const tile = id => { const s = by(id); const first = s.sample.split("  ")[0];
    return `<article class="tile${id === BIG ? " on" : ""}"><div class="spec" dir="${s.dir === "rtl" ? "rtl" : "ltr"}" style="${fam(s)};font-size:${size[id] || 34}px">${esc(first)}</div>
      <div class="meta"><b>${esc(nm(s))}</b><span class="num">${range(s.from, s.to)}</span>${strip(s.from, s.to)}</div></article>`; };
  const b = by(BIG);
  $("#s-scripts").innerHTML = bar("Scripts") + `<div class="tool"><h2>Scripts</h2>
      <div class="seg"><a class="on">Specimens</a><a>World map</a><a>Name the script</a></div>
      <div class="chips sp"><span class="chip on">All <span class="num">${S.length}</span></span><span class="chip">In use 1–250 CE <span class="num">${S.filter(s => s.from <= 250 && s.to >= 1).length}</span></span><span class="chip">Easily confused</span></div></div>
    <div class="scripts">
      <div class="tiles">${ids.map(tile).join("")}</div>
      <aside class="big">
        <div class="eyebrow">Specimen · ${esc(b.family || "")}</div>
        <div class="spec" style="${fam(b)}">${esc(b.sample)}</div>
        <p class="mean">${esc(b.sampleMeaning || "")}</p>
        <h3>${esc(nm(b))}</h3>
        <div class="dates"><span>${yr(b.from)}</span><span>${yr(b.to)}</span></div>${strip(b.from, b.to)}
        <ol>${b.look.slice(0, 4).map((l, i) => `<li><span>${String(i + 1).padStart(2, "0")}</span>${esc(l)}</li>`).join("")}</ol>
        <p class="on-what"><b>Reads as</b> ${esc(String(b.infer || "").split(". ").slice(0, 2).join(". ").replace(/\.?$/, "."))}</p>
      </aside>
    </div>`;
})();

/* ================= 06 Practice ================= */
(function(){
  const O = D.gallery.objects.find(o => o.id === "cma-139702") || D.gallery.objects.find(o => o.src === "cma");
  const G = { lon:43.6, lat:36.2, era:AS.eraOf((O.y0 + O.y1) / 2), name:"northern Iraq" };
  const km = AS.geo.havKm(G.lon, G.lat, O.lon, O.lat), sp = AS.score.pin(km), se = AS.score.era(G.era, O.era), total = sp + se;
  const ll = (lat, lon) => `${Math.abs(lat).toFixed(1)}°${lat < 0 ? "S" : "N"} ${Math.abs(lon).toFixed(1)}°${lon < 0 ? "W" : "E"}`;
  const pips = n => `<span class="pips">${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<i class="${i < n ? "d" : i === n ? "c" : ""}"></i>`).join("")}</span>`;

  /* (a) question */
  $("#s-pq").innerHTML = bar("Practice") + `<div class="prog"><b>Place and date</b>${pips(2)}<span>Object 3 of 8</span><span class="num">Running score 14,930 / 20,000</span></div>
    <div class="pq">
      <div class="wallpic"><img src="${esc(O.img)}" alt="Practice object"><span class="credit">Held-out practice set · image: ${esc(O.credit)}</span><span class="zoom">Zoom</span></div>
      <div class="steps">
        <div class="step-h"><span class="no">1</span><h3>Where was it made?</h3><span class="num">Pin <b>${ll(G.lat, G.lon)}</b> · ${G.name}</span></div>
        <div class="pq-map"><div class="maphost" id="m-pq"></div></div>
        <div class="step-h" style="padding-top:20px"><span class="no">2</span><h3>When?</h3><span class="num">Selected <b>${esc(AS.eraLabel(G.era))}</b></span></div>
        ${eraBar(G.era, { tight:true })}
        <div class="lock"><div class="sum">Your answer: <b>${G.name}</b>, <b>${esc(AS.eraLabel(G.era))}</b>.<br>You can move the pin until you lock in.</div><button class="btn">Skip</button><button class="btn go lg">Lock in <kbd>Enter</kbd></button></div>
      </div>
    </div>`;
  const mq = AS.createMap($("#m-pq"), { year:AS.MODERN_MAP, mode:"quiet", controls:false });
  mq.setMarkers([{ id:"g", lon:G.lon, lat:G.lat, r:12, shape:"pin", color:INK, fixed:true, label:"Your pin", labelAlways:true, labelSize:13 }]);
  mq.flyTo(38, 30, 2.3, 0);

  /* (b) reveal + (c) calibration */
  const regs = AS.REGIONS.map(r => r.id), err = [410, 620, 890, 1480, 540, 180, 1210, 330, 290, 760, 950, 520, 680, 1620];
  const emax = Math.max.apply(null, err), spark = [48, 55, 52, 61, 58, 66, 63, 70, 68, 74, 71, 77];
  $("#s-pr").innerHTML = bar("Practice") + `<div class="prog"><b>Place and date</b>${pips(3)}<span>Object 3 of 8 · answered</span><span class="num">Running score ${fmtN(14930 + total)} / 30,000</span></div>
    <div class="pr">
      <div class="pr-obj"><div class="pic"><img src="${esc(O.img)}" alt=""></div>
        <h3>${esc(O.title)}</h3>
        <dl class="label"><div><dt>Place</dt><dd>${esc(O.place)}</dd></div><div><dt>Date</dt><dd>${esc(O.dateLabel)}</dd></div><div><dt>Medium</dt><dd>${esc(O.medium)}</dd></div><div><dt>Source</dt><dd>${esc(O.credit)}</dd></div></dl>
      </div>
      <div class="pr-score"><div class="eyebrow">Score</div><div class="score">${fmtN(total)}</div><div class="score-of">of 10,000</div>
        <div class="parts">
          <div class="part"><div class="part-h"><b>Place</b><span>${fmtN(km)} km off</span><span class="num">${fmtN(sp)} / 5,000</span></div><div class="meter"><i style="width:${sp / 50}%"></i></div>
            <div class="sub"><span>Pinned ${G.name}</span><span>Made in ${esc(O.country || O.place)}</span></div></div>
          <div class="part"><div class="part-h"><b>Era</b><span>${se === 5000 ? "exact" : "off"}</span><span class="num">${fmtN(se)} / 5,000</span></div><div class="meter"><i style="width:${se / 50}%"></i></div>
            <div class="sub"><span><i class="sw" style="--c:${ERA[O.era]}"></i>${esc(AS.eraLabel(O.era))}</span><span>Object dated ${esc(O.dateLabel)}</span></div></div>
        </div>
        <div class="pr-next"><button class="btn go lg">Next object <kbd>Enter</kbd></button><button class="btn lg">Open in Atlas</button></div>
      </div>
      <div class="pr-map"><div class="maphost" id="m-pr"></div>
        <div class="pinkey"><span><i style="--c:${INK}"></i>Your pin</span><span><i style="--c:${ACCENT}"></i>Where it was made</span></div></div>
    </div>
    <div class="calib">
      <div class="cal"><div class="eyebrow">Answered</div><b class="v">124</b><p>objects since 2 Nov<br>of 695 in the set</p></div>
      <div class="cal"><div class="eyebrow">Average</div><b class="v">71<small>%</small></b><div class="spark">${spark.map(v => `<i style="height:${v}%"></i>`).join("")}</div><p>last 12 sessions</p></div>
      <div class="cal"><div class="eyebrow">Median pin error</div><b class="v">640<small>km</small></b><p>era exact 58% · within one 83%</p></div>
      <div class="cal"><div class="eyebrow">Median pin error by region, km</div>
        <div class="rbars">${regs.map((id, i) => `<div><span>${esc(R(id).short)}</span><i style="--c:${RC[id]};width:${(err[i] / emax * 100).toFixed(0)}%"></i><b>${fmtN(err[i])}</b></div>`).join("")}</div></div>
    </div>`;
  const mr = AS.createMap($("#m-pr"), { year:AS.MODERN_MAP, mode:"quiet", controls:false });
  mr.setArcs([{ from:[G.lon, G.lat], to:[O.lon, O.lat], color:INK, width:1.6, dashed:true, label:`${fmtN(km)} km` }]);
  mr.setMarkers([{ id:"g", lon:G.lon, lat:G.lat, r:9, shape:"pin", color:INK, fixed:true, label:"Your pin", labelAlways:true },
    { id:"t", lon:O.lon, lat:O.lat, r:10, shape:"pin", color:ACCENT, fixed:true, label:O.country || O.place, labelAlways:true, labelSize:14 }]);
  mr.fit([[G.lon, G.lat], [O.lon, O.lat]], { pad:170, maxZoom:4.2, ms:0 });
})();

/* ================= 07 Design notes ================= */
(function(){
  const pal = [["Paper", "#ffffff"], ["Wall", "#f3f3f0"], ["Rule", "#e1e1dc"], ["Land", "#d9d9d4"], ["Sea", "#eef2f4"], ["Ink 3", "#8a8d94"], ["Ink", "#111214"], ["Accent", ACCENT]];
  $("#s-notes").innerHTML = `
    <div><h4>Palette</h4><div class="sws">${pal.map(p => `<div class="sw-b"><i style="--c:${p[1]}"></i><b>${p[0]}</b><span>${p[1]}</span></div>`).join("")}</div></div>
    <div><h4>Type</h4><div class="ty-d">Inter Tight 800</div><p class="ty-b">Inter Tight 400–700 for text and labels, set tight and left-aligned. One family, four weights, no italics.</p>
      <div class="ty-n">1250–1500 CE · 8,412</div><p class="ty-l">Geist Mono for years, counts, coordinates and small capitals</p></div>
    <div style="grid-row:1/3;grid-column:3"><h4>What this direction is going for</h4><ul class="bul">
      <li><b>Colour means something.</b> Every saturated mark is an era or a region. On the dark version gold, glows and jewel-toned fills compete with the data; here nothing does.</li>
      <li><b>Objects and maps get the room.</b> Photos sit on a plain wall with a small label; the map is grey and white so the bubbles and pins are what you see first.</li>
      <li><b>Scale does the work decoration did.</b> Very large numerals for the era, the score and the rule; hairlines and alignment for everything else. No gradients, shadows or rounded cards.</li>
      <li><b>Trade-off: less atmosphere.</b> The night gallery feels like a place; this feels like a tool. Bright white for a long evening session is harder on the eyes, and photos shot on dark grounds look more boxed-in.</li>
      <li><b>Trade-off: twenty hues on white.</b> The era colours are held to one lightness so white text stays readable on them, which makes neighbours closer than on the dark scale. The yellow region colour is the weakest against white.</li>
    </ul></div>
    <div class="wide"><h4>Data colour · 20 eras, then 14 regions</h4>
      <div class="escale">${ERA.map((c, i) => `<span><i style="--c:${c}"></i><b>${yrNum(i)}</b><em>${c}</em></span>`).join("")}</div>
      <div class="rscale">${AS.REGIONS.map(r => `<span><i style="--c:${RC[r.id]}"></i>${esc(r.short)}</span>`).join("")}</div></div>`;
})();
})();
