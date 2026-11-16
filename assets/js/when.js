/* When — "earliest possible": what existed when, and when it got there.
   Data: AS_DATA.techniques = { groups:[{id,name}], techniques:[{ id,name,group,origin{place,lat,lon,year,region},
   arrivals[{place,lat,lon,year,region,note,independent}], end|null, rule, lookFor, blurb, confidence, sources[] }] }
   URL params: id, group, region, era, q, sort (group|date), pinned (1), tab (tech|era; only when both id and era are set). */
(function(){ "use strict";
const AS = window.AS, h = AS.h, esc = AS.esc;
const Y0 = -3000, Y1 = 2000, SPAN = Y1 - Y0;
const pct = y => AS.clamp((y - Y0) / SPAN * 100, 0, 100);
const num = v => { if (v == null || v === "") return null; const n = typeof v === "number" ? v : parseFloat(v); return isFinite(n) ? n : null; };
const fy = y => "c. " + AS.fmtYear(Math.round(y));
const CONF = { high:["Well attested", "var(--good)"], medium:["Reasonably sure", "var(--warn)"], contested:["Contested", "var(--bad)"] };

/* Development fallback, used only while data/techniques.js is still empty. Dates are approximate. */
const FIXTURE = { groups:[{ id:"glass", name:"Glass" }, { id:"ceramic", name:"Ceramics" }, { id:"metal", name:"Metalwork" }, { id:"media", name:"Paper, print & paint" }, { id:"motif", name:"Animals & motifs" }],
  techniques:[
  { id:"core-glass", name:"Core-formed glass", group:"glass", origin:{ place:"Northern Mesopotamia", lat:36.3, lon:43.1, year:-1550, region:"wan" },
    arrivals:[{ place:"Egypt (Amarna)", lat:27.6, lon:30.9, year:-1450, region:"egy", note:"Royal workshops" }, { place:"Aegean (Rhodes)", lat:36.2, lon:28.0, year:-550, region:"eur_s", note:"Mediterranean core-formed bottles" }],
    end:{ year:-30, note:"Displaced by blowing" }, rule:"Small, thick, opaque vessel with trailed zigzags ⇒ core-formed, c. 1550–50 BCE", lookFor:"Dark opaque body, combed festoons of yellow and white, rough interior. Never thin or transparent.", blurb:"Hot glass was wound round a clay core that was later scraped out. Slow, small, luxurious.", confidence:"high", sources:["https://www.cmog.org/"] },
  { id:"glassblowing", name:"Glassblowing", group:"glass", origin:{ place:"Syro-Palestinian coast", lat:33.5, lon:35.5, year:-50, region:"wan" },
    arrivals:[{ place:"Italy (Rome)", lat:41.9, lon:12.5, year:-20, region:"eur_s", note:"Workshops follow the market" }, { place:"Egypt (Alexandria)", lat:31.2, lon:29.9, year:20, region:"egy" }, { place:"Rhineland (Cologne)", lat:50.9, lon:6.96, year:50, region:"eur_nw", note:"Roman frontier glasshouses" }, { place:"China (Luoyang)", lat:34.6, lon:112.4, year:450, region:"eas", note:"Northern Wei, via the Silk Road" }, { place:"Japan (Nara)", lat:34.7, lon:135.8, year:700, region:"eas" }, { place:"Mexico (Puebla)", lat:19.0, lon:-98.2, year:1542, region:"mes", note:"First glasshouse in the Americas" }],
    end:null, rule:"Blown glass ⇒ not before c. 50 BCE", lookFor:"Thin, even walls; a pontil scar under the base; bubbles stretched round the body. Earlier glass is cast or core-formed: thick and small.", blurb:"A blowpipe turned glass from a jewel into tableware within two generations.", confidence:"high", sources:["https://www.cmog.org/"] },
  { id:"cristallo", name:"Cristallo (colourless Venetian glass)", group:"glass", origin:{ place:"Venice (Murano)", lat:45.46, lon:12.35, year:1450, region:"eur_s" },
    arrivals:[{ place:"Antwerp", lat:51.2, lon:4.4, year:1540, region:"eur_nw", note:"Façon de Venise" }, { place:"London", lat:51.5, lon:-0.1, year:1570, region:"eur_nw" }], end:null,
    rule:"Water-clear, paper-thin stemware ⇒ after c. 1450", lookFor:"Colourless, slightly grey metal; elaborate pincered stems.", blurb:"Purified plant ash gave Murano a glass as clear as rock crystal.", confidence:"medium", sources:[] },
  { id:"wheel", name:"Potter's wheel", group:"ceramic", origin:{ place:"Mesopotamia (Ur)", lat:30.96, lon:46.1, year:-3500, region:"wan" },
    arrivals:[{ place:"China (Longshan)", lat:36.7, lon:117.5, year:-2800, region:"eas", independent:true }, { place:"Indus valley", lat:27.3, lon:68.1, year:-2600, region:"sas" }, { place:"Egypt (Memphis)", lat:29.85, lon:31.25, year:-2500, region:"egy" }, { place:"Crete", lat:35.3, lon:25.1, year:-1900, region:"eur_s" }, { place:"Mexico", lat:19.4, lon:-99.1, year:1530, region:"mes", note:"Introduced by Spanish potters" }],
    end:null, rule:"Wheel-thrown pot in the Americas ⇒ after 1500", lookFor:"Concentric throwing rings, perfect rotational symmetry. Coil-built pots are subtly uneven.", blurb:"The fast wheel never reached the pre-Columbian Americas or most of sub-Saharan Africa.", confidence:"medium", sources:[] },
  { id:"tin-glaze", name:"Tin-glazed earthenware", group:"ceramic", origin:{ place:"Iraq (Basra)", lat:30.5, lon:47.8, year:800, region:"wan" },
    arrivals:[{ place:"Egypt (Fustat)", lat:30.0, lon:31.2, year:950, region:"egy" }, { place:"Spain (Málaga)", lat:36.7, lon:-4.4, year:1100, region:"eur_s" }, { place:"Italy (Florence)", lat:43.8, lon:11.25, year:1350, region:"eur_s", note:"Maiolica" }, { place:"Netherlands (Delft)", lat:52.0, lon:4.36, year:1560, region:"eur_nw" }, { place:"Mexico (Puebla)", lat:19.0, lon:-98.2, year:1580, region:"mes", note:"Talavera" }],
    end:null, rule:"Opaque white glaze on earthenware ⇒ after c. 800; in Italy after c. 1350", lookFor:"Chalky white surface that chips to reveal a buff or red body.", blurb:"Abbasid potters faked Chinese whiteware with tin; the trick walked west for 800 years.", confidence:"high", sources:[] },
  { id:"lustre", name:"Lustreware", group:"ceramic", origin:{ place:"Iraq (Basra)", lat:30.5, lon:47.8, year:850, region:"wan" },
    arrivals:[{ place:"Egypt (Fustat)", lat:30.0, lon:31.2, year:975, region:"egy" }, { place:"Iran (Kashan)", lat:34.0, lon:51.4, year:1170, region:"wan" }, { place:"Spain (Málaga)", lat:36.7, lon:-4.4, year:1240, region:"eur_s" }, { place:"Italy (Deruta)", lat:43.0, lon:12.4, year:1500, region:"eur_s" }],
    end:null, rule:"Metallic sheen painted on glaze ⇒ after c. 850", lookFor:"Coppery or golden iridescence that shifts with the light.", blurb:"A second, smoky firing leaves a film of metal on the glaze.", confidence:"high", sources:[] },
  { id:"porcelain", name:"Porcelain", group:"ceramic", origin:{ place:"China (Xing & Ding kilns)", lat:38.0, lon:114.5, year:620, region:"eas" },
    arrivals:[{ place:"Korea (Goryeo)", lat:37.0, lon:127.0, year:950, region:"eas" }, { place:"Vietnam", lat:21.0, lon:105.8, year:1350, region:"sea" }, { place:"Japan (Arita)", lat:33.2, lon:129.9, year:1616, region:"eas" }, { place:"Saxony (Meissen)", lat:51.16, lon:13.47, year:1708, region:"eur_nw", note:"Böttger's hard paste" }, { place:"France (Sèvres)", lat:48.8, lon:2.2, year:1768, region:"eur_nw" }, { place:"United States", lat:39.95, lon:-75.2, year:1770, region:"nam" }],
    end:null, rule:"True porcelain made in Europe ⇒ after 1708", lookFor:"White, glassy, translucent at the rim, rings when tapped.", blurb:"China kept the secret for a thousand years. Europe imported, imitated and finally cracked it at Meissen.", confidence:"high", sources:[] },
  { id:"lost-wax", name:"Lost-wax casting", group:"metal", origin:{ place:"Mehrgarh, Baluchistan", lat:29.4, lon:67.6, year:-4000, region:"sas" },
    arrivals:[{ place:"Southern Levant", lat:31.5, lon:35.4, year:-3700, region:"wan" }, { place:"Egypt", lat:25.7, lon:32.6, year:-2600, region:"egy" }, { place:"Aegean", lat:37.9, lon:23.7, year:-2000, region:"eur_s" }, { place:"China (Chu)", lat:30.4, lon:112.2, year:-550, region:"eas" }, { place:"Colombia", lat:4.6, lon:-74.1, year:-200, region:"and", independent:true }, { place:"Nigeria (Igbo-Ukwu)", lat:6.0, lon:7.0, year:850, region:"ssa", independent:true }, { place:"West Mexico", lat:19.7, lon:-103.5, year:800, region:"mes", note:"By sea from the south" }],
    end:null, rule:"Cast metal in Mesoamerica ⇒ after c. 800 CE", lookFor:"Undercuts and fine wire-like detail no mould could release.", blurb:"Old in the Old World; arrived late and separately in the Americas and West Africa.", confidence:"medium", sources:[] },
  { id:"iron", name:"Iron smelting", group:"metal", origin:{ place:"Anatolia", lat:39.0, lon:34.0, year:-1200, region:"wan" },
    arrivals:[{ place:"Greece", lat:38.0, lon:23.7, year:-1050, region:"eur_s" }, { place:"Ganges plain", lat:25.4, lon:82.9, year:-1000, region:"sas", independent:true }, { place:"Central Europe (Hallstatt)", lat:47.6, lon:13.6, year:-800, region:"eur_nw" }, { place:"China", lat:34.3, lon:108.9, year:-600, region:"eas" }, { place:"Nigeria (Nok)", lat:9.5, lon:8.0, year:-500, region:"ssa", independent:true }],
    end:null, rule:"Iron object ⇒ after c. 1200 BCE (later almost everywhere)", lookFor:"Rust, not verdigris.", blurb:"Never smelted in the pre-Columbian Americas.", confidence:"contested", sources:[] },
  { id:"paper", name:"Paper", group:"media", origin:{ place:"China (Han)", lat:34.3, lon:108.9, year:-100, region:"eas" },
    arrivals:[{ place:"Korea", lat:37.5, lon:127.0, year:350, region:"eas" }, { place:"Japan", lat:34.7, lon:135.8, year:610, region:"eas" }, { place:"Samarkand", lat:39.65, lon:66.96, year:751, region:"cas", note:"After Talas, by tradition" }, { place:"Baghdad", lat:33.3, lon:44.4, year:794, region:"wan" }, { place:"Cairo", lat:30.0, lon:31.2, year:900, region:"egy" }, { place:"Spain (Xàtiva)", lat:38.99, lon:-0.52, year:1150, region:"eur_s" }, { place:"Italy (Fabriano)", lat:43.3, lon:12.9, year:1264, region:"eur_s" }, { place:"Nuremberg", lat:49.45, lon:11.08, year:1390, region:"eur_nw" }, { place:"Mexico", lat:19.4, lon:-99.1, year:1575, region:"mes" }, { place:"Philadelphia", lat:39.95, lon:-75.2, year:1690, region:"nam" }],
    end:null, rule:"Paper in Europe ⇒ after c. 1150; before that it is parchment", lookFor:"Laid lines and, from c. 1280, watermarks when held to light.", blurb:"A thousand years from Chang'an to Córdoba, one mill at a time.", confidence:"high", sources:[] },
  { id:"woodblock", name:"Woodblock printing", group:"media", origin:{ place:"China (Tang)", lat:34.3, lon:108.9, year:700, region:"eas" },
    arrivals:[{ place:"Korea", lat:35.8, lon:129.2, year:750, region:"eas" }, { place:"Japan (Nara)", lat:34.7, lon:135.8, year:770, region:"eas" }, { place:"Southern Germany", lat:48.4, lon:10.9, year:1400, region:"eur_nw", independent:true }],
    end:null, rule:"Printed image ⇒ after c. 700 in East Asia, after c. 1400 in Europe", lookFor:"Even black line with no brush modulation; block edges; identical impressions.", blurb:"Seven centuries of head start for East Asia.", confidence:"medium", sources:[] },
  { id:"oil", name:"Oil painting", group:"media", origin:{ place:"Flanders (Bruges)", lat:51.2, lon:3.2, year:1420, region:"eur_nw" },
    arrivals:[{ place:"Venice", lat:45.44, lon:12.33, year:1475, region:"eur_s" }, { place:"Mexico City", lat:19.4, lon:-99.1, year:1550, region:"mes" }, { place:"Cusco", lat:-13.5, lon:-72.0, year:1580, region:"and" }, { place:"Canton", lat:23.1, lon:113.3, year:1750, region:"eas", note:"Export painting" }],
    end:null, rule:"Glazed, blended oil surface ⇒ after c. 1420", lookFor:"Soft transitions, deep translucent shadows, craquelure. Tempera is matt and hatched.", blurb:"Slow-drying oil let painters blend. Canvas followed within a century.", confidence:"high", sources:[] },
  { id:"horse", name:"Domestic horse", group:"motif", origin:{ place:"Pontic–Caspian steppe", lat:50.0, lon:55.0, year:-2200, region:"cas" },
    arrivals:[{ place:"Mesopotamia", lat:33.0, lon:44.4, year:-2000, region:"wan" }, { place:"Egypt", lat:30.0, lon:31.2, year:-1650, region:"egy", note:"With the Hyksos" }, { place:"Greece", lat:37.7, lon:22.75, year:-1700, region:"eur_s" }, { place:"China (Anyang)", lat:36.1, lon:114.3, year:-1250, region:"eas" }, { place:"West Africa (Sahel)", lat:14.0, lon:-3.0, year:800, region:"ssa" }, { place:"Hispaniola", lat:18.5, lon:-70.0, year:1493, region:"mes" }, { place:"Peru", lat:-12.0, lon:-77.0, year:1532, region:"and" }, { place:"Great Plains", lat:39.0, lon:-100.0, year:1680, region:"nam", note:"After the Pueblo Revolt" }, { place:"Australia", lat:-33.9, lon:151.2, year:1788, region:"oce" }],
    end:null, rule:"Horse in American art ⇒ after 1492", lookFor:"Riders, bridles, stirrups (stirrups: after c. 300 CE anywhere).", blurb:"The single most reliable terminus post quem for the Americas.", confidence:"high", sources:[] },
  { id:"photo", name:"Photography", group:"media", origin:{ place:"Paris", lat:48.86, lon:2.35, year:1839, region:"eur_nw" },
    arrivals:[{ place:"New York", lat:40.7, lon:-74.0, year:1839, region:"nam" }, { place:"Calcutta", lat:22.57, lon:88.36, year:1840, region:"sas" }, { place:"Nagasaki", lat:32.75, lon:129.87, year:1848, region:"eas" }],
    end:null, rule:"Photograph ⇒ after 1839. Final era, no exceptions", lookFor:"Continuous tone with no drawn line.", blurb:"The easiest date in the game.", confidence:"high", sources:[] }
] };

/* "A ⇒ x; B ⇒ y. C ⇒ z." → sentences → clauses (split on ; outside brackets) */
function splitRule(rule){ const out = []; let hadArrow = false; const push = c => { const arrow = c.includes("⇒"); out.push({ text:c, cont:!arrow && hadArrow }); hadArrow = hadArrow || arrow; };
  for (const sent of String(rule || "").trim().split(/(?<=[.!?])\s+(?=[A-Z"'“‘(])/)){ let depth = 0, cur = ""; hadArrow = false;
    for (const ch of sent){ if (ch === "(" || ch === "[") depth++; else if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
      if (ch === ";" && !depth){ if (cur.trim()) push(cur.trim()); cur = ""; } else cur += ch; }
    if (cur.trim()) push(cur.trim().replace(/\.$/, "")); }
  return out; }
const shortPlace = p => { const s = String(p).replace(/\s*\([^)]*\)/g, "").trim() || String(p); return s.length > 28 ? s.slice(0, 26).trim() + "…" : s; };
const shortGroup = n => (String(n).split(/[\s,&]+/)[0] || String(n));
function titleCase(s){ return String(s).replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }
function normPoint(p, fallback){ p = p || {}; const lat = num(p.lat), lon = num(p.lon); let region = typeof p.region === "string" && p.region ? p.region : null;
  if (!region && lat != null && lon != null) region = AS.regionOfPoint(lon, lat);
  return { place:p.place ? String(p.place) : fallback, lat, lon, year:num(p.year), region }; }
function load(){
  const raw = window.AS_DATA && window.AS_DATA.techniques; const build = src => {
    const groups = (Array.isArray(src.groups) ? src.groups : []).filter(g => g && g.id != null).map(g => ({ id:String(g.id), name:g.name ? String(g.name) : titleCase(g.id) }));
    const gset = new Map(groups.map(g => [g.id, g])), seen = new Set(), list = []; let skipped = 0;
    for (const t of (Array.isArray(src.techniques) ? src.techniques : [])){
      if (!t || t.id == null || seen.has(String(t.id))){ skipped++; continue; }
      const origin = normPoint(t.origin, "Unknown"); if (origin.year == null){ skipped++; continue; }
      const id = String(t.id); seen.add(id); const gid = t.group != null && t.group !== "" ? String(t.group) : "other";
      if (!gset.has(gid)){ const g = { id:gid, name:titleCase(gid) }; groups.push(g); gset.set(gid, g); }
      const arrivals = (Array.isArray(t.arrivals) ? t.arrivals : []).filter(Boolean).map(a => Object.assign(normPoint(a, "Unknown"), { note:a.note ? String(a.note) : "", independent:!!a.independent }))
        .filter(a => a.year != null).sort((a, b) => a.year - b.year);
      const ey = t.end && typeof t.end === "object" ? num(t.end.year) : num(t.end);
      const o = { id, name:t.name ? String(t.name) : titleCase(id), group:gid, origin, arrivals, end:ey != null ? { year:ey, note:(t.end && t.end.note) ? String(t.end.note) : "" } : null,
        rule:t.rule ? String(t.rule).trim() : "", lookFor:t.lookFor ? String(t.lookFor) : "", blurb:t.blurb ? String(t.blurb) : "",
        confidence:CONF[t.confidence] ? t.confidence : null, sources:(Array.isArray(t.sources) ? t.sources : t.sources ? [t.sources] : []).filter(s => typeof s === "string" && /^https?:\/\//.test(s) && !/metmuseum\.org/i.test(s)) };
      o.clauses = splitRule(o.rule); o.head = o.clauses.length ? o.clauses[0].text : "";
      o.hay = [o.name, gset.get(gid).name, o.rule, o.lookFor, o.origin.place, arrivals.map(a => a.place).join(" ")].join(" ").toLowerCase();
      list.push(o); }
    return { groups:groups.filter(g => list.some(t => t.group === g.id)), list, skipped }; };
  if (raw && typeof raw === "object"){ const d = build(raw); if (d.list.length) return Object.assign(d, { sample:false }); }
  return Object.assign(build(FIXTURE), { sample:true });
}

/* which earlier place did each arrival most plausibly come from? the origin, unless an earlier stop is clearly on the way */
function routeSources(t){ const stops = [], out = []; const ok = p => p.lat != null && p.lon != null; if (ok(t.origin)) stops.push(t.origin);
  for (const a of t.arrivals){ if (!ok(a)){ out.push(null); continue; }
    if (a.independent || !stops.length || a.year < t.origin.year){ out.push(null); stops.push(a); continue; }
    const d0 = ok(t.origin) ? AS.geo.havKm(t.origin.lon, t.origin.lat, a.lon, a.lat) : Infinity; let best = ok(t.origin) ? t.origin : null, bd = d0;
    for (const s of stops){ if (s === t.origin || s.year > a.year) continue; const d = AS.geo.havKm(s.lon, s.lat, a.lon, a.lat); if (d < d0 * .85 && d < bd){ bd = d; best = s; } }
    if (!best) best = stops[stops.length - 1];
    out.push(best); stops.push(a); }
  return out; }

/* an arc as 1 part, or 2 parts when its great circle crosses the antimeridian; each part has a share w of the length */
function arcParts(from, to){ const pts = AS.geo.arc(from[0], from[1], to[0], to[1], 48); let j = -1;
  for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i][0] - pts[i - 1][0]) > 180){ j = i; break; }
  if (j < 0) return [{ from, to, w:1 }];
  const a = pts[j - 1], b = pts[j], sa = a[0] > 0 ? 1 : -1, da = 180 - Math.abs(a[0]), db = 180 - Math.abs(b[0]), f = da / Math.max(1e-6, da + db), lat = a[1] + (b[1] - a[1]) * f, w = AS.clamp((j - 1 + f) / (pts.length - 1), .05, .95);
  return [{ from, to:[sa * 179.9, lat], w }, { from:[-sa * 179.9, lat], to, w:1 - w }]; }

function create(el, params){
  const { groups, list, sample, skipped } = load();
  const byId = new Map(list.map(t => [t.id, t])), gById = new Map(groups.map(g => [g.id, g])), gname = id => (gById.get(id) || { name:id }).name;
  const pins = new Set((AS.store.get("when.pins", []) || []).filter(id => byId.has(id)));
  const collapsed = new Set(AS.store.get("when.collapsed", []) || []);
  const S = { id:null, group:null, region:null, era:null, q:"", sort:"group", pinned:false, tab:null };
  const open = { around:false, notyet:false, gone:false, never:false };
  let rowEls = new Map(), order = [], map = null, mapHost = null, playRaf = 0, playing = false, searchT = 0, fitT = 0, dead = false, lastSideKey = "";

  function readParams(p){ p = p || {};
    S.id = p.id && byId.has(p.id) ? p.id : null; S.group = p.group && gById.has(p.group) ? p.group : null;
    S.region = p.region && AS.REGIONS.some(r => r.id === p.region) ? p.region : null;
    const e = parseInt(p.era, 10); S.era = (e >= 0 && e <= 19) ? e : null;
    S.q = p.q ? String(p.q) : ""; S.sort = p.sort === "date" ? "date" : "group"; S.pinned = p.pinned === "1" || p.pinned === "true";
    S.tab = (p.tab === "era" || p.tab === "tech") ? p.tab : null; }
  const defaultTab = () => (S.era != null && !S.id) ? "era" : "tech";
  const activeTab = () => S.tab || defaultTab();
  function sync(push){ AS.setParams({ id:S.id, group:S.group, region:S.region, era:S.era == null ? null : String(S.era), q:S.q, sort:S.sort === "date" ? "date" : null,
    pinned:S.pinned ? "1" : null, tab:(S.tab && S.tab !== defaultTab()) ? S.tab : null }, { replace:!push }); }

  /* ---------- model ---------- */
  function startOf(t){ if (!S.region) return t.origin.year; let b = t.origin.region === S.region ? t.origin.year : null;
    for (const a of t.arrivals) if (a.region === S.region && (b == null || a.year < b)) b = a.year; return b; }
  /* the end only applies if it comes after the start we are showing; later arrivals in a region are revivals with a life of their own */
  const endOf = (t, s) => (t.end && s != null && t.end.year >= s) ? t.end.year : null;
  function matches(t){ if (S.group && t.group !== S.group) return false; if (S.pinned && !pins.has(t.id)) return false;
    if (S.q){ for (const w of S.q.toLowerCase().split(/\s+/)) if (w && !t.hay.includes(w)) return false; } return true; }
  const cmp = (a, b) => (a.s == null) - (b.s == null) || (a.s == null ? 0 : a.s - b.s) || a.t.origin.year - b.t.origin.year || a.t.name.localeCompare(b.t.name);
  const visible = () => list.filter(matches).map(t => ({ t, s:startOf(t) }));

  /* ---------- skeleton ---------- */
  const lens = () => S.region ? AS.region(S.region) : null;
  const search = h("input.input.wh-search", { type:"search", placeholder:"Search techniques, places, rules", "aria-label":"Search techniques", spellcheck:"false",
    oninput(){ clearTimeout(searchT); searchT = setTimeout(() => { S.q = search.value.trim(); sync(); renderChart(); if (activeTab() === "era") renderSide(); }, 110); } });
  const sortSeg = AS.ui.seg([{ value:"group", label:"By kind", title:"Grouped by kind, earliest first" }, { value:"date", label:"By date", title:"One staircase of first appearances" }], "group",
    v => { S.sort = v; sync(); renderChart(); });
  const pinChip = h("button.chip.wh-pinchip", { type:"button", title:"Show only the rows you pinned", onclick(){ S.pinned = !S.pinned; sync(); paintControls(); renderChart(); if (activeTab() === "era") renderSide(); } });
  const drill = h("a.btn.sm.primary", { title:"Quiz yourself on what is showing" }, "Drill these");
  const groupChips = AS.ui.chips([{ value:null, label:"All", n:list.length }].concat(groups.map(g => ({ value:g.id, label:shortGroup(g.name), n:list.filter(t => t.group === g.id).length }))), null,
    v => { S.group = v; sync(); renderChart(); if (activeTab() === "era") renderSide(); }, { allowNone:false });
  const regionChips = AS.ui.chips([{ value:null, label:"World" }].concat(AS.REGIONS.map(r => ({ value:r.id, label:r.short, color:r.color }))), null,
    v => { S.region = v; sync(); renderChart(); renderSide(true); }, { allowNone:false });
  const top = h("div.topbar.wh-top", {},
    h("div.wh-title", {}, h("h2", {}, "When"), h("span.wh-sub", {}, h("b", {}, "Earliest possible."), " What existed when, and when it got there.")),
    h("div.grow"), search, sortSeg, pinChip, drill);
  const filters = h("div.wh-filters", {},
    h("div.wh-frow", {}, h("span.eyebrow", {}, "Kind"), groupChips),
    h("div.wh-frow", {}, h("span.eyebrow", { title:"Start each bar when the technique reached this region" }, "Seen from"), regionChips));

  /* chart */
  const corner = h("div.wh-corner");
  const ages = h("div.wh-ages", {}, AS.AGES.map(a => h("span", { style:{ gridColumn:`${a.from + 1} / ${a.to + 2}`, "--c":AS.eraColor(Math.round((a.from + a.to) / 2)) }, title:a.name }, a.name)));
  const eraCells = []; const eras = h("div.wh-eras");
  for (let i = 0; i < 20; i++){ const s = AS.eraStart(i);
    const c = h("button.wh-era", { type:"button", style:{ "--c":AS.eraColor(i) }, "aria-label":AS.eraLabel(i), onclick:() => setEra(S.era === i ? null : i),
      onmousemove:e => AS.tip.show(e, `<div class="t">${AS.eraLabel(i)}</div><div class="s">${esc(AS.ageOf(i).name)} · click to ask what existed</div>`), onmouseleave:AS.tip.hide },
      h("span.y", { html:`${s === 0 ? 1 : Math.abs(s)}<small>${s < 0 ? "BCE" : "CE"}</small>` }));
    eraCells.push(c); eras.append(c); }
  const head = h("div.wh-head", {}, corner, h("div.wh-axis", {}, ages, eras));
  const tint = h("div.wh-tint", { style:{ background:`linear-gradient(90deg,${AS.ERA_COLORS.map((c, i) => `${c} ${i * 5}% ${i * 5 + 5}%`).join(",")})` } });
  const cursor = h("div.wh-cursor");
  const rowsHost = h("div.wh-rows");
  const body = h("div.wh-body", {}, tint, cursor, rowsHost);
  const inner = h("div.wh-inner", {}, head, body);
  const chart = h("div.wh-chart", { style:{ "--wh-spec":`linear-gradient(90deg,${AS.ERA_COLORS.map((c, i) => `${c} ${i * 5 + 2.5}%`).join(",")})` }, tabindex:"-1" }, inner);
  const legend = h("div.wh-legend", {},
    h("span", {}, h("i.wh-lg-bar", { style:{ "--c1":AS.eraColor(3), "--c2":AS.eraColor(9) } }), "exists from here on"), h("span", {}, h("i.wh-mark.wh-lg"), "arrival, coloured by region"),
    h("span", {}, h("i.wh-mark.ind.wh-lg"), "independent invention"), h("span", {}, h("i.wh-lg-lead"), "elsewhere first"), h("span", {}, h("i.wh-lg-end"), "falls out of use"),
    h("span.wh-keys", {}, h("span.kbd", {}, "↑"), h("span.kbd", {}, "↓"), "row", h("span.kbd", {}, "←"), h("span.kbd", {}, "→"), "era", h("span.kbd", {}, "P"), "pin", h("span.kbd", {}, "/"), "search"));
  const side = h("div.side.wh-side");
  const stage = h("div.stage.wh-stage", {}, sample ? h("div.wh-sample", {}, h("b", {}, "Sample data."), " The researched dataset has not been packed yet — these rows are placeholders.") : null, chart, legend);
  el.append(top, filters, h("div.split.wh-split", {}, stage, side));

  /* ---------- chart ---------- */
  function paintControls(){ if (document.activeElement !== search) search.value = S.q; sortSeg.set(S.sort); groupChips.set(S.group); regionChips.set(S.region);
    pinChip.classList.toggle("on", S.pinned); pinChip.innerHTML = ""; pinChip.append(h("span.wh-star", {}, "★"), "Pinned", h("span.n", {}, String(pins.size)));
    drill.setAttribute("href", AS.href("practice", { mode:"when", group:S.group, region:S.region })); }

  const fadeA = AS.theme.light ? .64 : .5, fadeB = AS.theme.light ? .36 : .2;   /* bar tails fade toward the ground: keep more ink on paper */
  function rowEl(v){ const t = v.t, s = v.s, ghost = s == null, ee = endOf(t, ghost ? t.origin.year : s), e = ee == null ? Y1 : ee, on = pins.has(t.id);
    const row = h("div.wh-row" + (ghost ? ".ghost" : "") + (t.id === S.id ? ".sel" : ""), { data:{ id:t.id }, role:"button", "aria-label":t.name });
    row.append(h("div.wh-name", {}, h("button.wh-pin" + (on ? ".on" : ""), { type:"button", tabindex:"-1", "aria-label":on ? "Unpin" : "Pin", title:on ? "Unpin" : "Pin: keep forgetting this one" }, "★"),
      h("span.wh-nm", {}, t.name), S.sort === "date" ? h("span.wh-gtag", {}, shortGroup(gname(t.group))) : null));
    const tr = h("div.wh-track"); row.append(tr); const oy = t.origin.year;
    if (ghost){ const a = pct(oy), b = Math.max(a + .6, pct(e));
      tr.append(h("div.wh-gbar", { style:{ left:a + "%", width:(b - a) + "%" } }), h("span.wh-gnote" + (a > 55 ? ".l" : ""), { style:{ left:a + "%" } }, `not attested here · elsewhere from ${AS.fmtYear(oy)}`));
      return row; }
    const a = pct(s), b = Math.max(a + .5, pct(Math.max(e, s))), mid = Math.min(b, a + 13), c = AS.eraColor(AS.eraOf(s));
    const mask = `linear-gradient(90deg,transparent ${a}%,#000 ${a}%,rgba(0,0,0,${fadeA}) ${mid}%,rgba(0,0,0,${fadeB}) ${b}%,transparent ${b}%)`;
    tr.append(h("div.wh-bar", { style:{ maskImage:mask, webkitMaskImage:mask } }));
    if (S.region && oy < s){ const o = pct(oy); tr.append(h("div.wh-lead", { style:{ left:o + "%", width:(a - o) + "%" } }), h("i.wh-o", { style:{ left:o + "%" }, data:{ o:"1" } })); }
    if (ee != null && e < Y1) tr.append(h("i.wh-end", { style:{ left:b + "%" } }));
    tr.append(h("i.wh-cap", { style:{ left:a + "%", "--c":c } }));
    const early = s < Y0, txt = (early ? "◂ " : "") + AS.fmtYearShort(s);
    tr.append(h("span.wh-yl." + (a >= 7.5 ? "l" : "r") + (S.region && oy < s ? ".over" : ""), { style:{ left:a + "%", "--c":c } }, txt));
    t.arrivals.forEach((ar, i) => { if (ar.year < Y0 || ar.year > Y1) return; if (!S.region && ar.year === oy && !ar.independent) return;
      tr.append(h("i.wh-mark" + (ar.independent ? ".ind" : "") + (S.region && ar.region === S.region && ar.year === s ? ".here" : "") + (ar.year < s ? ".pre" : "") + (ee != null && ar.year > e ? ".post" : ""), { style:{ left:pct(ar.year) + "%", "--c":AS.regionColor(ar.region) }, data:{ a:String(i) } })); });
    return row; }

  function renderChart(){
    paintControls(); AS.tip.hide();
    const vis = visible(), L = lens(), att = vis.filter(v => v.s != null).length;
    corner.innerHTML = ""; corner.append(h("div.wh-count", {}, h("b", {}, String(att)), att === 1 ? " technique" : " techniques", vis.length > att ? h("span.faint", {}, ` · ${vis.length - att} not here`) : null),
      h("div.wh-lensline", {}, L ? ["as seen from ", h("span", { style:{ color:L.color } }, L.short)] : "first appearance anywhere"));
    rowsHost.innerHTML = ""; rowEls = new Map(); order = [];
    const frag = document.createDocumentFragment();
    const addRows = vs => { for (const v of vs){ const r = rowEl(v); rowEls.set(v.t.id, r); order.push(v.t.id); frag.append(r); } };
    if (!vis.length){
      frag.append(h("div.wh-none", {}, h("h3", {}, S.pinned && !pins.size ? "Nothing pinned yet" : "Nothing matches"),
        h("p", {}, S.pinned && !pins.size ? "Star a row to keep it here. Useful for the ones you keep getting wrong." : "No technique fits that search and filter. Loosen something."),
        h("button.btn.sm", { type:"button", onclick(){ S.q = ""; S.group = null; S.pinned = false; search.value = ""; sync(); renderChart(); if (activeTab() === "era") renderSide(); } }, "Clear filters")));
    } else if (S.sort === "date"){
      const s = vis.slice().sort(cmp), a = s.filter(v => v.s != null), g = s.filter(v => v.s == null); addRows(a);
      if (g.length){ frag.append(h("div.wh-ghead.static", {}, h("div.wh-gname", {}, h("span", {}, `Not attested in ${L ? L.name : "this region"}`), h("span.wh-gn", {}, String(g.length))))); addRows(g); }
    } else for (const g of groups){ const rs = vis.filter(v => v.t.group === g.id).sort(cmp); if (!rs.length) continue;
      const shut = collapsed.has(g.id) && !S.q, a = rs.filter(v => v.s != null), first = a.length ? a[0].s : null, last = a.length ? a[a.length - 1].s : null;
      frag.append(h("div.wh-ghead" + (shut ? ".shut" : ""), { data:{ g:g.id }, role:"button", "aria-expanded":shut ? "false" : "true" },
        h("div.wh-gname", {}, h("span.wh-caret", {}, "▾"), h("span", {}, g.name), h("span.wh-gn", {}, String(a.length)),
          h("span.wh-gsum", {}, first == null ? "none here" : (a.length > 1 ? `${AS.fmtYearShort(first)} → ${AS.fmtYearShort(last)}` : AS.fmtYearShort(first)) + (rs.length > a.length ? ` · ${rs.length - a.length} not here` : "")))));
      if (!shut) addRows(rs); }
    rowsHost.append(frag); paintCursor();
  }
  function paintSel(scroll){ for (const [id, r] of rowEls) r.classList.toggle("sel", id === S.id);
    if (scroll && S.id && rowEls.has(S.id)) rowEls.get(S.id).scrollIntoView({ block:"nearest", inline:"nearest" }); }
  function paintCursor(){ eraCells.forEach((c, i) => c.classList.toggle("on", S.era === i));
    if (S.era == null) cursor.style.display = "none"; else { cursor.style.display = ""; cursor.style.setProperty("--i", S.era); cursor.style.setProperty("--c", AS.eraColor(S.era)); } }

  function rowTip(t){ const s = startOf(t), L = lens();
    const when = s == null ? `not attested in ${esc(L.short)}` : (L ? `in ${esc(L.short)} from ${fy(s)}` : `from ${fy(s)} · ${esc(t.origin.place)}`);
    return `<div class="t">${esc(t.name)}</div><div class="s">${esc(gname(t.group))} · ${when}</div>${t.head ? `<div style="margin-top:7px;color:var(--gold-2)">${esc(t.head)}</div>` : ""}`; }
  rowsHost.addEventListener("click", e => { const pin = e.target.closest(".wh-pin"), gh = e.target.closest(".wh-ghead"), row = e.target.closest(".wh-row");
    if (pin && row){ togglePin(row.dataset.id); return; }
    if (gh && gh.dataset.g){ const g = gh.dataset.g; collapsed.has(g) ? collapsed.delete(g) : collapsed.add(g); AS.store.set("when.collapsed", [...collapsed]); renderChart(); return; }
    if (row) select(row.dataset.id === S.id ? null : row.dataset.id, true); });
  rowsHost.addEventListener("mousemove", e => { const row = e.target.closest(".wh-row"); if (!row || e.target.closest(".wh-pin")){ AS.tip.hide(); return; } const t = byId.get(row.dataset.id); if (!t) return;
    const m = e.target.closest(".wh-mark"), o = e.target.closest(".wh-o");
    if (m && m.dataset.a != null){ const a = t.arrivals[+m.dataset.a]; AS.tip.show(e, `<div class="t">${esc(a.place)}</div><div class="s">${esc(t.name)} · ${fy(a.year)} · ${esc(AS.region(a.region).short)}${a.independent ? " · independent invention" : ""}</div>${a.note ? `<div style="margin-top:6px">${esc(a.note)}</div>` : ""}`); }
    else if (o) AS.tip.show(e, `<div class="t">${esc(t.origin.place)}</div><div class="s">${esc(t.name)} began here · ${fy(t.origin.year)}</div>`);
    else AS.tip.show(e, rowTip(t)); });
  rowsHost.addEventListener("mouseleave", AS.tip.hide);

  /* ---------- actions ---------- */
  function select(id, push){ S.id = id && byId.has(id) ? id : null; S.tab = S.id ? "tech" : null; sync(push && !!S.id); paintSel(true); renderSide(); }
  function setEra(i){ S.era = i; S.tab = i != null ? "era" : null; sync(); paintCursor(); renderSide();
    if (i != null){ const c = eraCells[i], r = chart.getBoundingClientRect(), b = c.getBoundingClientRect(), nw = corner.offsetWidth;
      if (b.left < r.left + nw) chart.scrollLeft -= r.left + nw - b.left + 8; else if (b.right > r.right) chart.scrollLeft += b.right - r.right + 8; } }
  function togglePin(id){ pins.has(id) ? pins.delete(id) : pins.add(id); AS.store.set("when.pins", [...pins]);
    if (S.pinned) renderChart(); else { paintControls(); const r = rowEls.get(id), b = r && r.querySelector(".wh-pin"); if (b) b.classList.toggle("on", pins.has(id)); }
    const d = side.querySelector(".wh-dpin"); if (d && S.id === id){ d.classList.toggle("on", pins.has(id)); d.lastChild.textContent = pins.has(id) ? "Pinned" : "Pin"; } }
  function move(d){ if (!order.length) return; let i = order.indexOf(S.id); i = i < 0 ? (d > 0 ? 0 : order.length - 1) : AS.clamp(i + d, 0, order.length - 1); if (order[i] !== S.id) select(order[i], false); }

  /* ---------- side: technique ---------- */
  function clauseNode(tag, cl){ const c = cl.text, i = c.indexOf("⇒"); if (i < 0) return h(tag + (cl.cont ? ".cont" : ""), {}, h(cl.cont ? "span.wh-then" : "span.wh-plain", {}, c));
    return h(tag, {}, h("span.wh-if", {}, c.slice(0, i).trim()), h("span.wh-arrow", {}, " ⇒ "), h("span.wh-then", {}, c.slice(i + 1).trim())); }
  function ruleNode(t){ const cl = t.clauses.length ? t.clauses : [{ text:`${t.name} ⇒ not before ${fy(t.origin.year)}` }];
    const box = h("div.wh-rulebox", {}, clauseNode("p.wh-rule" + (cl[0].text.length > 130 ? ".xlong" : cl[0].text.length > 64 ? ".long" : ""), cl[0]));
    if (cl.length > 1) box.append(h("ul.wh-also", {}, cl.slice(1).map(c => clauseNode("li", c)))); return box; }
  function techChip(t, dir){ return h("button.wh-step", { type:"button", onclick:() => select(t.id, true), title:t.head || t.name }, dir < 0 ? h("span.wh-sa", {}, "←") : null, h("span.wh-sn", {}, t.name), h("span.wh-sy", { style:{ color:`color-mix(in srgb,${AS.eraColor(AS.eraOf(t.origin.year))} 65%,var(--mix))` } }, AS.fmtYearShort(t.origin.year)), dir > 0 ? h("span.wh-sa", {}, "→") : null); }

  function ensureMap(){ if (map) return; mapHost = h("div.wh-map"); map = AS.createMap(mapHost, { year:AS.MODERN_MAP, mode:"quiet", controls:true }); }
  let spread = null; /* { t, pts, src, years } for the technique on the map */
  function drawSpread(p){ if (!map || !spread) return; const { t, pts, src, years, parts } = spread, n = pts.length, full = p >= n, k = Math.floor(Math.min(p, n));
    const mk = [], arcs = [], oc = AS.regionColor(t.origin.region);
    if (t.origin.lat != null && t.origin.lon != null) mk.push({ id:"o", lon:t.origin.lon, lat:t.origin.lat, r:7.5, color:oc, glow:AS.theme.id === "night", pulse:true, label:`${shortPlace(t.origin.place)} · ${AS.fmtYearShort(t.origin.year)}`, labelAlways:true, priority:1e6, fixed:true,
      tip:`<div class="t">${esc(t.origin.place)}</div><div class="s">origin · ${fy(t.origin.year)}</div>` });
    pts.forEach((a, i) => { const c = AS.regionColor(a.region), tt = AS.clamp(p - i, 0, 1), here = S.region && a.region === S.region;
      if (src[i] && tt > 0){ let acc = 0; for (const part of parts[i]){ const u = AS.clamp((tt - acc) / part.w, 0, 1); acc += part.w; if (u > 0) arcs.push({ from:part.from, to:part.to, color:c, width:here ? 2.6 : 1.7, t:u }); } }
      if (i < k || full || (!src[i] && p >= i)) mk.push({ id:"a" + i, lon:a.lon, lat:a.lat, r:a.independent ? 5.5 : 5, color:c, shape:a.independent ? "diamond" : "circle", selected:!!here, fixed:true,
        label:`${shortPlace(a.place)} · ${AS.fmtYearShort(a.year)}`, priority:(here ? 1e5 : 0) + (a.independent ? 500 : 0) + 100 - i,
        tip:`<div class="t">${esc(a.place)}</div><div class="s">${fy(a.year)} · ${esc(AS.region(a.region).short)}${a.independent ? " · independent invention" : ""}</div>${a.note ? `<div style="margin-top:6px">${esc(a.note)}</div>` : ""}` }); });
    map.setArcs(arcs); const sig = mk.map(m => m.id).join(","); if (sig !== spread.sig){ spread.sig = sig; map.setMarkers(mk); }
    const y = full ? years[n] : years[k] + (years[k + 1] - years[k]) * (p - k), key = AS.ERA2MAP[AS.eraOf(spread.rest ? t.origin.year : y)];
    if (key !== spread.base){ spread.base = key; map.setBase({ year:key }); }
    const yr = side.querySelector(".wh-myear"), bd = side.querySelector(".wh-mborders");
    if (yr) yr.textContent = spread.rest ? (n ? `${AS.fmtYearShort(Math.min(years[0], ...pts.map(a => a.year)))} → ${AS.fmtYear(Math.max(...years))}` : AS.fmtYear(years[0])) : AS.fmtYear(Math.round(y));
    if (bd) bd.textContent = "borders c. " + AS.mapKeyLabel(key); }
  function stopPlay(){ if (playRaf) cancelAnimationFrame(playRaf); playRaf = 0; playing = false; const b = side.querySelector(".wh-play"); if (b){ b.textContent = "▶"; b.classList.remove("on"); } }
  function startPlay(){ if (!spread || !spread.pts.length) return; stopPlay(); spread.rest = false;
    if (AS.still){ drawSpread(spread.pts.length); return; }
    const n = spread.pts.length, per = Math.min(900, 11000 / n), t0 = performance.now(); playing = true; const b = side.querySelector(".wh-play"); if (b){ b.textContent = "❚❚"; b.classList.add("on"); }
    const step = () => { if (dead || !playing) return; const p = Math.min(n, (performance.now() - t0) / per); drawSpread(p); if (p >= n){ stopPlay(); return; } playRaf = requestAnimationFrame(step); };
    drawSpread(0); playRaf = requestAnimationFrame(step); }
  function fitSpread(ms){ if (!map || !spread || !map.el.clientWidth) return; const t = spread.t, P = spread.pts.map(a => [a.lon, a.lat]); if (t.origin.lat != null && t.origin.lon != null) P.push([t.origin.lon, t.origin.lat]);
    if (P.length > 1) map.fit(P, { pad:44, maxZoom:5, ms }); else if (P.length) map.flyTo(P[0][0], P[0][1], 2.4, ms); else map.reset(ms); }

  function techPanel(t){ const L = lens(), s = startOf(t), on = pins.has(t.id), cf = CONF[t.confidence];
    const w = h("div.wh-detail");
    w.append(h("div.wh-dhead", {}, h("div.wh-dtitle", {}, h("div.eyebrow", {}, gname(t.group)), h("h3", {}, t.name)),
      h("button.btn.sm.wh-dpin" + (on ? ".on" : ""), { type:"button", onclick:() => togglePin(t.id), title:"Pin (P)" }, h("span.wh-star", {}, "★"), on ? "Pinned" : "Pin")));
    const card = h("div.wh-rulecard", {}, ruleNode(t));
    if (L){ card.append(h("div.wh-lensrule", { style:{ "--c":L.color } }, AS.ui.regionTag(L.id),
      s == null ? h("span", {}, "Not attested here in this dataset.") : h("span", {}, "not before c. ", h("b", {}, AS.fmtYear(s)), s > t.origin.year ? h("span.muted", {}, ` · ${AS.fmtN(s - t.origin.year)} years after ${t.origin.place}`) : h("span.muted", {}, " · it began here")))); }
    w.append(card);
    const meta = h("div.wh-meta", {}, AS.ui.yearChip(t.origin.year), AS.ui.regionTag(t.origin.region), cf ? h("span.tag.plain", { style:{ "--c":cf[1] }, title:"How firm the date is" }, cf[0]) : null,
      t.end ? h("span.wh-until", {}, "until ", AS.ui.yearChip(t.end.year)) : null);
    w.append(meta);
    if (t.lookFor) w.append(h("div.wh-look", {}, h("div.eyebrow", {}, "Look for"), h("p", {}, t.lookFor)));
    if (t.blurb) w.append(h("p.wh-blurb", {}, t.blurb));
    /* map */
    ensureMap(); const pts = [], src = [], rs = routeSources(t); t.arrivals.forEach((a, i) => { if (a.lat != null && a.lon != null){ pts.push(a); src.push(rs[i]); } });
    spread = { t, pts, src, parts:pts.map((a, i) => src[i] ? arcParts([src[i].lon, src[i].lat], [a.lon, a.lat]) : null), years:[t.origin.year].concat(pts.map(a => Math.max(a.year, t.origin.year))), sig:null, base:null, rest:true };
    const playBtn = h("button.wh-play", { type:"button", title:"Play the spread in date order (space)", "aria-label":"Play spread", onclick:() => playing ? (stopPlay(), spread.rest = true, drawSpread(spread.pts.length)) : startPlay() }, "▶");
    w.append(h("div.wh-mapwrap", {}, mapHost,
      h("div.map-overlay.tl", {}, h("div.glass.wh-mctl", {}, pts.length ? playBtn : null, h("span.wh-myear.mono"))),
      h("div.map-overlay.bl", {}, h("span.wh-mborders.mono"))));
    /* spread list */
    w.append(h("div.section-title", {}, h("h4", {}, "Spread"), h("span.faint.mono.wh-small", {}, t.arrivals.length ? `${t.arrivals.length} arrival${t.arrivals.length > 1 ? "s" : ""}` : "stayed put")));
    const ol = h("ol.wh-spread"); const stop = (p, kind, i) => h("li.wh-sp" + (kind === "origin" ? ".origin" : "") + (p.independent ? ".ind" : "") + (L && p.region === L.id ? ".here" : ""), { style:{ "--c":AS.regionColor(p.region) },
      onclick:() => { if (map && p.lat != null && p.lon != null) map.flyTo(p.lon, p.lat, Math.max(2.6, map.zoom), AS.still ? 0 : 500); } },
      h("span.wh-spy", {}, AS.ui.yearChip(p.year)),
      h("div.wh-spb", {}, h("div.wh-spl", {}, h("b", {}, p.place), AS.ui.regionTag(p.region), kind === "origin" ? h("span.wh-kind", {}, "origin") : p.independent ? h("span.wh-kind.ind", {}, "independent") : (p.year < t.origin.year ? h("span.wh-kind", {}, "precursor") : (t.end && p.year > t.end.year ? h("span.wh-kind", {}, "revival") : null))),
        p.note ? h("div.wh-spn", {}, p.note) : null));
    ol.append(stop(t.origin, "origin")); t.arrivals.forEach((a, i) => ol.append(stop(a, "arrival", i)));
    if (t.end) ol.append(h("li.wh-sp.end", {}, h("span.wh-spy", {}, AS.ui.yearChip(t.end.year)), h("div.wh-spb", {}, h("div.wh-spl", {}, h("b", {}, "Falls out of use")), t.end.note ? h("div.wh-spn", {}, t.end.note) : null)));
    w.append(ol);
    /* chain */
    const fam = list.filter(x => x.group === t.group).sort((a, b) => a.origin.year - b.origin.year || a.name.localeCompare(b.name)), ix = fam.indexOf(t);
    const before = fam.slice(Math.max(0, ix - 2), ix), after = fam.slice(ix + 1, ix + 3);
    if (before.length || after.length){ w.append(h("div.wh-chain", {},
      h("div.wh-chcol", {}, h("div.eyebrow", {}, "Before that"), before.length ? before.reverse().map(x => techChip(x, -1)) : h("span.faint.wh-small", {}, `Nothing earlier in ${gname(t.group)}.`)),
      h("div.wh-chcol", {}, h("div.eyebrow", {}, "Then what?"), after.length ? after.map(x => techChip(x, 1)) : h("span.faint.wh-small", {}, "Nothing later. End of the line.")))); }
    const foot = h("div.wh-foot", {}, h("a.btn.sm", { href:AS.href("practice", { mode:"when", group:t.group, region:S.region }) }, `Drill ${gname(t.group)}`));
    if (t.sources.length){ const sl = h("div.wh-sources", {}, h("span.faint", {}, "Sources"));
      t.sources.forEach(u => { let host = u; try { const U = new URL(u); host = U.hostname.replace(/^www\./, ""); const m = /wikipedia\.org$/.test(host) && U.pathname.match(/\/wiki\/(.+)$/); if (m) host = decodeURIComponent(m[1]).replace(/_/g, " "); } catch(e){} sl.append(h("a", { href:u, target:"_blank", rel:"noopener noreferrer", title:u }, host)); }); foot.append(sl); }
    w.append(foot);
    return w; }

  function techEmpty(){ const picks = pins.size ? list.filter(t => pins.has(t.id)).slice(0, 8) : (() => { const s = list.slice().sort((a, b) => a.origin.year - b.origin.year), out = [], n = Math.min(6, s.length); for (let i = 0; i < n; i++) out.push(s[Math.round(i * (s.length - 1) / Math.max(1, n - 1))]); return [...new Set(out)]; })();
    const arr = list.reduce((n, t) => n + t.arrivals.length, 0);
    return h("div.wh-empty", {},
      h("div.eyebrow", {}, "Terminus post quem"), h("h3", {}, "Every row is a floor under the date."),
      h("p.muted", {}, "If the object uses it, the object cannot be older than the bar's left edge. Stack a few and the era usually falls out."),
      h("div.wh-stats", {}, h("div.stat", {}, h("b", {}, String(list.length)), h("span", {}, "techniques")), h("div.stat", {}, h("b", {}, String(arr)), h("span", {}, "dated arrivals")), h("div.stat", {}, h("b", {}, String(groups.length)), h("span", {}, "kinds"))),
      h("ul.wh-how", {}, h("li", {}, h("b", {}, "Click a row"), " for its rule, what to look for, and the map of how it spread."),
        h("li", {}, h("b", {}, "Click an era"), " in the header to list what was new, what was around, and what was still impossible."),
        h("li", {}, h("b", {}, "Pick a region"), " under “Seen from” to restart every bar when the technique got there.")),
      h("div.eyebrow.wh-mt", {}, pins.size ? "Your pinned" : "Start somewhere"), h("div.wh-picks", {}, picks.map(t => techChip(t, 0)))); }

  /* ---------- side: era ---------- */
  function eraSets(i){ const a = AS.eraStart(i), b = AS.eraEnd(i), o = { fresh:[], around:[], notyet:[], gone:[], never:[] };
    for (const v of visible()){ const { t, s } = v; if (s == null){ o.never.push(v); continue; }
      const e = endOf(t, s); if (s >= b) o.notyet.push(v); else if (e != null && e < a) o.gone.push(v); else if (s >= a) o.fresh.push(v); else o.around.push(v); }
    o.fresh.sort(cmp); o.notyet.sort(cmp); o.around.sort((x, y) => y.s - x.s); o.gone.sort((x, y) => y.t.end.year - x.t.end.year); o.never.sort((x, y) => x.t.origin.year - y.t.origin.year); return o; }
  function strip(){ const st = h("div.wh-strip"); for (let i = 0; i < 20; i++) st.append(h("button" + (S.era === i ? ".on" : ""), { type:"button", style:{ "--c":AS.eraColor(i) }, title:AS.eraLabel(i), "aria-label":AS.eraLabel(i), onclick:() => setEra(i) })); return st; }
  function eraPanel(){ const i = S.era, L = lens();
    if (i == null) return h("div.wh-empty", {}, h("div.eyebrow", {}, "Era cursor"), h("h3", {}, "Pick 250 years."), h("p.muted", {}, "Then see what an object from that window could, and could not, be made with."), strip(),
      h("p.faint.wh-small", {}, "Or press ", h("span.kbd", {}, "←"), " ", h("span.kbd", {}, "→"), " anywhere."));
    const o = eraSets(i), c = AS.eraColor(i), w = h("div.wh-era-panel", { style:{ "--c":c } });
    w.append(h("div.wh-ehead", {}, h("button.btn.icon.ghost", { type:"button", "aria-label":"Earlier era", disabled:i === 0, onclick:() => setEra(i - 1) }, "‹"),
      h("div.wh-etitle", {}, h("div.eyebrow", {}, AS.ageOf(i).name), h("h3", {}, AS.eraLabel(i)), h("div.wh-ewhere", {}, L ? ["in ", AS.ui.regionTag(L.id)] : "anywhere in the world")),
      h("button.btn.icon.ghost", { type:"button", "aria-label":"Later era", disabled:i === 19, onclick:() => setEra(i + 1) }, "›")), strip());
    w.append(h("div.wh-tiles", {}, h("div.wh-tile.new", {}, h("b", {}, String(o.fresh.length)), h("span", {}, "new")), h("div.wh-tile.ok", {}, h("b", {}, String(o.around.length)), h("span", {}, "already around")),
      h("div.wh-tile.no", {}, h("b", {}, String(o.notyet.length)), h("span", {}, "not yet"))));
    const item = (v, meta) => h("button.wh-li" + (v.t.id === S.id ? ".on" : ""), { type:"button", title:v.t.head || v.t.name, onclick:() => select(v.t.id, true) }, h("span.wh-lin", {}, v.t.name), h("span.wh-lim", {}, meta));
    const sec = (key, cls, title, sub, items, meta, limit, emptyText) => { const s = h("section.wh-sec." + cls); const collapsible = limit != null && items.length > limit, isOpen = open[key];
      s.append(h("div.wh-sech", {}, h("h4", {}, title, h("span.wh-secn", {}, String(items.length))), sub ? h("span.wh-secs", {}, sub) : null));
      if (!items.length){ s.append(h("div.wh-secempty", {}, emptyText)); return s; }
      const show = collapsible && !isOpen ? items.slice(0, limit) : items; const box = h("div.wh-lis", {}, show.map(v => item(v, meta(v)))); s.append(box);
      if (collapsible) s.append(h("button.wh-more", { type:"button", onclick(){ open[key] = !open[key]; renderSide(true); } }, isOpen ? "Show fewer" : (limit === 0 ? `Show all ${items.length}` : `Show ${items.length - limit} more`)));
      return s; };
    const gap = s => { const d = AS.eraOf(s) - i; return d <= 1 ? "next era" : `${d} eras on`; };
    w.append(sec("fresh", "new", "New in this era", "first appears in these 250 years", o.fresh, v => AS.ui.yearChip(v.s), null, "Nothing new. A quiet quarter-millennium."));
    w.append(sec("notyet", "no", "Not yet", "see one of these and the object is later", o.notyet, v => [h("span.wh-gap", {}, gap(v.s)), AS.ui.yearChip(v.s)], 8, i === 19 ? "Everything has arrived." : "Nothing left to wait for."));
    w.append(sec("around", "ok", "Already around", "proves nothing, rules nothing out", o.around, v => [h("span.wh-gap", {}, "since"), AS.ui.yearChip(v.s)], o.around.length > 10 ? 0 : null, "Nothing yet. Early days."));
    if (o.gone.length) w.append(sec("gone", "gone", "Out of use by now", "an upper bound for once", o.gone, v => [h("span.wh-gap", {}, "until"), AS.ui.yearChip(v.t.end.year)], 4, ""));
    if (o.never.length) w.append(sec("never", "gone", `Never attested in ${L ? L.short : "this region"}`, "in this dataset", o.never, v => [h("span.wh-gap", {}, "elsewhere"), AS.ui.yearChip(v.t.origin.year)], 0, ""));
    if (S.q || S.group || S.pinned) w.append(h("p.faint.wh-small.wh-mt", {}, "Counting only what the filters above are showing."));
    return w; }

  function renderSide(keepScroll){ stopPlay(); clearTimeout(fitT); AS.tip.hide(); const tab = activeTab(), t = S.id ? byId.get(S.id) : null; const st = side.scrollTop; side.innerHTML = "";
    const tabs = AS.ui.seg([{ value:"tech", label:"Technique" }, { value:"era", label:S.era != null ? "Era · " + AS.eraLabel(S.era) : "Era" }], tab, v => { S.tab = v; sync(); renderSide(); });
    side.append(h("div.wh-tabs", {}, tabs));
    if (tab === "era"){ spread = null; side.append(eraPanel()); }
    else if (t){ side.append(techPanel(t)); drawSpread(spread.pts.length);
      const key = t.id; const ms = (AS.still || lastSideKey === "") ? 0 : 600;
      requestAnimationFrame(() => requestAnimationFrame(() => { if (dead || !spread || spread.t.id !== key) return; fitSpread(ms); fitT = setTimeout(() => { if (!dead && spread && spread.t.id === key && !map.el.dataset.fit){ fitSpread(0); } }, 250); })); }
    else { spread = null; side.append(techEmpty()); }
    const key = tab + ":" + (tab === "era" ? S.era : S.id); side.scrollTop = (keepScroll && key === lastSideKey) ? st : 0; lastSideKey = key; }

  /* ---------- keys ---------- */
  function onKey(e){ if (e.metaKey || e.ctrlKey || e.altKey || dead) return; const tg = e.target, typing = tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA" || tg.isContentEditable);
    if (typing){ if (e.key === "Escape") tg.blur(); return; } if (document.querySelector(".modal-back")) return;
    const k = e.key;
    if (k === "ArrowDown" || k === "ArrowUp"){ e.preventDefault(); move(k === "ArrowDown" ? 1 : -1); }
    else if (k === "ArrowRight" || k === "ArrowLeft"){ e.preventDefault(); const d = k === "ArrowRight" ? 1 : -1;
      if (S.era == null){ const t = S.id && byId.get(S.id), s = t ? startOf(t) : null; setEra(s != null ? AS.eraOf(s) : (d > 0 ? 0 : 19)); } else setEra(AS.clamp(S.era + d, 0, 19)); }
    else if (k === "Escape"){ if (S.id && activeTab() === "tech") select(null); else if (S.era != null) setEra(null); else if (S.id) select(null); }
    else if ((k === "p" || k === "P") && S.id) togglePin(S.id);
    else if (k === "/"){ e.preventDefault(); search.focus(); search.select(); }
    else if (k === " " && tg.tagName !== "BUTTON" && tg.tagName !== "A" && spread && activeTab() === "tech"){ e.preventDefault(); const b = side.querySelector(".wh-play"); if (b) b.click(); } }
  document.addEventListener("keydown", onKey);

  readParams(params); renderChart(); renderSide(); requestAnimationFrame(() => paintSel(true));
  if (skipped) console.info(`[when] skipped ${skipped} technique entries with no id or origin year`);
  return {
    update(p){ readParams(p); renderChart(); renderSide(); paintSel(true); },
    destroy(){ dead = true; stopPlay(); clearTimeout(searchT); clearTimeout(fitT); document.removeEventListener("keydown", onKey); AS.tip.hide(); if (map) map.destroy(); map = null; }
  };
}

AS.views.when = { title:"When",
  mount(el, params){ this._v = create(el, params || {}); },
  update(params){ if (this._v) this._v.update(params || {}); },
  unmount(){ if (this._v) this._v.destroy(); this._v = null; } };
})();
