/* Anthropeum Study — Tells room: a field guide of cue → inference facts.
   Two modes: Tells (filterable card grid + map rail + recall self-test + "Shuffle 10" review) and
   Lookalikes (side-by-side comparison panels with a cover-the-labels self-test).
   URL params: tab, region, medium, era, q, strength, group, study, id. */
(function(){
"use strict";
const AS = window.AS, h = AS.h;
const TC = (n, d) => (AS.theme && AS.theme.css(n)) || d;   /* a theme token's current value, for canvas markers */
const ANY = "any";
const MEDIA = { painting:"Painting", ceramics:"Ceramics", metalwork:"Metalwork", sculpture:"Sculpture", textile:"Textile", manuscript:"Manuscript", arms:"Arms & armour",
  jewelry:"Jewelry", glass:"Glass", furniture:"Furniture", mask:"Masks", architecture:"Architecture", coins:"Coins", lacquer:"Lacquer", "ivory-bone":"Ivory & bone",
  print:"Prints", instrument:"Instruments", other:"Other" };
/* words in a lookalike set's title/blurb that imply a medium (for "Related tells") */
const MEDIA_RE = { painting:/paint|scroll|miniature|icon/, ceramics:/ceramic|porcelain|potter|stoneware|earthenware|celadon|vase|tile/, metalwork:/metal|bronze|brass|silver|enamel/,
  sculpture:/sculpt|statue|buddha|figure|head|relief|carving/, textile:/textile|carpet|rug|silk|weav|cloth|embroider/, manuscript:/manuscript|script|calligraph|book|writing/,
  arms:/sword|armou?r|dagger|arms|blade|helmet/, jewelry:/jewel|gold|bead/, glass:/glass/, furniture:/furniture|chair|cabinet/, mask:/mask/, architecture:/architect|temple|mosque/,
  coins:/coin/, lacquer:/lacquer/, "ivory-bone":/ivory|bone/, print:/print|woodblock/, instrument:/instrument|lute|drum/ };
const STOP = new Set("the and for with from that this versus into over under their them are was were not but have has its between each other than".split(" "));
const GENERIC = new Set("north south east west central early late empire dynasty period kingdom india".split(" "));
const mediumLabel = m => MEDIA[m] || (m ? m.charAt(0).toUpperCase() + m.slice(1).replace(/-/g, " ") : "Other");
const num = v => (typeof v === "number" && isFinite(v)) ? v : (typeof v === "string" && v.trim() !== "" && isFinite(+v)) ? +v : null;
const str = v => v == null ? "" : String(v);
const arr = v => Array.isArray(v) ? v.filter(x => x != null && x !== "").map(String) : (typeof v === "string" && v ? [v] : []);
const isRegion = id => AS.REGIONS.some(r => r.id === id);
const reg = id => id === ANY ? { id:ANY, name:"Anywhere", short:"Anywhere", color:TC("--muted", "#8f93a6") } : AS.region(id);
const terms = q => str(q).toLowerCase().split(/\s+/).filter(Boolean);
const dueText = c => { const d = (c.due - Date.now()) / 864e5; return d <= 0 ? "due now" : d < 1.5 ? "back tomorrow" : `back in ${Math.round(d)} d`; };

/* ---------- module state (reset on mount) ---------- */
let root = null, data = null, state = null, els = null, map = null, lmap = null, eraBar = null, srs = {}, filtered = [], cards = {}, order = [],
  focusId = null, hotId = null, mapHot = null, revealed = new Set(), gradedNow = {}, look = null, searchTimer = 0, fitSig = null, lfitSig = null, run = null, landId = null;

/* ---------- data ---------- */
function normalize(){
  let raw = (window.AS_DATA || {}).tells; raw = raw && typeof raw === "object" ? raw : {};
  const tells = [], byId = {}, problems = [];
  for (const r of Array.isArray(raw.tells) ? raw.tells : []){
    if (!r || typeof r !== "object") continue; const id = str(r.id).trim(); if (!id || byId[id]){ problems.push("dup/missing id: " + id); continue; }
    const p = r.place && typeof r.place === "object" ? r.place : {}; const lat = num(p.lat), lon = num(p.lon), hasPt = lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
    const region = isRegion(p.region) ? p.region : isRegion(r.region) ? r.region : hasPt ? AS.regionOfPoint(lon, lat) : ANY;
    let years = null; const ys = Array.isArray(r.years) ? r.years.map(num).filter(v => v != null) : num(r.years) != null ? [num(r.years)] : [];
    if (ys.length) years = [Math.min(...ys), Math.max(...ys)];
    const medium = str(r.medium).trim().toLowerCase() || "other", tags = arr(r.tags), place = str(p.label || (typeof r.place === "string" ? r.place : ""));
    const t = { id, title:str(r.title) || id, medium, cue:str(r.cue), infer:str(r.infer), place, region, pt:hasPt ? [lon, lat] : null, years,
      strength:AS.clamp(Math.round(num(r.strength) || 2), 1, 3), caveat:str(r.caveat), tags, sources:arr(r.sources).filter(s => /^https?:\/\//i.test(s)) };
    t.era = years ? AS.eraOf((years[0] + years[1]) / 2) : null;
    t.hay = [t.title, t.cue, t.infer, tags.join(" "), place, mediumLabel(medium), reg(region).name].join(" \n ").toLowerCase();
    tells.push(t); byId[id] = t;
  }
  /* spread co-located pins on a small golden-angle spiral so a stack reads as a cluster */
  const stacks = {}; for (const t of tells) if (t.pt){ const k = Math.round(t.pt[1] / 1.5) + ":" + Math.round(t.pt[0] / 1.5); (stacks[k] = stacks[k] || []).push(t); }
  for (const k in stacks) stacks[k].forEach((t, i) => { if (!i) return; const a = i * 2.39996, rad = 1.5 * Math.sqrt(i), lat = AS.clamp(t.pt[1] + rad * Math.sin(a), -85, 85);
    t.pt = [t.pt[0] + rad * Math.cos(a) / Math.max(.35, Math.cos(lat * Math.PI / 180)), lat]; });
  const sets = [], setById = {};
  for (const r of Array.isArray(raw.lookalikes) ? raw.lookalikes : []){
    if (!r || typeof r !== "object") continue; const id = str(r.id).trim(); if (!id || setById[id]) continue;
    const contenders = (Array.isArray(r.contenders) ? r.contenders : []).filter(c => c && typeof c === "object").map(c => { const lat = num(c.lat), lon = num(c.lon), ok = lat != null && lon != null;
      const region = isRegion(c.region) ? c.region : ok ? AS.regionOfPoint(lon, lat) : ANY; const rr = reg(region);
      return { label:str(c.label) || rr.short, region, pt:ok ? [lon, lat] : region !== ANY ? [rr.lon, rr.lat] : null, points:arr(c.points) }; });
    if (!contenders.length) continue;
    const s = { id, title:str(r.title) || id, blurb:str(r.blurb), quickTest:str(r.quickTest || r.quicktest || r.quick_test), contenders };
    s.hay = [s.title, s.blurb, s.quickTest, contenders.map(c => c.label + " " + c.points.join(" ")).join(" ")].join(" \n ").toLowerCase();
    sets.push(s); setById[id] = s;
  }
  const rc = {}, mc = {}; for (const t of tells){ rc[t.region] = (rc[t.region] || 0) + 1; mc[t.medium] = (mc[t.medium] || 0) + 1; }
  const regions = AS.REGIONS.map(r => r.id).filter(id => rc[id]); if (rc[ANY]) regions.push(ANY);
  const media = Object.keys(mc).sort((a, b) => mc[b] - mc[a] || a.localeCompare(b));
  return { tells, byId, sets, setById, regions, media, problems };
}

/* ---------- URL <-> state ---------- */
function parse(p){
  p = p || {}; const era = num(p.era);
  const s = { tab:p.tab === "lookalikes" ? "lookalikes" : "tells", region:p.region && (isRegion(p.region) || p.region === ANY) ? p.region : null,
    medium:p.medium ? String(p.medium).toLowerCase() : null, era:era != null && era >= 0 && era <= 19 ? Math.round(era) : null, q:str(p.q),
    strength:p.strength === "2" || p.strength === "3" ? +p.strength : 0, group:["region", "medium", "era"].includes(p.group) ? p.group : "region",
    study:p.study != null ? p.study !== "0" : AS.store.get("tells.study", true) !== false, id:p.id || null };
  if (s.id && !p.tab && !data.byId[s.id] && data.setById[s.id]) s.tab = "lookalikes";
  return s;
}
const toParams = () => ({ tab:state.tab === "lookalikes" ? "lookalikes" : null, region:state.region, medium:state.medium, era:state.era == null ? null : String(state.era), q:state.q || null,
  strength:state.strength ? String(state.strength) : null, group:state.group === "region" ? null : state.group, study:state.study ? null : "0", id:state.id });
function set(patch){ Object.assign(state, patch); AS.setParams(toParams()); renderAll(); }
const anyFilter = () => !!(state.region || state.medium || state.era != null || state.strength || state.q.trim());
const clearAll = () => set({ region:null, medium:null, era:null, strength:0, q:"", id:null });

let qTerms = [];
function pass(t, skip){
  const s = state;
  if (skip !== "region" && s.region && t.region !== s.region) return false;
  if (skip !== "medium" && s.medium && t.medium !== s.medium) return false;
  if (skip !== "era" && s.era != null && t.years && !(t.years[0] < AS.eraEnd(s.era) && t.years[1] >= AS.eraStart(s.era))) return false;
  if (s.strength && t.strength < s.strength) return false;
  for (const w of qTerms) if (!t.hay.includes(w)) return false;
  return true;
}

/* ---------- shell ---------- */
function build(){
  els = {};
  els.tab = AS.ui.seg([{ value:"tells", label:"Tells" }, { value:"lookalikes", label:"Lookalikes" }], state.tab, v => set({ tab:v, id:null }), "gold");
  els.search = h("input.input.tl-search", { type:"search", placeholder:"Search cues, places, tags", "aria-label":"Search tells", spellcheck:"false", autocomplete:"off",
    oninput:() => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { if (els) set({ q:els.search.value, id:null }); }, 120); },
    onkeydown:e => { if (e.key === "Enter"){ clearTimeout(searchTimer); set({ q:els.search.value, id:null }); els.search.blur(); } } });
  els.group = AS.ui.seg([{ value:"region", label:"Region" }, { value:"medium", label:"Medium" }, { value:"era", label:"Era" }], state.group, v => set({ group:v }));
  els.study = h("button.tl-switch", { type:"button", title:"Study mode: answers stay covered until you ask (S)", onclick:toggleStudy }, h("i"), "Study");
  els.shuffle = h("button.btn.primary.sm", { type:"button", title:"A ten-card flashcard run over the current filter, weakest first", onclick:() => openShuffle() }, "Shuffle 10");
  els.tools = h("div.tl-tools", {}, h("span.tl-lab", {}, "Group"), els.group, els.study, els.shuffle);
  els.top = h("div.topbar.tl-topbar", {}, h("h2", {}, "Tells"), els.tab, h("div.tl-searchwrap", {}, els.search, h("span.kbd", {}, "/")), h("div.grow"), els.tools);

  /* tells mode */
  els.map = h("div.tl-map"); els.mapNote = h("div.tl-mapnote");
  els.regions = h("div"); els.media = h("div"); els.eraHost = h("div.tl-era"); els.eraNow = h("span.tl-sec-r"); els.deck = h("div.tl-deck");
  els.strength = AS.ui.seg([{ value:"0", label:"All" }, { value:"2", label:"Solid +", title:"Strength 2 and 3" }, { value:"3", label:"Giveaways", title:"Strength 3 only" }], String(state.strength), v => set({ strength:+v, id:null }));
  const sec = (title, body, right) => h("section.tl-sec", {}, h("div.tl-sec-h", {}, h("h4", {}, title), right || null), body);
  els.rail = h("aside.tl-rail", {}, h("div.tl-mapwrap", {}, els.map, els.mapNote), sec("Deck", els.deck), sec("Region", els.regions), sec("Era", els.eraHost, els.eraNow), sec("Strength", els.strength), sec("Medium", els.media));
  els.summary = h("div.tl-summary"); els.groups = h("div.tl-groups");
  els.main = h("div.tl-main", {}, els.summary, els.groups);
  els.tells = h("div.tl-tells", {}, els.rail, els.main);
  eraBar = AS.ui.eraBar(els.eraHost, { value:state.era, allowAll:false, ages:false, compact:true, tipUnit:"tells", onChange:i => set({ era:i === state.era ? null : i, id:null }) });

  els.groups.addEventListener("click", e => { const card = e.target.closest(".tl-card"); if (!card) return; const id = card.dataset.id, a = e.target.closest("[data-act]");
    if (a){ const act = a.dataset.act; if (act === "tag"){ set({ q:a.dataset.tag, id:null }); return; } if (act === "reveal") reveal(id); else if (act === "ok") grade(id, true); else if (act === "no") grade(id, false); }
    if (!e.target.closest("a")) setFocus(id, {}); });
  els.groups.addEventListener("mouseover", e => { const c = e.target.closest(".tl-card"), id = c ? c.dataset.id : null; if (id !== hotId){ hotId = id; paintMarkers(); } });
  els.groups.addEventListener("mouseleave", () => { if (hotId){ hotId = null; paintMarkers(); } });

  /* lookalikes mode */
  els.index = h("aside.tl-index"); els.panel = h("div.tl-panel"); els.lmap = h("div.tl-lmap");
  els.look = h("div.tl-look", {}, els.index, h("div.tl-lmain", {}, els.panel));
  els.body = h("div.tl-body", {}, els.tells, els.look);
  root.append(els.top, els.body);
  /* mouse clicks shouldn't leave a button holding focus, or Space would re-press it instead of revealing a card */
  root.addEventListener("click", e => { const a = document.activeElement; if (e.detail > 0 && a && a.tagName === "BUTTON" && root.contains(a)) a.blur(); });
}

function renderAll(){
  if (!els) return;
  qTerms = terms(state.q);
  els.tab.set(state.tab); els.group.set(state.group); els.strength.set(String(state.strength));
  if (document.activeElement !== els.search) els.search.value = state.q;
  els.study.classList.toggle("on", state.study); els.study.setAttribute("aria-pressed", state.study ? "true" : "false");
  const lk = state.tab === "lookalikes"; els.tells.hidden = lk; els.look.hidden = !lk; els.tools.hidden = lk;
  els.search.placeholder = lk ? "Search lookalike sets" : "Search cues, places, tags";
  if (!data.tells.length && !data.sets.length){ els.tells.hidden = els.look.hidden = true; if (!els.none){ els.none = emptyState("The field guide is still at the printer's.", "No tells are packed yet. Once data-src/tells.json lands, run python3 build/pack.py and reload."); els.body.append(els.none); } return; }
  if (lk) renderLook(); else { renderRail(); renderGrid(); }
}
const emptyState = (title, text, btn) => h("div.tl-empty", {}, h("div.tl-empty-glyph", {}, "◇"), h("h3", {}, title), h("p", {}, text), btn || null);

/* ---------- tells: rail ---------- */
function renderRail(){
  filtered = data.tells.filter(t => pass(t));
  const rc = {}, mc = {}, ev = new Array(20).fill(0);
  for (const t of data.tells){
    if (pass(t, "region")) rc[t.region] = (rc[t.region] || 0) + 1;
    if (pass(t, "medium")) mc[t.medium] = (mc[t.medium] || 0) + 1;
    if (t.years && pass(t, "era")){ const a = AS.eraOf(t.years[0]), b = AS.eraOf(Math.max(t.years[0], t.years[1] - 1)); for (let i = a; i <= b; i++) ev[i]++; }
  }
  const zero = el => { for (const b of el.children){ const n = b.querySelector(".n"); if (n && n.textContent === "0" && !b.classList.contains("on")) b.classList.add("tl-zero"); } return el; };
  els.regions.replaceChildren(zero(AS.ui.chips(data.regions.map(id => ({ value:id, label:reg(id).short, color:reg(id).color, n:rc[id] || 0 })), state.region, v => set({ region:v, id:null }))));
  els.media.replaceChildren(zero(AS.ui.chips(data.media.map(m => ({ value:m, label:mediumLabel(m), n:mc[m] || 0 })), state.medium, v => set({ medium:v, id:null }))));
  eraBar.set(state.era); eraBar.setValues(ev);
  els.eraNow.replaceChildren(...(state.era == null ? [h("span.faint", {}, "any")] : [AS.ui.eraChip(state.era), h("button.tl-x", { type:"button", title:"Clear era", onclick:() => set({ era:null }) }, "×")]));
  renderDeck();
  if (!map && els.map.offsetWidth){
    map = AS.createMap(els.map, { controls:false });
    map.on("click", ({ marker }) => { if (marker && marker.id){ state.id = marker.id; AS.setParams({ id:marker.id }); setFocus(marker.id, { scroll:true, flash:true }); } });
    map.on("hover", ({ marker }) => { const id = marker ? marker.id : null; if (id === mapHot) return; if (mapHot && cards[mapHot]) cards[mapHot].classList.remove("is-hot"); mapHot = id; if (id && cards[id]) cards[id].classList.add("is-hot"); });
  }
  paintMarkers();
  const onMap = filtered.filter(t => t.pt).length;
  els.mapNote.textContent = filtered.length ? `${onMap} pinned${filtered.length - onMap ? ` · ${filtered.length - onMap} placeless` : ""}` : "nothing to pin";
  const sig = [state.region, state.medium, state.era, state.strength, state.q].join("|");
  if (sig !== fitSig && map){ fitSig = sig; requestAnimationFrame(() => { if (!map || !els.map.offsetWidth) return; const pts = filtered.filter(t => t.pt).map(t => t.pt);
    if (anyFilter() && pts.length) map.fit(pts, { pad:36, maxZoom:5, ms:AS.still ? 0 : 500 }); else map.reset(AS.still ? 0 : 400); }); }
}
function paintMarkers(){
  if (!map) return;
  map.setMarkers(filtered.filter(t => t.pt).map(t => { const r = reg(t.region), sel = t.id === hotId || t.id === focusId;
    return { id:t.id, lon:t.pt[0], lat:t.pt[1], r:sel ? 6.5 : 4, color:r.color, selected:sel, glow:sel, label:t.id === (hotId || focusId) ? (t.place || r.short) : null, labelAlways:true, priority:sel ? 10 : 0,
      tip:`<div class="t">${AS.esc(t.title)}</div><div class="s">${AS.esc(t.place || r.name)} · ${AS.esc(mediumLabel(t.medium))}</div>` }; }));
}
function renderDeck(){
  const ids = filtered.map(t => t.id), s = AS.srs.summary("tells", ids), n = Math.max(1, s.total), learning = s.seen - s.known;
  els.deck.replaceChildren(
    h("div.tl-deckbar", { title:`${s.known} known · ${learning} learning · ${s.total - s.seen} unseen` }, h("i.k", { style:{ width:100 * s.known / n + "%" } }), h("i.l", { style:{ width:100 * learning / n + "%" } })),
    h("div.tl-decknums", {}, h("span", {}, h("b.k", {}, String(s.known)), " known"), h("span", {}, h("b.l", {}, String(s.seen)), " seen"), h("span", {}, h("b.d", {}, String(s.due)), " due"), h("span.tl-of", {}, `of ${s.total}`)));
}

/* ---------- tells: grid ---------- */
function groupsOf(list){
  const m = new Map(); const keyOf = state.group === "medium" ? t => t.medium : state.group === "era" ? t => t.era == null ? "any" : String(AS.AGES.indexOf(AS.ageOf(t.era))) : t => t.region;
  for (const t of list){ const k = keyOf(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); }
  let keys = [...m.keys()];
  if (state.group === "region") keys.sort((a, b) => data.regions.indexOf(a) - data.regions.indexOf(b));
  else if (state.group === "medium") keys.sort((a, b) => m.get(b).length - m.get(a).length || a.localeCompare(b));
  else keys.sort((a, b) => (a === "any" ? 99 : +a) - (b === "any" ? 99 : +b));
  return keys.map(k => { const items = m.get(k).sort((a, b) => b.strength - a.strength || a.title.localeCompare(b.title)); let name, color = null, link = null, sub = null;
    if (state.group === "region"){ const r = reg(k); name = r.name; color = r.color; if (k !== ANY) link = h("a.tl-glink", { href:AS.href("practice", { mode:"tells", region:k }) }, "Practice this region →"); }
    else if (state.group === "medium") name = mediumLabel(k);
    else if (k === "any"){ name = "Any period"; sub = "timeless tells"; } else { const a = AS.AGES[+k]; name = a.name; color = AS.eraColor(Math.round((a.from + a.to) / 2)); sub = AS.rangeLabel(AS.eraStart(a.from), AS.eraEnd(a.to)); }
    return { name, color, link, sub, items }; });
}
function renderGrid(){
  srs = AS.srs.state("tells"); cards = {}; order = [];
  /* summary line: count + what it's filtered to */
  const pill = (node, clear) => h("button.tl-fpill", { type:"button", title:"Remove this filter", onclick:clear }, node, h("span.tl-fx", {}, "×"));
  const pills = [];
  if (state.region) pills.push(pill(state.region === ANY ? "Anywhere" : AS.ui.regionTag(state.region), () => set({ region:null })));
  if (state.medium) pills.push(pill(mediumLabel(state.medium), () => set({ medium:null })));
  if (state.era != null) pills.push(pill(AS.ui.eraChip(state.era), () => set({ era:null })));
  if (state.strength) pills.push(pill(AS.ui.pips(state.strength), () => set({ strength:0 })));
  if (state.q.trim()) pills.push(pill(`“${state.q.trim()}”`, () => set({ q:"" })));
  els.summary.replaceChildren(
    h("div.tl-sum-l", {}, h("b.tl-count", {}, String(filtered.length)), h("span.tl-count-l", {}, filtered.length === 1 ? "tell" : "tells"),
      pills.length ? [h("span.tl-sum-to", {}, "filtered to"), pills, h("button.btn.sm.ghost.tl-clear", { type:"button", onclick:clearAll }, "Clear all")] : h("span.tl-sum-to", {}, `of ${data.tells.length} · the whole field guide`)),
    h("div.tl-keys", {}, h("span.kbd", {}, "j"), h("span.kbd", {}, "k"), " move", state.study ? [h("span.kbd", {}, "Space"), " reveal", h("span.kbd", {}, "1"), h("span.kbd", {}, "2"), " grade"] : null));
  if (!filtered.length){
    els.groups.replaceChildren(data.tells.length ? emptyState("Nothing matches.", "Either the filter is too tight or this corner of the world is genuinely unstudied.", h("button.btn", { type:"button", onclick:clearAll }, "Clear all filters"))
      : emptyState("No tells yet.", "Lookalike sets are in; the tells themselves haven't been packed."));
    focusId = null; return;
  }
  const frag = document.createDocumentFragment();
  for (const g of groupsOf(filtered)){
    const grid = h("div.tl-grid");
    for (const t of g.items){ const c = buildCard(t, false); cards[t.id] = c; order.push(t.id); grid.append(c); }
    frag.append(h("section.tl-group", { style:g.color ? { "--c":g.color } : null }, h("header.tl-ghead", {}, h("h3", {}, g.name), h("span.tl-gn", {}, String(g.items.length)), g.sub ? h("span.tl-gsub", {}, g.sub) : null, h("span.tl-grule"), g.link), grid));
  }
  els.groups.replaceChildren(frag);
  if (focusId && !cards[focusId]) focusId = null;
  if (landId && cards[landId]){ const id = landId; landId = null; setFocus(id, { scroll:true, flash:true, instant:true }); }
  else if (focusId) cards[focusId].classList.add("is-focus");
}
function spanStrip(t){
  if (!t.years) return null; const a = AS.eraOf(t.years[0]), b = AS.eraOf(Math.max(t.years[0], t.years[1] - 1)), stops = [];
  for (let i = 0; i < 20; i++) stops.push(`${i >= a && i <= b ? AS.eraColor(i) : "rgba(var(--tint),.07)"} ${i * 5}% ${i * 5 + 5}%`);
  return h("div.tl-span", { title:`${AS.rangeLabel(t.years[0], t.years[1])} on the 3000 BCE – 2000 CE scale`, style:{ background:`linear-gradient(90deg,${stops.join(",")})` } });
}
function boxEl(c){ const b = h("span.tl-box", { title:`Box ${c.box} of 5 · ${dueText(c)} · seen ${c.seen}×` }); for (let i = 1; i <= 5; i++) b.append(h("i" + (i <= c.box ? ".on" : ""))); return b; }
function buildCard(t, animate){
  const r = reg(t.region), covered = state.study && !revealed.has(t.id), c = srs[t.id], g = gradedNow[t.id];
  const ans = covered
    ? h("button.tl-cover", { type:"button", data:{ act:"reveal" } }, h("span", {}, "What does it tell you?"), h("span.kbd", {}, "Space"))
    : h("div.tl-ans" + (animate ? ".is-in" : ""), {},
        h("div.tl-ans-h", {}, h("span.tl-ans-k", {}, "Tells you"), t.place ? h("span.tl-place", {}, t.place) : null),
        h("p.tl-infer", {}, t.infer || "No inference written yet."),
        t.caveat ? h("p.tl-caveat", {}, h("b", {}, "Misleads when: "), t.caveat) : null,
        !state.study ? null : g == null
          ? h("div.tl-grade", {}, h("button.tl-gbtn.ok", { type:"button", data:{ act:"ok" } }, h("span.kbd", {}, "1"), "Knew it"), h("button.tl-gbtn.no", { type:"button", data:{ act:"no" } }, h("span.kbd", {}, "2"), "Didn't"))
          : h("div.tl-graded" + (g ? ".ok" : ".no"), {}, g ? "Knew it" : "Missed", c ? h("span", {}, ` · box ${c.box} · ${dueText(c)}`) : null));
  const foot = !covered && (t.tags.length || t.sources.length) ? h("div.tl-foot", {}, t.tags.slice(0, 5).map(x => h("button.tl-tag", { type:"button", title:`Search “${x}”`, data:{ act:"tag", tag:x } }, x)), h("span.tl-foot-sp"),
    t.sources.slice(0, 3).map((s, i) => h("a.tl-src", { href:s, target:"_blank", rel:"noopener noreferrer", title:s }, i ? String(i + 1) : "src ↗"))) : null;
  return h("article.tl-card" + (covered ? ".is-covered" : "") + (t.id === focusId ? ".is-focus" : "") + (g != null ? (g ? ".is-ok" : ".is-no") : ""), { style:{ "--c":r.color }, data:{ id:t.id } },
    h("div.tl-top", {}, h("span.eyebrow", {}, mediumLabel(t.medium)), h("span.tl-top-r", {}, c ? boxEl(c) : null, AS.ui.pips(t.strength))),
    h("h3.tl-title", { title:t.title }, t.title),
    h("div.tl-meta", {}, t.region === ANY ? h("span.tag.plain", {}, "anywhere") : AS.ui.regionTag(t.region),
      covered ? h("span.tl-when", {}, "when?") : t.years ? AS.ui.yearChip(t.years[0], t.years[1]) : h("span.tl-when", {}, "any period")),
    covered ? null : spanStrip(t),
    h("p.tl-cue", {}, t.cue || "No cue written yet."), ans, foot);
}
function refreshCard(id, animate){ const old = cards[id], t = data.byId[id]; if (!old || !t) return; const c = buildCard(t, animate); if (old.classList.contains("is-hot")) c.classList.add("is-hot"); old.replaceWith(c); cards[id] = c; }
function setFocus(id, o){
  if (focusId && cards[focusId]) cards[focusId].classList.remove("is-focus");
  focusId = id && cards[id] ? id : null; if (!focusId){ paintMarkers(); return; }
  const c = cards[focusId]; c.classList.add("is-focus");
  if (o.scroll) c.scrollIntoView({ block:o.block || "center", behavior:o.instant || AS.still ? "auto" : "smooth" });
  if (o.flash){ c.classList.remove("is-flash"); void c.offsetWidth; c.classList.add("is-flash"); }
  paintMarkers();
}
function move(d){ if (!order.length) return; const i = order.indexOf(focusId); const j = i < 0 ? (d > 0 ? 0 : order.length - 1) : AS.clamp(i + d, 0, order.length - 1); setFocus(order[j], { scroll:true, block:"nearest" }); }
function reveal(id){ if (!state.study || !cards[id] || revealed.has(id)) return; revealed.add(id); refreshCard(id, true); }
function grade(id, ok, viaKey){
  const t = data.byId[id]; if (!t || !state.study || !revealed.has(id) || gradedNow[id] != null) return;
  srs[id] = AS.srs.grade("tells", id, ok); gradedNow[id] = ok;
  AS.log.add({ mode:"tells-browse", kind:"recall", region:t.region === ANY ? null : t.region, ok, ref:id, pts:ok ? 5000 : 0, max:5000 });
  refreshCard(id, false); renderDeck(); if (viaKey) move(1);
}
function toggleStudy(){ const v = !state.study; AS.store.set("tells.study", v); revealed = new Set(); set({ study:v }); AS.toast(v ? "Study on — answers covered" : "Study off — everything showing", 1400); }

/* ---------- Shuffle 10: focused flashcard run ---------- */
function openShuffle(){
  if (run) return; const ids = filtered.map(t => t.id);
  if (!ids.length){ AS.toast("Nothing to shuffle. Loosen the filter."); return; }
  const deck = AS.srs.order("tells", ids).slice(0, 10).map(id => data.byId[id]); let i = 0, shown = false, done = false; const res = [];
  const box = h("div.tl-run");
  const dots = () => h("div.tl-dots", {}, deck.map((_, k) => h("i" + (k < res.length ? (res[k] ? ".ok" : ".no") : k === i && !done ? ".cur" : ""))));
  const what = [state.region ? reg(state.region).short : null, state.medium ? mediumLabel(state.medium) : null, state.era != null ? AS.eraLabel(state.era) : null, state.q.trim() ? `“${state.q.trim()}”` : null].filter(Boolean).join(" · ") || "whole field guide";
  function paint(){
    if (done){ const right = res.filter(Boolean).length, missed = deck.filter((_, k) => !res[k]);
      box.replaceChildren(h("div.tl-run-h", {}, h("span.eyebrow", {}, "Review done · " + what), dots()),
        h("div.tl-run-sum", {}, h("div.pts", {}, String(right), h("small", {}, `/ ${deck.length} known`)),
          h("p.tl-run-verdict", {}, right === deck.length ? "Clean sweep. They move up a box." : right >= deck.length * .7 ? "Solid. The misses come back first next time." : "That's what the deck is for. The misses come back first.")),
        missed.length ? h("div.tl-run-missed", {}, h("h4", {}, "Worth another look"), missed.map(t => h("a.tl-miss", { href:AS.href("tells", { id:t.id }), style:{ "--c":reg(t.region).color }, onclick:() => run && run.close() },
          h("b", {}, t.title), h("span", {}, t.infer)))) : "",
        h("div.tl-run-foot", {}, h("button.btn.primary", { type:"button", onclick:() => { run.close(); openShuffle(); } }, "Another 10"), h("button.btn", { type:"button", onclick:() => run.close() }, "Done")));
      return; }
    const t = deck[i], r = reg(t.region);
    box.replaceChildren(h("div.tl-run-h", {}, h("span.eyebrow", {}, `Card ${i + 1} of ${deck.length} · ${what}`), dots()),
      h("div.tl-run-card" + (shown ? ".is-shown" : ""), { style:{ "--c":shown ? r.color : "var(--line-3)" } },
        h("div.tl-top", {}, h("span.eyebrow", {}, mediumLabel(t.medium)), AS.ui.pips(t.strength)),
        h("h2.tl-run-title", {}, t.title), h("p.tl-run-cue", {}, t.cue),
        shown ? h("div.tl-ans.tl-run-ans.is-in", {},
            h("div.tl-meta", {}, t.region === ANY ? h("span.tag.plain", {}, "anywhere") : AS.ui.regionTag(t.region), t.place ? h("span.tl-place", {}, t.place) : null, t.years ? AS.ui.yearChip(t.years[0], t.years[1]) : h("span.tl-when", {}, "any period")),
            h("p.tl-infer", {}, t.infer || "No inference written yet."), t.caveat ? h("p.tl-caveat", {}, h("b", {}, "Misleads when: "), t.caveat) : null)
          : h("p.tl-run-hint", {}, "Say where and when — out loud, ideally — then look.")),
      shown ? h("div.tl-run-foot", {}, h("button.tl-gbtn.ok.lg", { type:"button", onclick:() => answer(true) }, h("span.kbd", {}, "1"), "Knew it"), h("button.tl-gbtn.no.lg", { type:"button", onclick:() => answer(false) }, h("span.kbd", {}, "2"), "Didn't"))
        : h("div.tl-run-foot", {}, h("button.btn.primary.lg", { type:"button", onclick:() => { shown = true; paint(); } }, "Reveal", h("span.kbd.tl-kbd-dark", {}, "Space"))));
  }
  function answer(ok){ if (!shown || done) return; const t = deck[i]; AS.srs.grade("tells", t.id, ok);
    AS.log.add({ mode:"tells-shuffle", kind:"recall", region:t.region === ANY ? null : t.region, ok, ref:t.id, pts:ok ? 5000 : 0, max:5000 });
    res.push(ok); i++; shown = false; if (i >= deck.length) done = true; paint(); }
  const key = e => { if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === " " || e.key === "Enter"){ if (done) return; e.preventDefault(); if (!shown){ shown = true; paint(); } }
    else if (e.key === "1" || e.key === "2"){ e.preventDefault(); answer(e.key === "1"); } };
  document.addEventListener("keydown", key);
  run = AS.modal(box, { width:720, onClose(){ document.removeEventListener("keydown", key); run = null; if (els && state.tab === "tells"){ renderDeck(); renderGrid(); } } });
  paint();
}

/* ---------- lookalikes ---------- */
function maskNames(text, s){ let out = text;
  for (const c of s.contenders) for (const w of c.label.split(/[^A-Za-zÀ-ÿ]+/)){ if (w.length < 4 || GENERIC.has(w.toLowerCase())) continue; const stem = w.slice(0, w.length <= 5 ? 4 : 5);
    out = out.replace(new RegExp("\\b" + stem + "[a-zà-ÿ]{0,5}\\b", "g"), "▒▒▒▒"); }
  return out; }
function related(s){
  const regs = new Set(s.contenders.map(c => c.region)), text = (s.title + " " + s.blurb).toLowerCase();
  const words = s.title.toLowerCase().split(/[^a-zà-ÿ]+/).filter(w => w.length > 3 && !STOP.has(w));
  const scored = []; for (const t of data.tells){ if (!regs.has(t.region)) continue; let sc = 0; const re = MEDIA_RE[t.medium];
    if ((re && re.test(text)) || text.includes(t.medium.replace("-", " "))) sc += 3; for (const w of words) if (t.hay.includes(w)) sc += 1; if (sc) scored.push([sc + t.strength / 10, t]); }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, 6).map(x => x[1]);
}
function renderLook(){
  const sets = data.sets;
  if (!sets.length){ els.index.replaceChildren(); els.panel.replaceChildren(emptyState("No lookalike sets yet.", "The side-by-side comparisons haven't been packed. The tells are next door.", h("button.btn", { type:"button", onclick:() => set({ tab:"tells" }) }, "Open Tells"))); return; }
  const list = sets.filter(s => qTerms.every(w => s.hay.includes(w)));
  const cur = data.setById[state.id] || (look.id && list.includes(data.setById[look.id]) ? data.setById[look.id] : null) || list[0] || data.setById[look.id] || sets[0];
  if (cur.id !== look.id){ look.id = cur.id; look.shown = new Set(); look.peek = false; look.order = cur.contenders.map((_, i) => i); if (look.cover) look.order = AS.shuffle(look.order); }
  look.list = list;
  els.index.replaceChildren(h("div.tl-index-h", {}, h("h4", {}, "Confusions"), h("span.tl-gn", {}, qTerms.length ? `${list.length} / ${sets.length}` : String(sets.length))),
    ...(list.length ? list.map(s => h("button.tl-irow" + (s.id === cur.id ? ".on" : ""), { type:"button", onclick:() => set({ id:s.id }) },
      h("span.tl-irow-t", {}, s.title), h("span.tl-irow-d", {}, s.contenders.map(c => h("i", { style:{ background:reg(c.region).color }, title:c.label })))))
    : [h("p.tl-index-none", {}, "No set matches that search.")]));
  const on = els.index.querySelector(".tl-irow.on"); if (on && on.scrollIntoView) on.scrollIntoView({ block:"nearest" });
  renderPanel(cur);
}
function renderPanel(s){
  const n = s.contenders.length, hidden = ci => look.cover && !look.shown.has(ci), left = s.contenders.filter((_, ci) => hidden(ci)).length, veiled = look.cover && left > 0 && !look.peek;
  const cols = look.order.map((ci, d) => { const c = s.contenders[ci], hid = hidden(ci), r = reg(c.region);
    return h("div.tl-col" + (hid ? ".is-hid" : "") + (look.cover && !hid ? ".is-in" : ""), { style:{ "--c":hid ? "var(--faint)" : r.color } },
      hid ? h("button.tl-col-h.tl-col-guess", { type:"button", title:"Click to reveal", onclick:() => { look.shown.add(ci); renderPanel(s); } }, h("span.tl-col-q", {}, String.fromCharCode(65 + d)), h("span", {}, h("b", {}, "Which one is this?"), h("small", {}, "decide, then click")))
          : h("div.tl-col-h", {}, h("h3", {}, c.label), c.region === ANY ? null : AS.ui.regionTag(c.region)),
      c.points.length ? h("ul.tl-points", {}, c.points.map(p => h("li", {}, hid ? maskNames(p, s) : p))) : h("p.faint", {}, "No discriminating points written yet.")); });
  const rel = related(s), rs = [...new Set(s.contenders.map(c => c.region))], oneRegion = rs.length === 1 && rs[0] !== ANY ? rs[0] : null;
  els.panel.replaceChildren(
    h("div.tl-ltop", {},
      h("div.tl-lhead", {}, h("span.eyebrow", {}, `Lookalikes · ${n} contender${n === 1 ? "" : "s"}`), h("h1.tl-ltitle", {}, s.title), s.blurb ? h("p.tl-lblurb", {}, s.blurb) : null,
        s.quickTest ? h("div.note.tl-quick" + (veiled ? ".is-veiled" : ""), veiled ? { role:"button", tabindex:"0", title:"Peek at the rule", onclick:() => { look.peek = true; renderPanel(s); } } : {},
          h("span.eyebrow", {}, "Quick test"), h("p", {}, s.quickTest), veiled ? h("span.tl-veil", {}, "Hidden while you guess · click to peek") : null) : null),
      h("div.tl-lmapwrap", {}, els.lmap)),
    h("div.tl-lbar", {},
      h("button.tl-switch" + (look.cover ? ".on" : ""), { type:"button", "aria-pressed":look.cover ? "true" : "false", title:"Hide the names and shuffle the columns (C)", onclick:toggleCover }, h("i"), "Cover the labels"),
      look.cover ? (left ? [h("span.tl-lbar-t", {}, `${left} of ${n} still hidden`), h("button.btn.sm.ghost", { type:"button", onclick:() => { s.contenders.forEach((_, ci) => look.shown.add(ci)); renderPanel(s); } }, "Reveal all")]
        : [h("span.tl-lbar-t", {}, "All out in the open."), h("button.btn.sm.ghost", { type:"button", onclick:() => { look.shown = new Set(); look.peek = false; look.order = AS.shuffle(look.order); renderPanel(s); } }, "Shuffle and go again")])
        : h("span.tl-lbar-t", {}, "Self-test: hide the names, guess which column is which.")),
    h("div.tl-cols", { style:{ "--n":String(n) } }, cols),
    h("section.tl-rel", {}, h("div.tl-sec-h", {}, h("h4", {}, "Related tells"), rel.length ? h("a.tl-glink", { href:AS.href("tells", { region:oneRegion }) }, oneRegion ? `All ${reg(oneRegion).short} tells →` : "Open Tells →") : null),
      rel.length ? h("div.tl-minis", {}, rel.map(t => h("a.tl-mini", { href:AS.href("tells", { id:t.id }), style:{ "--c":reg(t.region).color } },
          h("span.eyebrow", {}, mediumLabel(t.medium)), h("b", {}, t.title), h("span.tl-mini-cue", {}, t.cue), h("span.tl-mini-f", {}, t.region === ANY ? null : AS.ui.regionTag(t.region), AS.ui.pips(t.strength)))))
        : h("p.faint", {}, "No tells filed against these regions and this medium yet.")));
  /* side map: where the contenders sit */
  if (!lmap && els.lmap.offsetWidth) lmap = AS.createMap(els.lmap, { controls:false });
  if (!lmap) return;
  lmap.setMarkers(s.contenders.map((c, ci) => { if (!c.pt) return null; const hid = hidden(ci), r = reg(c.region);
    return { lon:c.pt[0], lat:c.pt[1], r:hid ? 6 : 7.5, color:hid ? TC("--muted", "#8f93a6") : r.color, glow:!hid, label:hid ? "?" : c.label, labelAlways:true, fixed:true, tip:hid ? "<div class=\"s\">One of them lives here.</div>" : `<div class="t">${AS.esc(c.label)}</div><div class="s">${AS.esc(r.name)}</div>` }; }).filter(Boolean));
  if (lfitSig !== s.id){ lfitSig = s.id; requestAnimationFrame(() => { if (!lmap || !els.lmap.offsetWidth) return; const pts = s.contenders.filter(c => c.pt).map(c => c.pt); if (pts.length) lmap.fit(pts, { pad:64, maxZoom:pts.length === 1 ? 3 : 6, ms:AS.still ? 0 : 500 }); else lmap.reset(0); }); }
}
function toggleCover(){ const s = data.setById[look.id]; if (!s) return; look.cover = !look.cover; look.shown = new Set(); look.peek = false; look.order = s.contenders.map((_, i) => i); if (look.cover) look.order = AS.shuffle(look.order); renderPanel(s); }

/* ---------- keyboard ---------- */
function onKey(e){
  if (!els || e.metaKey || e.ctrlKey || e.altKey || document.querySelector(".modal-back")) return;
  const t = e.target, typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  if (typing){ if (e.key === "Escape") t.blur(); return; }
  const k = e.key;
  if (k === "/"){ e.preventDefault(); els.search.focus(); els.search.select(); return; }
  if (t && (t.tagName === "BUTTON" || t.tagName === "A") && (k === " " || k === "Enter")) return;
  if (state.tab === "lookalikes"){ const list = look.list || [], i = list.findIndex(s => s.id === look.id);
    if (k === "j" || k === "ArrowDown"){ e.preventDefault(); if (list.length) set({ id:list[AS.clamp(i + 1, 0, list.length - 1)].id }); }
    else if (k === "k" || k === "ArrowUp"){ e.preventDefault(); if (list.length) set({ id:list[AS.clamp(i < 0 ? 0 : i - 1, 0, list.length - 1)].id }); }
    else if (k === "c") toggleCover();
    else if (k === " " && look.cover){ e.preventDefault(); const s = data.setById[look.id], ci = s && look.order.find(c => !look.shown.has(c)); if (ci != null){ look.shown.add(ci); renderPanel(s); } }
    return; }
  if (k === "j" || k === "ArrowDown"){ e.preventDefault(); move(1); }
  else if (k === "k" || k === "ArrowUp"){ e.preventDefault(); move(-1); }
  else if (k === " "){ if (!state.study) return; e.preventDefault(); if (!focusId) move(1); if (focusId) reveal(focusId); }
  else if (k === "1" || k === "2"){ if (focusId) grade(focusId, k === "1", true); }
  else if (k === "s") toggleStudy();
  else if (k === "Escape" && focusId) setFocus(null, {});
}

AS.views.tells = {
  title:"Tells", ownsDigits:true,
  mount(el, params){
    root = el; data = normalize(); look = { id:null, cover:false, shown:new Set(), order:[], peek:false, list:[] };
    revealed = new Set(); gradedNow = {}; focusId = hotId = mapHot = null; fitSig = lfitSig = null; cards = {}; order = []; filtered = [];
    state = parse(params); landId = state.id; build(); document.addEventListener("keydown", onKey); renderAll();
    if (data.problems.length) console.info("[tells] skipped entries:", data.problems.slice(0, 10));
  },
  update(params){ if (!els) return; const prev = state; state = parse(params); if (prev.study !== state.study) revealed = new Set(); landId = state.id !== prev.id ? state.id : null; renderAll(); },
  unmount(){
    document.removeEventListener("keydown", onKey); clearTimeout(searchTimer); if (run) run.close();
    if (eraBar) eraBar.destroy(); if (map) map.destroy(); if (lmap) lmap.destroy(); AS.tip.hide();
    map = lmap = eraBar = els = root = null; cards = {}; order = [];
  }
};
})();
