/* Vellum Atlas — static design comp. Renders the frames from the real data; nothing here is wired to the router. */
(function(){
"use strict";
const AS = window.AS, D = window.AS_DATA, esc = AS.esc, $ = id => document.getElementById(id);
const fmtN = n => Math.round(n).toLocaleString("en-US");

/* ---------- colour scales for this direction ---------- */
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const ANCH = ["#b9831c", "#b5532a", "#8f2a21", "#742a52", "#3a3478", "#235a8a", "#2a7d6c", "#5c8a3c"].map(hex);
const ERA = []; for (let i = 0; i < 20; i++){ const u = i / 19 * (ANCH.length - 1), a = Math.min(ANCH.length - 2, Math.floor(u)), f = u - a;
  ERA.push("#" + ANCH[a].map((v, j) => Math.round(v + (ANCH[a + 1][j] - v) * f).toString(16).padStart(2, "0")).join("")); }
const REG = { eas:"#c2362a", sas:"#d08a1c", sea:"#2f8a55", cas:"#8a6a45", wan:"#1b7f95", egy:"#b99a1f", ssa:"#c2602b",
  eur_s:"#6a4ea2", eur_nw:"#2f5ea8", eur_e:"#a0447d", nam:"#5d7d8e", mes:"#7c962b", and:"#c8557b", oce:"#35a798" };
const regName = id => (AS.REGIONS.find(r => r.id === id) || {}).short || id;
const INK = "#21180f", OX = "#8f2a21", VERD = "#2a7d6c", RING = "rgba(33,24,15,.8)";

/* ---------- small builders ---------- */
const eraNum = i => { const y = AS.eraStart(i); return [y === 0 ? 1 : Math.abs(y), y < 0 ? "BCE" : "CE"]; };
function eraBar(o = {}){
  let cells = "", ages = "";
  for (let i = 0; i < 20; i++){ const [n, s] = eraNum(i); const cls = (i === o.sel ? " on" : "") + (i === o.truth ? " truth" : "") + (i === o.guess ? " guess" : "");
    cells += `<button class="era${cls}" style="--c:${ERA[i]}" title="${esc(AS.eraLabel(i))}"><span class="y">${n}</span><span class="s">${s}</span>${i === o.truth ? "" : "<i></i>"}</button>`; }
  for (const a of AS.AGES) ages += `<span style="grid-column:${a.from + 1}/${a.to + 2}">${esc(a.name)}</span>`;
  return `<div class="erabar">${o.all ? `<button class="allbtn${o.sel == null ? " on" : ""}">All eras</button>` : ""}<div class="eb-main"><div class="eb-cells">${cells}</div>${o.noAges ? "" : `<div class="eb-ages">${ages}</div>`}</div></div>`;
}
const strip = (from, to) => { let h = ""; for (let i = 0; i < 20; i++){ const on = AS.eraStart(i) < to && AS.eraStart(i) + 250 > from; h += `<i${on ? ` class="f" style="--c:${ERA[i]}"` : ""}></i>`; } return `<div class="strip">${h}</div>`; };
const pips = n => `<span class="pips" title="Strength ${n} of 3">${[1, 2, 3].map(i => `<i${i > n ? ' class="o"' : ""}></i>`).join("")}</span>`;
const dot = (c, extra = "") => `<i class="dot" style="--c:${c};${extra}"></i>`;
const yr = y => (y < 0 ? `${-y} BCE` : `${y} CE`);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- masthead ---------- */
const ROOMS = ["Desk", "Atlas", "When", "Tells", "Scripts", "Practice"];
const ROSE = `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14.5" fill="none" stroke="${INK}" stroke-width="1"/><circle cx="16" cy="16" r="10.5" fill="none" stroke="${INK}" stroke-width=".6"/><path d="M16 1 19 13 31 16 19 19 16 31 13 19 1 16 13 13Z" fill="${INK}"/><path d="M16 1 16 16 13 13ZM31 16 16 16 19 13ZM16 31 16 16 19 19ZM1 16 16 16 13 19Z" fill="#fbf7ec"/><path d="M16 1 19 13 31 16 19 19 16 31 13 19 1 16 13 13Z" fill="none" stroke="${INK}" stroke-width=".8"/><circle cx="16" cy="16" r="2" fill="${OX}"/></svg>`;
document.querySelectorAll("[data-mast]").forEach(el => { const on = el.dataset.mast;
  el.outerHTML = `<div class="mast"><div class="brand">${ROSE}Anthropeum Study</div><nav class="tabs">${ROOMS.map((r, i) => `<a class="${r === on ? "on" : ""}"><i>${i + 1}</i>${r}</a>`).join("")}</nav><div class="right"><span class="streak"><b>6</b>day streak</span><button class="btn pri sm">Today's round</button></div></div>`; });

/* ---------- 1 Desk ---------- */
const DESK_ERA = 12, emp = D.empires.eras[DESK_ERA].empires;
$("deskcol").innerHTML = `<span class="lab">Study desk · Sunday 15 November</span>
  <h1>Where was it made, <em>and when?</em></h1>
  <p class="lede">Study notes for the daily Anthropeum round: where objects come from, when techniques first appear, and what gives an object away.</p>
  <div class="acts"><button class="btn pri big">Start practice</button><button class="btn big">Open the atlas</button></div>
  <div class="rows">
    <div class="row"><span class="k">Review</span><span class="v"><b>12 tells</b> due today</span><span class="go">Open →</span></div>
    <div class="row"><span class="k">Weak era</span><span class="v"><b>500–750 CE</b>, 41% average</span><span class="go">Drill →</span></div>
    <div class="row"><span class="k">Weak region</span><span class="v"><b>Southeast Asia</b>, 2,310 km off</span><span class="go">Drill →</span></div>
  </div>
  <div class="powers"><h4><span class="lab">Powers, ${esc(AS.eraLabel(DESK_ERA))}</span><span class="lab" style="letter-spacing:.04em;text-transform:none;font-weight:500">${emp.length} marked</span></h4>
  <div class="pwg">${emp.map(e => `<div class="pw" title="${esc(e.note)}"><i style="width:${5 + e.strength * 3}px;height:${5 + e.strength * 3}px"></i><b>${esc(e.name)}</b></div>`).join("")}</div></div>`;
$("deskcart").innerHTML = `<span class="lab">Era ${DESK_ERA + 1} of 20</span><h3 style="margin-top:4px">The world, ${esc(AS.eraLabel(DESK_ERA))}</h3><div class="sub">Borders as of ${esc(AS.mapKeyLabel(AS.ERA2MAP[DESK_ERA]))}</div>`;
$("deskbar").innerHTML = eraBar({ sel:DESK_ERA });

/* ---------- 2 Atlas ---------- */
const places = D.agg.places, eraTot = Array(20).fill(0);
for (const p of places) for (let e = 0; e < 20; e++) eraTot[e] += p.counts[e][0];
const ranked = places.map(p => { let s = 0; for (let e = 0; e < 20; e++) s += eraTot[e] ? p.counts[e][0] / eraTot[e] : 0; return { p, share:s / 20, reg:AS.regionOfPoint(p.lon, p.lat) }; }).sort((a, b) => b.share - a.share);
const pct = v => (v >= .1 ? Math.round(v * 100) : (v * 100).toFixed(1)) + "%";
const regShare = {}; for (const r of ranked) regShare[r.reg] = (regShare[r.reg] || 0) + r.share;
const topReg = Object.entries(regShare).sort((a, b) => b[1] - a[1]).slice(0, 6);
$("atlastool").innerHTML = `<h2>Atlas</h2>
  <div class="seg">${["Places", "Powers", "Materials", "Instruments", "Animals"].map((l, i) => `<button class="${i ? "" : "on"}">${l}</button>`).join("")}</div><span class="sp"></span>
  <label class="check"><i></i>Exclude works on paper</label>
  <div class="seg">${["Balanced", "Raw"].map((l, i) => `<button class="${i ? "" : "on"}">${l}</button>`).join("")}<button class="off" title="Needs a material, instrument or animal">Signature</button></div>`;
$("atlasbar").innerHTML = eraBar({ all:true });
$("readout").innerHTML = `<span class="lab">Places · Balanced</span><h3 style="margin-top:4px">All objects, all eras</h3><div class="sub">Circle area = share</div>
  <div class="reg">${topReg.map(([id, v]) => `<span>${dot(REG[id])}${esc(regName(id))}<em>${pct(v)}</em></span>`).join("")}</div>
  <div class="sizes"><i style="width:44px;height:44px"></i><i style="width:23px;height:23px"></i><i style="width:10px;height:10px"></i><span>40% · 10% · 1%</span></div>`;
const top3 = ranked.slice(0, 3).reduce((s, r) => s + r.share, 0), maxS = ranked[0].share;
$("atlasside").innerHTML = `<span class="lab">Gazetteer</span><h3>Where things were made</h3>
  <div class="stats"><div><b>${fmtN(D.agg.meta.dated)}</b><span>objects</span></div><div><b>${places.length}</b><span>places</span></div><div><b>${pct(top3)}</b><span>in the top three</span></div></div>
  <p class="note">Balanced averages each place's share across the twenty eras, so the print-heavy last era gets one vote, not 400,000.</p>
  <div class="rank-h"><span class="lab">#</span><span class="lab">Place</span><span></span><span class="lab">Share</span><span class="lab">Objects</span></div>
  ${ranked.slice(0, 14).map((r, i) => `<div class="rk${i ? "" : " on"}"><span class="n">${i + 1}</span><span class="nm">${esc(r.p.name)}</span><span><i class="bar" style="--c:${REG[r.reg]};width:${(r.share / maxS * 100).toFixed(1)}%"></i></span><span class="p">${pct(r.share)}</span><span class="o">${fmtN(r.p.total)}</span></div>`).join("")}`;

/* ---------- 3 Tells ---------- */
const tells = D.tells.tells, T = id => tells.find(t => t.id === id);
const media = []; for (const t of tells) if (!media.includes(t.medium)) media.push(t.medium);
$("tellfilters").innerHTML = `<span class="lab">Region</span><div class="chips"><button class="chip on">All regions</button>${AS.REGIONS.map(r => `<button class="chip"><i class="d" style="--c:${REG[r.id]}"></i>${esc(r.short)}</button>`).join("")}</div>
  <span class="lab">Medium</span><div class="chips"><button class="chip">All media</button>${media.slice(0, 12).map(m => `<button class="chip${m === "ceramics" ? " on" : ""}">${esc(cap(m.replace("-", " and ")))}</button>`).join("")}</div>`;
function tellCard(t, open){
  const c = REG[t.place.region];
  return `<article class="tell" style="--c:${c}"><header><span class="lab">${esc(cap(t.medium))}</span>${pips(t.strength)}</header><h3>${esc(t.title)}</h3><p class="cue">${esc(t.cue)}</p>
  ${open ? `<div class="ans"><span class="lab">It tells you</span><p>${esc(t.infer)}</p>
      <div class="where">${dot(c)}${esc(t.place.label)}<em>${esc(AS.rangeLabel(t.years[0], t.years[1]))}</em></div>${strip(t.years[0], t.years[1])}
      <div class="mis"><b>Misleads when</b>${esc(t.caveat)}</div>
      <div class="btns"><button class="btn yes">Knew it</button><button class="btn">Didn't</button></div></div>`
    : `<div class="cover"><span>What does it tell you?</span><button class="btn pri">Reveal</button></div>`}</article>`;
}
$("tellsec").innerHTML = `<div class="sec-h"><h2>Tells</h2><span>${tells.length} cards · 12 due today</span><span class="sp"></span><div class="seg"><button class="on">Study</button><button>Browse</button><button>On the map</button></div></div>
  <div class="tells">${tellCard(T("tang-sancai"), false)}${tellCard(T("iznik-red"), true)}${tellCard(T("chola-bronze"), false)}${tellCard(T("ukiyo-e-woodblock"), true)}</div>`;
const lk = D.tells.lookalikes[0];
$("lookalike").innerHTML = `<div class="l"><span class="lab">Lookalikes</span><h3>${esc(lk.title)}</h3><p>${esc(lk.blurb)}</p><div class="qt"><b>Quick test</b>${esc(lk.quickTest)}</div></div>
  <div class="cols">${lk.contenders.slice(0, 3).map((c, i) => { const col = [REG.eas, "#2b3b78", VERD][i]; return `<div style="--c:${col}"><h4>${dot(col)}${esc(c.label)}</h4><ul>${c.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul></div>`; }).join("")}</div>`;

/* ---------- 4 When ---------- */
const techs = D.techniques.techniques, pickT = ["Tin bronze", "Iron smelting", "Struck coinage", "Paper", "Glassblowing", "Paired stirrups", "True porcelain", "Woodblock printing", "Lustreware", "Underglaze cobalt", "Oil painting", "Photographic processes"]
  .map(n => techs.find(t => t.name.startsWith(n))).filter(Boolean).sort((a, b) => a.origin.year - b.origin.year);
const pos = y => ((AS.clamp(y, -3000, 2000) + 3000) / 5000 * 100).toFixed(2) + "%";
const short = n => n.replace(/\s*\(.*\)$/, "");
const SEL = "glassblowing", grp = id => (D.techniques.groups.find(g => g.id === id) || {}).name || id;
$("timeline").innerHTML = `<div class="sec-h" style="margin-bottom:10px"><h2>First appearances</h2><span>${techs.length} techniques · showing ${pickT.length}</span><span class="sp"></span><div class="seg"><button class="on">All groups</button><button>Metal</button><button>Ceramics</button><button>Glass</button><button>Writing</button></div></div>
  <div class="tl-h"><span class="lab" style="padding-left:14px">Technique · first seen</span>${eraBar({ noAges:true }).replace('<div class="erabar">', '<div class="erabar" style="display:block">')}</div>
  ${pickT.map(t => `<div class="tr${t.id === SEL ? " on" : ""}"><div class="nm"><b>${esc(short(t.name))}</b><span>c. ${yr(t.origin.year)} · ${esc(regName(t.origin.region))}</span></div>
    <div class="track"><i class="b" style="--c:${ERA[AS.eraOf(t.origin.year)]};left:${pos(t.origin.year)}"></i>${t.arrivals.filter(a => a.year > -3000 && a.year >= t.origin.year).map(a => `<i class="a${a.independent ? " ind" : ""}" style="--c:${REG[a.region]};left:${pos(a.year)}" title="${esc(a.place)}, ${yr(a.year)}"></i>`).join("")}<i class="o" style="left:${pos(t.origin.year)}"></i></div></div>`).join("")}
  <div class="tl-foot"><span><i style="width:3px;height:16px;background:${INK};display:inline-block"></i>First appearance</span><span><i style="width:9px;height:16px;background:${REG.eur_nw};border:1px solid ${INK};display:inline-block"></i>Arrival, coloured by region</span><span><i style="width:12px;height:12px;border-radius:50%;background:${REG.and};border:1px solid ${INK};display:inline-block"></i>Independent invention</span>
    <span style="margin-left:auto;gap:10px">${["eas", "sas", "wan", "egy", "eur_s", "eur_nw", "nam"].map(r => `<span>${dot(REG[r])}${esc(regName(r))}</span>`).join("")}</span></div>`;
const st = techs.find(t => t.id === SEL), sents = st.rule.split(/\.\s+(?=[A-Z])/);
$("rulepanel").innerHTML = `<span class="lab">${esc(grp(st.group))} · dating rule</span>
  <div class="big">${esc(sents[0].replace(/\.$/, "")).replace("⇒", "<em>⇒</em>")}</div>
  <p>${esc(sents.slice(1).join(". "))}</p>
  <div class="arr"><div class="first">${dot(REG[st.origin.region])}<span>${esc(st.origin.place)}</span><em>c. ${yr(st.origin.year)}</em></div>
  ${st.arrivals.map(a => `<div>${dot(REG[a.region])}<span>${esc(a.place)}</span><em>${yr(a.year)}</em></div>`).join("")}</div>
  <div style="margin-top:14px"><span class="lab">Look for</span><p style="margin-top:4px;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden">${esc(st.lookFor)}</p></div>`;

/* ---------- 5 Scripts ---------- */
const S = D.scripts; const fl = document.createElement("link"); fl.rel = "stylesheet"; fl.href = S.fontsCss; document.head.append(fl);
const sc = id => S.scripts.find(s => s.id === id);
const specimen = s => `<div class="spec" lang="und" dir="${s.dir === "rtl" ? "rtl" : "ltr"}" style="font-family:'${s.font}',var(--f-text)">${esc(s.sample)}</div>`;
const sname = s => s.name.replace(/\s*\(.*\)$/, "").replace("Arabic: ", "");
$("sgrid").innerHTML = `<div class="sec-h"><h2>Scripts</h2><span>${S.scripts.length} scripts</span><span class="sp"></span><div class="seg"><button class="on">Specimens</button><button>On the map</button><button>Quiz</button></div></div>` +
  ["arabic-kufic", "chinese", "egyptian-hieroglyphs", "cuneiform", "greek", "devanagari", "hebrew", "runic"].map(sc).map((s, i) =>
    `<div class="stile${i ? "" : " on"}">${specimen(s)}<div class="meta"><h4>${esc(sname(s))}</h4><div class="fam"><span>${esc(s.family)}</span><b>${esc(AS.rangeLabel(s.from, s.to))}</b></div>${strip(s.from, s.to)}</div></div>`).join("");
const big = sc("arabic-kufic");
$("sbig").innerHTML = `<span class="lab">${esc(big.family)}</span><h3>${esc(big.name)}</h3>${specimen(big)}
  <p class="mean">${esc(big.sampleMeaning)}</p>
  <div class="rng"><span>In use</span><span>${esc(AS.rangeLabel(big.from, big.to))}</span></div>${strip(big.from, big.to)}
  <span class="lab" style="margin-top:16px">Look for</span><ol>${big.look.slice(0, 4).map(l => `<li><span>${esc(l)}</span></li>`).join("")}</ol>
  <div style="margin-top:14px;display:flex;gap:10px"><button class="btn pri">Quiz this script</button><button class="btn">Show on map</button></div>`;

/* ---------- 6 Practice ---------- */
const ob = D.gallery.objects.find(o => o.id === "cma-140244") || D.gallery.objects.find(o => o.src === "cma");
const GUESS = { lon:129.87, lat:33.19, name:"Arita, Japan", era:19 }, truthEra = AS.eraOf(ob.y0);
const km = AS.geo.havKm(GUESS.lon, GUESS.lat, ob.lon, ob.lat), ptsPlace = Math.round(5000 * Math.exp(-km / 1500)), off = Math.abs(GUESS.era - truthEra), ptsEra = off === 0 ? 5000 : off === 1 ? 2500 : 0, total = ptsPlace + ptsEra;
$("qphoto").innerHTML = `<div class="mat"><img src="${esc(ob.img)}" alt="Practice object"><button class="btn sm">Inspect</button></div><div class="q"><b>Where was this made, and when?</b><span>Cleveland Museum of Art</span></div>`;
$("qlock").innerHTML = eraBar({ sel:GUESS.era }) + `<div class="pick"><button class="btn pri big">Lock in</button><span>Your answer: <b>${esc(GUESS.name)}</b> · <b>${esc(AS.eraLabel(GUESS.era))}</b></span></div>`;
$("rpts").innerHTML = `<b>${fmtN(11930 + total)}</b>points so far`;
$("res").innerHTML = `<div class="score"><b>${fmtN(total)}</b><span>/ 10,000</span><button class="btn pri big">Next object</button></div>
  <div class="ansline">${esc(ob.place)}<em>${esc(ob.dateLabel)}</em></div>
  <div class="sl"><span class="lab">Place</span><span class="v">${fmtN(km)} km off<small>your pin was in ${esc(GUESS.name)}</small></span><span class="pt">+${fmtN(ptsPlace)}</span></div>
  <div class="sl"><span class="lab">Era</span><span class="v">${off === 0 ? "Correct era" : off + " era too late"}<small>you chose ${esc(AS.eraLabel(GUESS.era))}</small></span><span class="pt">+${fmtN(ptsEra)}</span></div>
  <div class="obj"><div class="th"><img src="${esc(ob.thumb || ob.img)}" alt=""></div><div><h4>${esc(ob.title)}</h4><p>${esc([ob.culture, ob.type, ob.medium].filter(Boolean).join(" · "))}</p>
    <div class="tags"><span class="tag">${dot(REG[ob.region])}${esc(regName(ob.region))}</span><span class="tag">${dot(ERA[truthEra])}${esc(ob.dateLabel)}</span><span class="tag bad">Your pin: ${esc(GUESS.name)}</span></div></div></div>
  <div class="help"><span class="lab">Tells that would have helped</span>${["reign-mark-base", "famille-rose-pink"].map(T).filter(Boolean).map(t => `<div class="c" style="--c:${REG[t.place.region]}"><b>${esc(t.title)}${pips(t.strength)}</b><p>${esc(t.infer)}</p></div>`).join("")}</div>
  <div class="foot"><span>${esc(ob.credit)}</span><a>View at museum</a></div>`;
$("rbar").innerHTML = eraBar({ truth:truthEra, guess:GUESS.era });
const regErr = [["eas", 640], ["sas", 1180], ["sea", 2310], ["cas", 1960], ["wan", 890], ["egy", 310], ["ssa", 2140], ["eur_s", 520], ["eur_nw", 430], ["eur_e", 1270], ["nam", 1510], ["mes", 980], ["and", 1420], ["oce", 2890]];
const spark = a => `<div class="spark">${a.map(v => `<i style="height:${v}%"></i>`).join("")}</div>`;
$("calib").innerHTML = `<div class="tile"><span class="lab">Answered</span><b>148</b><p>objects in 31 rounds</p>${spark([30, 45, 40, 60, 55, 75, 70, 90, 80, 100])}</div>
  <div class="tile"><span class="lab">Average</span><b>61<small>%</small></b><p>of 10,000, last 50 objects</p>${spark([48, 52, 50, 58, 55, 61, 66, 60, 68, 72])}</div>
  <div class="tile"><span class="lab">Median pin error</span><b>1,240<small>km</small></b><p>down from 1,810 km a month ago</p>${spark([100, 92, 96, 84, 80, 76, 78, 70, 66, 62])}</div>
  <div class="tile"><span class="lab">Era within one</span><b>72<small>%</small></b><p>exact era on 38%</p>${spark([50, 55, 52, 60, 64, 62, 70, 68, 74, 72])}</div>
  <div class="chart"><div class="hd"><span class="lab">Median pin error by region, km</span><span class="lab" style="letter-spacing:.04em;text-transform:none;font-weight:500">shorter is better</span></div>
    <div class="bars">${regErr.map(([r, v]) => `<div class="br"><span>${esc(regName(r))}</span><span><i style="--c:${REG[r]};width:${v / 2890 * 100}%"></i></span><em>${fmtN(v)}</em></div>`).join("")}</div></div>`;

/* ---------- 7 Notes ---------- */
const SW = [["Vellum", "#f3ead6"], ["Card", "#fdfaf1"], ["Well", "#ece1c8"], ["Wash", "#f4e6c2"], ["Sea", "#d3e0df"], ["Iron-gall ink", "#21180f"], ["Oxblood", "#8f2a21"], ["Indigo", "#2b3b78"], ["Verdigris", "#2a7d6c"], ["Ochre", "#c0871a"]];
$("notes").innerHTML = `<div><h3>Palette</h3><div class="sw">${SW.map(([n, c]) => `<div><i style="--c:${c}"></i><b>${n}</b>${c}</div>`).join("")}</div>
    <span class="lab">Era scale: colour = time</span><div class="scale">${ERA.map(c => `<i style="--c:${c}"></i>`).join("")}</div><div class="scale-l"><span>3000 BCE</span><span>1 CE</span><span>2000 CE</span></div>
    <span class="lab">Regions: colour = place</span><div class="rg" style="margin-top:7px">${AS.REGIONS.map(r => `<span><i style="--c:${REG[r.id]}"></i>${esc(r.short)}</span>`).join("")}</div></div>
  <div><h3>Type</h3>
    <div class="ty"><div class="lab">Display · Cormorant 600</div><div class="d">Where, <em>and when?</em></div></div>
    <div class="ty"><div class="lab">Text and map labels · EB Garamond</div><div class="t">Blown glass is not found before about 50 BCE. <i>Syro-Palestinian coast</i>, then Rome within a generation.</div></div>
    <div class="ty"><div class="lab">Labels and controls · IBM Plex Sans</div><div class="u">Places · Powers · Materials · Instruments · Animals</div></div>
    <div class="ty"><div class="lab">Figures · IBM Plex Sans, tabular (large figures in EB Garamond)</div><div class="n">445,063 · 1,243 km · 40%</div></div></div>
  <div><h3>What this direction is for</h3><ul>
    <li><b>Reads like a reference book.</b> Dark ink on warm paper, hairline rules, no glow. Long text (tells, rules, script notes) is easier to read than on the dark version.</li>
    <li><b>The map is the main graphic.</b> Pale sea, paper land, polities as light washes, italic labels with a paper halo. Period borders are clearer than on navy.</li>
    <li><b>Colour is kept for data.</b> Oxblood means "act here" or "your answer"; verdigris means "correct"; era and region scales carry time and place everywhere.</li>
    <li><b>Trade-off: less drama.</b> The dark version makes photos and bubbles glow. Here bubbles are flat ink and photos sit on a mount, which is calmer and less showy.</li>
    <li><b>Trade-off: yellow is weak on paper.</b> Egypt's region colour had to go olive-gold with an ink outline. A light page is also brighter for late-night use; a dark "night plate" would be a second theme.</li>
  </ul></div>`;

/* ---------- maps (after the label face has loaded) ---------- */
/* The map engine sets ctx.font = "600 Npx <--f-body>"; this comp wants italic labels, so add the style here.
   In the real app this would be a --map-label-style token in map.js. */
const fd = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, "font");
Object.defineProperty(CanvasRenderingContext2D.prototype, "font", { configurable:true, get:fd.get, set(v){ fd.set.call(this, /EB Garamond/.test(v) && !/italic/.test(v) ? "italic " + v : v); } });
function maps(){
  const desk = AS.createMap($("deskmap"), { year:AS.ERA2MAP[DESK_ERA], mode:"polities", controls:false });
  desk.setMarkers(emp.map(e => ({ lon:e.lon, lat:e.lat, r:3.5 + e.strength * 2.6, color:OX, ring:INK, fill:.95, label:e.name, labelAlways:e.strength === 3, priority:e.strength, labelSize:e.strength === 3 ? 16 : 14, tip:`<b>${esc(e.name)}</b><br>${esc(e.note)}` })));

  desk.flyTo(6, 9, 1.07, 0);
  const atlas = AS.createMap($("atlasmap"), { year:AS.MODERN_MAP, mode:"quiet", controls:false });
  atlas.setMarkers(ranked.map((r, i) => ({ lon:r.p.lon, lat:r.p.lat, r:2.6 + 37 * Math.sqrt(r.share), color:REG[r.reg], ring:RING, fill:r.share > .02 ? .72 : .92,
    label:i < 16 ? r.p.name : null, labelSize:i < 4 ? 15.5 : 14, priority:1000 - i, selected:false, tip:`<b>${esc(r.p.name)}</b><br>${pct(r.share)} · ${fmtN(r.p.total)} objects` })));

  const q = AS.createMap($("qmap"), { year:AS.MODERN_MAP, mode:"quiet", controls:false, crosshair:true });
  q.setMarkers([{ lon:GUESS.lon, lat:GUESS.lat, r:10, shape:"pin", color:OX, label:"Your pin", labelAlways:true, labelSize:15, fixed:true }]);
  q.flyTo(104, 30, 2.5, 0);

  const rv = AS.createMap($("rmap"), { year:AS.MODERN_MAP, mode:"quiet", controls:false });
  rv.setAreas([{ lon:ob.lon, lat:ob.lat, r_km:Math.max(ob.r_km || 0, 120), color:VERD, alpha:.2 }]);
  rv.setArcs([{ from:[GUESS.lon, GUESS.lat], to:[ob.lon, ob.lat], color:INK, width:1.6, dashed:true, label:fmtN(km) + " km" }]);
  rv.setMarkers([{ lon:ob.lon, lat:ob.lat, r:10, shape:"pin", color:VERD, label:ob.place, labelAlways:true, labelSize:15, fixed:true },
    { lon:GUESS.lon, lat:GUESS.lat, r:10, shape:"pin", color:OX, label:"Your pin", labelAlways:true, labelSize:15, fixed:true }]);
  rv.flyTo((GUESS.lon + ob.lon) / 2, (GUESS.lat + ob.lat) / 2 + 1, 6.5, 0);
}
let started = false; const go = () => { if (started) return; started = true; maps(); };
if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('italic 600 14px "EB Garamond"'), document.fonts.load('600 14px "IBM Plex Sans"')]).then(go, go);
setTimeout(go, 1800);
})();
