/* Anthropeum Study — Scripts room: a writing-systems trainer.
   Specimens (grid + detail), World by era (map of every script in use), and a "Name that script" quick test.
   Data: AS_DATA.scripts (see data-src/scripts.json). A small built-in fixture stands in until that file is packed. */
(function(){ "use strict";
const AS = window.AS, h = AS.h;

/* ---------- fallback fixture (only used when AS_DATA.scripts is missing or empty) ---------- */
const FIXTURE = { _fixture:true,
  fontsCss:"https://fonts.googleapis.com/css2?family=Noto+Sans+Cuneiform&family=Noto+Sans+Ugaritic&family=Noto+Sans+Egyptian+Hieroglyphs&family=Noto+Naskh+Arabic&family=Noto+Kufi+Arabic&family=Noto+Nastaliq+Urdu&family=Aref+Ruqaa&family=Noto+Serif+Hebrew&family=Noto+Serif+Devanagari&family=Noto+Serif+Tibetan&family=Noto+Serif+TC&family=Zhi+Mang+Xing&family=Liu+Jian+Mao+Cao&family=Noto+Sans+Mongolian&family=Noto+Sans+Javanese&family=Noto+Serif&family=Cinzel&family=UnifrakturMaguntia&family=Uncial+Antiqua&family=Noto+Sans+Runic&family=Noto+Serif+Ethiopic&display=swap",
  scripts:[
    { id:"cuneiform", name:"Cuneiform", family:"Mesopotamian", sample:"𒀭𒂗𒆤 𒈗 𒆳𒆳𒊏", sampleMeaning:"Enlil, king of the lands", font:"Noto Sans Cuneiform", dir:"ltr", from:-3300, to:75,
      areas:[ { label:"Mesopotamia", lat:33, lon:44.4, r_km:600, from:-3300, to:75, region:"wan" }, { label:"Anatolia (Hittite)", lat:39.5, lon:34, r_km:380, from:-1900, to:-1180, region:"wan" }, { label:"Elam · Persia", lat:31, lon:50.5, r_km:420, from:-2300, to:-330, region:"wan" } ],
      look:["Clusters of wedges, each with a triangular head and a tail", "Pressed into clay, so strokes have depth and shadow", "Signs sit in ruled rows or boxed cases", "No curves at all"], onWhat:"Clay tablets, cylinder seals, bricks, stone stelae and boundary stones.", infer:"Wedges on clay mean Mesopotamia or its neighbours, and before the turn of the era. Tidy rows on a big stone relief lean Assyrian or Achaemenid.",
      confusables:[ { id:"ugaritic", how:"Ugaritic is a 30-sign alphabet: the same few simple wedge-groups repeat. Cuneiform proper has hundreds of dense signs." } ],
      styles:[ { name:"Archaic Sumerian", sample:"𒀭 𒆠 𒈗", font:"Noto Sans Cuneiform", from:-3300, to:-2400, where:"Uruk, Ur", look:"Pictographic, signs in boxed cases, read top-down." }, { name:"Neo-Assyrian", sample:"𒀸𒋩 𒈗 𒆳", font:"Noto Sans Cuneiform", from:-900, to:-600, where:"Nineveh, Nimrud", look:"Clean, simplified, relentlessly regular rows across reliefs." } ] },
    { id:"ugaritic", name:"Ugaritic", family:"Mesopotamian", sample:"𐎛𐎍 𐎎𐎍𐎋", sampleMeaning:"El the king", font:"Noto Sans Ugaritic", dir:"ltr", from:-1400, to:-1180,
      areas:[ { label:"Ugarit", lat:35.6, lon:35.8, r_km:150, region:"wan" } ], look:["Only 30 distinct signs", "Simple groups of one to seven wedges", "Small vertical wedge as a word divider"], onWhat:"Clay tablets from one Syrian port city.", infer:"A very narrow window: Late Bronze Age coastal Syria, 1400–1180 BCE.",
      confusables:[ { id:"cuneiform", how:"If the signs are dense and varied, it is Mesopotamian cuneiform, not this alphabet." } ] },
    { id:"egyptian-hieroglyphs", name:"Egyptian hieroglyphs", family:"Egyptian", sample:"𓇋𓏠𓈖𓇳 𓊹𓄤", sampleMeaning:"Amun-Ra, the good god", font:"Noto Sans Egyptian Hieroglyphs", dir:"rtl", from:-3200, to:394,
      areas:[ { label:"Egypt", lat:26.5, lon:31.5, r_km:520, region:"egy" }, { label:"Nubia", lat:19, lon:31, r_km:380, from:-1500, to:300, region:"egy" } ],
      look:["Recognisable pictures: birds, reeds, eyes, snakes", "Figures face the start of the line", "Royal names sit inside oval cartouches", "Stacked in neat invisible squares"], onWhat:"Temple and tomb walls, stelae, coffins, scarabs, statues, faience.", infer:"Egypt or Nubia, full stop. Cartouches mean a named king, which can pin the reign.",
      styles:[ { name:"Monumental", sample:"𓊹𓄤 𓎟𓇾𓇾", font:"Noto Sans Egyptian Hieroglyphs", from:-3000, to:394, where:"Temples, tombs", look:"Fully drawn, often painted, every feather shown." }, { name:"Hieratic", sample:"", noFont:true, from:-2700, to:300, where:"Papyri, ostraca", look:"Cursive brush shorthand, joined and slanted, always right to left." }, { name:"Demotic", sample:"", noFont:true, from:-650, to:450, where:"Everyday documents", look:"Fast, flat, comma-like strokes with no pictures left." } ] },
    { id:"arabic", name:"Arabic", family:"Semitic", sample:"بسم الله الرحمن الرحيم", sampleMeaning:"In the name of God, the Merciful, the Compassionate", font:"Noto Naskh Arabic", dir:"rtl", from:400, to:2000,
      areas:[ { label:"Arabia · Levant", lat:27, lon:42, r_km:900, from:400, region:"wan" }, { label:"Maghreb · al-Andalus", lat:33, lon:-2, r_km:900, from:700, region:"egy" }, { label:"Iran · Central Asia", lat:35, lon:58, r_km:950, from:700, region:"cas" }, { label:"North India", lat:27, lon:78, r_km:750, from:1200, region:"sas" } ],
      look:["Joined letters flowing right to left", "Dots above and below the line", "Tall verticals (alif, lam) punctuate the band", "Often used as pure ornament"], onWhat:"Ceramics, metalwork, textiles (tiraz), coins, Qur'an leaves, tiles, architecture.", infer:"The Islamic world, after 650 CE. The style narrows it: angular Kufic is early, hanging nasta'liq is Persianate and late.",
      confusables:[ { id:"hebrew", how:"Hebrew letters are separate, square blocks. Arabic is joined and cursive." } ],
      styles:[ { name:"Kufic", sample:"بسم الله الرحمن", font:"Noto Kufi Arabic", from:650, to:1200, where:"Iraq, Iran, Egypt, North Africa", look:"Angular and horizontal, a low flat baseline with stiff verticals." }, { name:"Naskh", sample:"بسم الله الرحمن", font:"Noto Naskh Arabic", from:950, to:2000, where:"Everywhere", look:"Rounded, small, legible book hand." }, { name:"Thuluth", sample:"بسم الله الرحمن", font:"Aref Ruqaa", from:1000, to:2000, where:"Mamluk Egypt, Ottoman lands", look:"Large and stately with sweeping curves; mosque lamps and metalwork." }, { name:"Nasta'liq", sample:"بسم اللہ الرحمن", font:"Noto Nastaliq Urdu", from:1400, to:2000, where:"Iran, Mughal India, Central Asia", look:"Words hang diagonally, sliding down to the left." } ] },
    { id:"hebrew", name:"Hebrew", family:"Semitic", sample:"שלום עליכם", sampleMeaning:"Peace be upon you", font:"Noto Serif Hebrew", dir:"rtl", from:-300, to:2000,
      areas:[ { label:"Levant", lat:31.8, lon:35.2, r_km:300, region:"wan" }, { label:"European diaspora", lat:49, lon:14, r_km:1100, from:900, region:"eur_nw" } ], look:["Square, separate block letters", "Thick horizontals, thin verticals", "Right to left, no joins"], onWhat:"Manuscripts, ritual silver, textiles, tombstones, amulets.", infer:"Jewish ritual or communal context; place comes from the object type, not the script.",
      confusables:[ { id:"arabic", how:"Arabic letters join into a flowing line; Hebrew stays in square blocks." } ] },
    { id:"devanagari", name:"Devanagari", family:"Brahmic", sample:"ॐ नमः शिवाय", sampleMeaning:"Om, homage to Shiva", font:"Noto Serif Devanagari", dir:"ltr", from:900, to:2000,
      areas:[ { label:"North India", lat:25.5, lon:79, r_km:900, region:"sas" }, { label:"Nepal", lat:27.8, lon:85, r_km:250, region:"sas" } ], look:["A continuous headline bar along the top", "Letters hang from the bar", "Vowel marks above, below and beside"], onWhat:"Manuscripts, miniature-painting captions, copper plates, coins.", infer:"North India or Nepal, after about 900 CE.",
      confusables:[ { id:"tibetan", how:"Tibetan has a headline per letter, not one unbroken bar, and stacks letters deep below it." } ] },
    { id:"tibetan", name:"Tibetan", family:"Brahmic", sample:"ༀ་མ་ཎི་པདྨེ་ཧཱུྃ", sampleMeaning:"Om mani padme hum", font:"Noto Serif Tibetan", dir:"ltr", from:650, to:2000,
      areas:[ { label:"Tibet", lat:31, lon:90, r_km:800, region:"sas" }, { label:"Mongolia (Buddhist)", lat:47, lon:104, r_km:600, from:1600, region:"cas" } ], look:["Short top bars, one per letter", "Deep vertical stacks below the line", "A dot (tsheg) after every syllable"], onWhat:"Thangka backs, prayer wheels, ritual bronzes, woodblock books.", infer:"Tibetan Buddhist world: Tibet, Bhutan, Ladakh, Mongolia.",
      confusables:[ { id:"devanagari", how:"Devanagari runs one unbroken bar across each word." } ] },
    { id:"chinese", name:"Chinese", family:"East Asian", sample:"天地玄黃 宇宙洪荒", sampleMeaning:"Heaven and earth, dark and yellow; the cosmos vast and waste", font:"Noto Serif TC", dir:"ltr", from:-1250, to:2000,
      areas:[ { label:"China", lat:33, lon:112, r_km:1200, region:"eas" }, { label:"Korea", lat:37, lon:127.5, r_km:300, from:-100, region:"eas" }, { label:"Japan", lat:35.5, lon:137, r_km:550, from:400, region:"eas" }, { label:"Vietnam", lat:19, lon:106, r_km:450, from:-100, to:1920, region:"sea" } ],
      look:["Each character fills an invisible square", "Built from strokes, not letters", "Traditionally in columns, top to bottom, right to left", "Red seals alongside brush writing"], onWhat:"Bronzes, paintings, ceramics (reign marks on the base), seals, coins, stelae.", infer:"East Asia. The script style is the date: seal script is archaic or deliberately antique, regular script is post-Han.",
      styles:[ { name:"Seal script", sample:"", noFont:true, from:-800, to:2000, where:"Bronzes, seals", look:"Even-weight curved lines, tall symmetrical characters." }, { name:"Regular (kaishu)", sample:"天地玄黃", font:"Noto Serif TC", from:200, to:2000, where:"Everywhere", look:"Upright, each stroke distinct with a clear start and finish." }, { name:"Running (xingshu)", sample:"天地玄黃", font:"Zhi Mang Xing", from:300, to:2000, where:"Letters, painting inscriptions", look:"Strokes linked, brush barely lifts." }, { name:"Cursive (caoshu)", sample:"天地玄黃", font:"Liu Jian Mao Cao", from:100, to:2000, where:"Calligraphy scrolls", look:"Wild abbreviation; characters dissolve into loops." } ] },
    { id:"mongolian", name:"Mongolian", family:"Central Asian", sample:"ᠮᠣᠩᠭᠣᠯ ᠪᠢᠴᠢᠭ", sampleMeaning:"Mongolian script", font:"Noto Sans Mongolian", dir:"ttb", from:1204, to:2000,
      areas:[ { label:"Mongolia", lat:46, lon:105, r_km:900, region:"cas" }, { label:"Qing court", lat:40, lon:116.4, r_km:300, from:1644, to:1912, region:"eas" } ], look:["Vertical, with a continuous spine down each word", "Columns run left to right", "Teeth and loops branch off the spine"], onWhat:"Manuscripts, seals, Qing imperial inscriptions and coins.", infer:"Mongol or Manchu world, 13th century on. With Chinese beside it: Qing dynasty.", confusables:[] },
    { id:"javanese", name:"Javanese", family:"Brahmic", sample:"ꦲꦏ꧀ꦱꦫꦗꦮ", sampleMeaning:"Aksara Jawa (Javanese script)", font:"Noto Sans Javanese", dir:"ltr", from:1300, to:2000,
      areas:[ { label:"Java", lat:-7.5, lon:110.5, r_km:400, region:"sea" } ], look:["Rows of rounded m-like arches", "Marks stacked above and far below", "Even, rolling rhythm"], onWhat:"Palm-leaf and paper manuscripts, kris fittings, court documents.", infer:"Java or Bali.", confusables:[] },
    { id:"greek", name:"Greek", family:"European", sample:"ΑΘΗΝΑΙΩΝ", sampleMeaning:"Of the Athenians", font:"Noto Serif", dir:"ltr", from:-800, to:2000,
      areas:[ { label:"Aegean", lat:38, lon:24, r_km:500, region:"eur_s" }, { label:"Hellenistic East", lat:34, lon:45, r_km:1300, from:-330, to:650, region:"wan" }, { label:"Byzantium", lat:40, lon:30, r_km:700, from:330, to:1453, region:"eur_e" } ], look:["Δ Λ Σ Φ Ω among Latin-looking capitals", "Even, geometric capitals on stone and coins"], onWhat:"Coins, painted vases, stone inscriptions, icons.", infer:"Greek world; on coins as far east as Bactria and India after Alexander.",
      confusables:[ { id:"latin", how:"Look for letters Latin lacks: Δ, Λ, Σ, Φ, Ψ, Ω." } ] },
    { id:"latin", name:"Latin", family:"European", sample:"SENATVS POPVLVSQVE ROMANVS", sampleMeaning:"The Senate and People of Rome", font:"Cinzel", dir:"ltr", from:-600, to:2000,
      areas:[ { label:"Italy · Roman West", lat:43, lon:8, r_km:1300, region:"eur_s" }, { label:"Northern Europe", lat:53, lon:8, r_km:1000, from:600, region:"eur_nw" }, { label:"Americas", lat:15, lon:-90, r_km:3000, from:1500, region:"mes" } ], look:["V for U and no J in ancient inscriptions", "Serifed capitals with thick and thin strokes"], onWhat:"Coins, stone inscriptions, manuscripts, seals, prints.", infer:"Europe and its reach. The hand dates it: square capitals are Roman or Renaissance, blackletter is medieval north.",
      confusables:[ { id:"greek", how:"Greek has Δ, Λ, Σ, Φ, Ω; Latin never does." } ],
      styles:[ { name:"Roman capitals", sample:"IMP CAESAR", font:"Cinzel", from:-100, to:500, where:"Roman Empire", look:"Stately serifed capitals, V for U." }, { name:"Uncial", sample:"in principio", font:"Uncial Antiqua", from:300, to:900, where:"Ireland, Britain, Italy", look:"Round, wide letters, no real lower case yet." }, { name:"Blackletter", sample:"Ave Maria", font:"UnifrakturMaguntia", from:1150, to:1600, where:"Germany, France, England", look:"Dense picket fence of broken, angular strokes." } ] },
    { id:"runic", name:"Runic", family:"European", sample:"ᚠᚢᚦᚨᚱᚲ", sampleMeaning:"f-u-th-a-r-k, the first six runes", font:"Noto Sans Runic", dir:"ltr", from:150, to:1400,
      areas:[ { label:"Scandinavia", lat:60, lon:14, r_km:800, region:"eur_nw" }, { label:"Britain", lat:54, lon:-2, r_km:400, from:450, to:1100, region:"eur_nw" } ], look:["Only straight strokes: verticals and diagonals", "No horizontals (made to cut across wood grain)"], onWhat:"Rune stones, brooches, weapons, combs, bracteates.", infer:"Germanic north: Scandinavia or Anglo-Saxon England.", confusables:[] },
    { id:"geez", name:"Ge'ez (Ethiopic)", family:"Semitic", sample:"ሰላም ለኪ", sampleMeaning:"Peace to you", font:"Noto Serif Ethiopic", dir:"ltr", from:300, to:2000,
      areas:[ { label:"Ethiopian highlands", lat:12, lon:39, r_km:500, region:"ssa" } ], look:["Chunky upright letters with small flags and loops", "Left to right, unlike its Semitic cousins", "Two-dot word dividers in older texts"], onWhat:"Parchment manuscripts, icons, processional crosses, healing scrolls.", infer:"Ethiopia or Eritrea.", confusables:[] },
    { id:"indus", name:"Indus script", family:"Undeciphered", sample:"", noUnicode:true, dir:"rtl", from:-2600, to:-1900,
      areas:[ { label:"Indus valley", lat:28, lon:70.5, r_km:700, region:"sas" } ], look:["Five or so signs in a short row above an animal", "Fish, jar and comb-like signs", "Tiny square steatite seals with a boss on the back"], onWhat:"Stamp seals, sealings, small tablets, pot marks.", infer:"Harappan civilisation, 2600–1900 BCE. Nothing else looks like it.", confusables:[] },
    { id:"maya", name:"Maya glyphs", family:"Mesoamerican", sample:"", noUnicode:true, dir:"ltr", from:-300, to:1600,
      areas:[ { label:"Maya lowlands", lat:17.5, lon:-89.5, r_km:450, region:"mes" } ], look:["Rounded-square blocks like pebbles", "Faces in profile inside the blocks", "Bars and dots for numbers", "Read in paired columns"], onWhat:"Stelae, lintels, painted cylinder vases, jade, codices.", infer:"Maya area. Dense glyph bands on polychrome vases are Late Classic, 600–900 CE.", confusables:[] }
  ] };

/* ---------- pure helpers ---------- */
const num = v => (typeof v === "number" && isFinite(v)) ? v : (typeof v === "string" && v.trim() !== "" && isFinite(+v)) ? +v : null;
const str = v => v == null ? "" : String(v);
const titleCase = id => str(id).replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
function normalise(raw){
  const list = raw && Array.isArray(raw.scripts) ? raw.scripts : []; const seen = new Set(), out = [];
  for (const s of list){ if (!s || !s.id || seen.has(s.id)) continue; seen.add(s.id);
    const areas = (Array.isArray(s.areas) ? s.areas : []).filter(a => a && num(a.lat) != null && num(a.lon) != null).map(a => Object.assign({}, a, {
      lat:num(a.lat), lon:num(a.lon), r_km:num(a.r_km) > 0 ? num(a.r_km) : 300, from:num(a.from), to:num(a.to), label:str(a.label),
      region:a.region && AS.REGIONS.some(r => r.id === a.region) ? a.region : AS.regionOfPoint(num(a.lon), num(a.lat)) }));
    let from = num(s.from), to = num(s.to);
    if (from == null){ const f = areas.map(a => a.from).filter(v => v != null); from = f.length ? Math.min(...f) : -3000; }
    if (to == null){ const t = areas.map(a => a.to).filter(v => v != null); to = t.length ? Math.max(...t) : 2000; }
    if (to < from){ const t = from; from = to; to = t; }
    for (const a of areas){ if (a.from == null) a.from = from; if (a.to == null) a.to = to; }
    const regions = []; for (const a of areas) if (!regions.includes(a.region)) regions.push(a.region);
    out.push(Object.assign({}, s, { id:str(s.id), name:str(s.name) || titleCase(s.id), family:str(s.family) || "Other", sample:str(s.sample).trim(), font:str(s.font), dir:s.dir === "rtl" || s.dir === "ttb" ? s.dir : "ltr",
      from, to, areas, regions, look:Array.isArray(s.look) ? s.look.map(str).filter(Boolean) : s.look ? [str(s.look)] : [],
      styles:(Array.isArray(s.styles) ? s.styles : []).filter(Boolean), confusables:(Array.isArray(s.confusables) ? s.confusables : []).filter(c => c && c.id && c.id !== s.id) })); }
  return out;
}
const hasSpec = s => !!(s && s.sample && str(s.sample).trim() && !s.noUnicode && (!s.noFont || s.fallbackFont));
const RTL_CHARS = /[\u0590-\u08ff\ufb1d-\ufefc]|\ud802[\udc00-\udfff]|\ud803[\udc00-\udfff]|\ud83a[\udc00-\udfff]/;
const inUse = (s, i) => s.from < AS.eraEnd(i) && s.to > AS.eraStart(i);
const areaOn = (a, era) => era == null || (a.from < AS.eraEnd(era) && a.to > AS.eraStart(era));
const spanChip = (from, to) => { if (from == null && to == null) return null; if (from == null) return AS.ui.yearChip(to); if (to == null) return AS.ui.yearChip(from);
  if (to >= 1950){ const c = AS.ui.yearChip(from, to); c.textContent = (from < 0 ? `${-from} BCE` : `${from || 1} CE`) + " → now"; return c; } return AS.ui.yearChip(from, to); };
const eraStrip = (from, to) => { const el = h("div.sc-strip", { "aria-hidden":"true" }); for (let i = 0; i < 20; i++){ const on = from < AS.eraEnd(i) && to > AS.eraStart(i); el.append(h("i" + (on ? ".on" : ""), { style:on ? { background:AS.eraColor(i) } : null })); } return el; };

/* ---------- fonts ---------- */
let fontsReady = null; const fontDone = new Set();
function ensureFonts(urls){
  if (fontsReady) return fontsReady;
  const list = [].concat(urls || []).filter(u => typeof u === "string" && /^https?:\/\//.test(u));
  fontsReady = Promise.all(list.map(u => new Promise(res => {
    let l = Array.from(document.head.querySelectorAll("link[data-sc-fonts]")).find(x => x.getAttribute("href") === u);
    if (l && l.sheet) return res();
    if (!l){ l = h("link", { rel:"stylesheet", href:u, "data-sc-fonts":"1" }); document.head.append(l); }
    l.addEventListener("load", res); l.addEventListener("error", res); setTimeout(res, 5000); })));
  return fontsReady;
}
const cleanFont = f => str(f).replace(/["';{}<>\\]/g, "").trim();
const fontStack = f => { f = cleanFont(f); return (f ? `"${f}", ` : "") + `"Noto Sans", "Noto Serif", system-ui, sans-serif`; };
/* tall or deep scripts need more leading (and a touch less size) so nothing gets clipped */
function metrics(font, text){
  const f = font || "";
  if (/nastaliq/i.test(f)) return { lh:2.5, k:.72, tall:true };
  if (/tibetan/i.test(f)) return { lh:1.9, k:.86, tall:true };
  if (/javanese|balinese|sundanese|tai tham|khmer|myanmar/i.test(f)) return { lh:2.1, k:.8, tall:true };
  if (/thai|lao|sinhala|telugu|kannada|malayalam|tamil|devanagari|bengali|gujarati|gurmukhi|oriya|grantha|siddham|sharada|brahmi|kufi|naskh|arab|ruqaa|amiri|lateef|syriac|thaana|hieroglyph/i.test(f)) return { lh:1.7, k:.92 };
  if (/[؀-ۿऀ-෿฀-࿿က-႟ក-៿]/.test(text || "")) return { lh:1.8, k:.9 };
  return { lh:1.4, k:1 };
}
/* a rendered specimen. o: { size(px), lines(clamp; 0 = wrap freely) } */
function glyphs(s, o){
  const font = cleanFont(s.font || s.fallbackFont), text = str(s.sample).trim(), m = metrics(font, text);
  const vlr = s.dir === "ttb" && /mongol|manchu|phags|todo|clear script|sibe|uyghur/i.test(font + " " + str(s.id) + " " + str(s.name));
  const vert = s.dir === "ttb" && (vlr || !o.flat), force = s.dir === "rtl" && !RTL_CHARS.test(text);
  const lines = o.lines ? (m.tall ? Math.max(1, o.lines - 1) : o.lines) : 0;
  /* vertical CJK: one phrase per column, sized so the longest phrase fits the column */
  let shown = text, size = o.size * m.k;
  if (vert && !vlr){ const segs = text.split(/\s+/); shown = segs.join("\n"); const longest = Math.max(...segs.map(x => Array.from(x).length)); size = Math.min(size, Math.floor((o.maxCol || 380) / (longest * 1.04))); }
  const el = h("div.sc-glyphs" + (vert ? ".sc-vert" : "") + (vlr ? ".sc-vlr" : "") + (lines && !vert ? ".sc-clamp" : "") + (force ? ".sc-force-rtl" : ""), { dir:s.dir === "rtl" ? "rtl" : "ltr", translate:"no",
    style:{ fontFamily:fontStack(font), fontSize:Math.round(size) + "px", lineHeight:String(vert ? 1.35 : m.lh), whiteSpace:vert && !vlr ? "pre" : null, "--sc-lines":String(lines || 2) } }, shown);
  const key = font + "|" + text;
  if (font && !fontDone.has(key)){
    el.classList.add("sc-pend"); let done = false; const show = () => { if (done) return; done = true; el.classList.remove("sc-pend"); };
    setTimeout(show, 2600);
    (fontsReady || Promise.resolve()).then(() => document.fonts && document.fonts.load ? document.fonts.load(`48px "${font}"`, text) : null).then(r => { if (r && r.length) fontDone.add(key); show(); }, show);
  }
  return el;
}
const bigSize = text => { const n = Array.from(str(text).replace(/\s+/g, "")).length; return n <= 6 ? 120 : n <= 11 ? 100 : n <= 20 ? 80 : n <= 34 ? 64 : 52; };
const hatch = (label, text, cls) => h("div.sc-hatch" + (cls ? "." + cls : ""), {}, h("span.sc-hatch-tag", {}, label), text ? h("span.sc-hatch-text", {}, text) : null);
const shortName = s => { const n = str(s.name).replace(/\s*\([^)]*\)/g, "").split(";")[0].replace(/\s+styles?$/i, "").trim(); return n || s.name; };
const isVlr = s => s.dir === "ttb" && /mongol|manchu|phags/i.test(str(s.font) + " " + str(s.id));
const noSpecLabel = s => s.noUnicode ? "not in Unicode" : s.noFont ? "no web font" : "no digital specimen";

/* ================= the view ================= */
let M = null; /* everything belonging to the current mount */

function mount(el, params){
  const raw = window.AS_DATA && window.AS_DATA.scripts; let all = normalise(raw), fixture = false, fontsCss = raw && raw.fontsCss;
  if (!all.length){ all = normalise(FIXTURE); fontsCss = FIXTURE.fontsCss; fixture = true; }
  ensureFonts(fontsCss);
  const byId = {}; for (const s of all) byId[s.id] = s;
  const families = []; for (const s of all) if (!families.includes(s.family)) families.push(s.family);
  M = { el, all, byId, families, fixture, st:{}, visible:[], cursor:null, detailMap:null, detailBar:null, worldMap:null, worldBar:null, quiz:null, hl:null };

  /* --- topbar --- */
  M.search = h("input.input.sc-search", { type:"search", placeholder:"Search scripts, styles, places", "aria-label":"Search scripts", spellcheck:"false",
    oninput:() => setState({ q:M.search.value.trim() }), onkeydown:e => { if (e.key === "Escape"){ M.search.value = ""; setState({ q:"" }); M.search.blur(); } else if (e.key === "Enter"){ M.search.blur(); if (M.visible.length && M.st.view === "specimens") select(M.visible[0].id); } } });
  M.viewSeg = AS.ui.seg([{ value:"specimens", label:"Specimens" }, { value:"world", label:"World by era" }], "specimens", v => setState({ view:v }));
  M.famChips = AS.ui.chips(families.map(f => ({ value:f, label:f, n:all.filter(s => s.family === f).length })), null, v => setState({ family:v || "" }));
  M.famChips.classList.add("sc-fams");
  M.regionSlot = h("span.sc-regionslot"); M.count = h("span.sc-count.mono");
  el.append(h("div.topbar.sc-top", {},
    h("h2", {}, "Scripts"), h("div.sc-searchwrap", {}, M.search, h("span.kbd.sc-slash", {}, "/")), M.viewSeg, M.regionSlot, M.count,
    fixture ? h("span.tag.plain.sc-fixture", { title:"data/scripts.js is not packed yet; showing a built-in sample set" }, "sample data") : null,
    h("div.grow"), h("button.btn.primary.sm.sc-quizbtn", { type:"button", title:"Ten specimens, four names each (T)", onclick:openQuiz }, "Name that script"),
    M.famChips));
  M.body = h("div.sc-body"); el.append(M.body);
  M.onKey = onKey; document.addEventListener("keydown", onKey);
  apply(params, true);
}
function unmount(){ if (!M) return; document.removeEventListener("keydown", M.onKey); if (M.quiz && M.quiz.modal){ const q = M.quiz; M.quiz = null; q.modal.close(); } killBody(); AS.tip.hide(); M = null; }
function killDetail(){ if (M.detailBar){ M.detailBar.destroy(); M.detailBar = null; } if (M.detailMap){ M.detailMap.destroy(); M.detailMap = null; } }
function killBody(){ killDetail(); if (M.worldBar){ M.worldBar.destroy(); M.worldBar = null; } if (M.worldMap){ M.worldMap.destroy(); M.worldMap = null; } M.body.innerHTML = ""; M.built = null; }

/* --- state <-> URL --- */
function parse(p){ p = p || {}; const e = parseInt(p.era, 10);
  const fam = p.family ? (M.families.find(f => f.toLowerCase() === String(p.family).toLowerCase()) || "") : "";
  return { id:p.id && M.byId[p.id] ? p.id : "", family:fam, q:str(p.q), view:p.view === "world" ? "world" : "specimens", era:e >= 0 && e <= 19 ? e : null, region:p.region && AS.REGIONS.some(r => r.id === p.region) ? p.region : "" };
}
function setState(patch, push){ const st = Object.assign({}, M.st, patch);
  AS.setParams({ id:st.id, family:st.family, q:st.q, view:st.view === "world" ? "world" : "", era:st.era == null ? "" : String(st.era), region:st.region }, { replace:!push });
  render(st); }
function apply(params, first){ const st = parse(params); if (M.search && document.activeElement !== M.search) M.search.value = st.q; render(st, first); }
function select(id, push){ M.cursor = id; setState({ id, view:"specimens" }, push); }

function filtered(st){ const q = st.q.toLowerCase();
  return M.all.filter(s => (!st.family || s.family === st.family) && (!st.region || s.regions.includes(st.region)) && (!q || matches(s, q)))
    .map((s, i) => [M.families.indexOf(s.family), i, s]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]); }
function matches(s, q){ if (!s._hay) s._hay = [s.id, s.name, s.family, s.onWhat, s.sampleMeaning].concat(s.styles.map(x => x.name + " " + (x.where || "")), s.areas.map(a => a.label), s.regions.map(r => AS.region(r).name)).join(" · ").toLowerCase();
  return q.split(/\s+/).every(w => s._hay.includes(w)); }

function render(st, first){
  const prev = M.st; M.st = st;
  const filtersChanged = first || prev.family !== st.family || prev.q !== st.q || prev.region !== st.region;
  if (first || prev.view !== st.view) M.viewSeg.set(st.view);
  if (first || prev.family !== st.family) M.famChips.set(st.family || null);
  if (first || prev.region !== st.region){ M.regionSlot.innerHTML = ""; if (st.region){ const r = AS.region(st.region);
      M.regionSlot.append(h("button.chip.sc-regionchip", { type:"button", style:{ "--c":r.color }, title:"Clear the region filter", onclick:() => setState({ region:"" }) }, h("span.dot"), "Filtered to " + r.short, h("span.sc-x", {}, "✕"))); } }
  if (filtersChanged){ M.visible = filtered(st); M.count.textContent = M.visible.length === M.all.length ? `${M.all.length} scripts` : `${M.visible.length} of ${M.all.length}`; }
  if (M.built !== st.view){ killBody(); M.built = st.view; if (st.view === "world") buildWorld(); else buildSpecimens(); }
  else if (st.view === "world"){ if (filtersChanged || prev.era !== st.era) drawWorld(filtersChanged); }
  else { if (filtersChanged) drawGrid(); if (prev.id !== st.id) drawDetail(); else if (prev.era !== st.era) drawDetailEra(true); markSelected(); }
}

/* ================= Specimens ================= */
function buildSpecimens(){
  M.grid = h("div.sc-main.view-scroll"); M.detail = h("aside.sc-detailpane.view-scroll", { "aria-label":"Script detail" });
  M.body.className = "sc-body sc-specimens"; M.body.append(M.grid, M.detail);
  drawGrid(); drawDetail(); markSelected();
}
function tile(s){
  const spec = hasSpec(s) ? glyphs(s, { size:44, lines:2, flat:true }) : hatch(noSpecLabel(s), s.look[0] || "Learn this one by description.");
  const dots = h("span.sc-dots"); for (const r of s.regions.slice(0, 6)){ const R = AS.region(r); dots.append(h("i", { style:{ background:R.color }, title:R.name })); }
  return h("div.sc-tile", { role:"button", tabindex:"0", data:{ id:s.id }, "aria-label":s.name, onclick:() => select(s.id, true), onfocus:() => { M.cursor = s.id; } },
    h("div.sc-tile-spec" + (isVlr(s) ? ".sc-tile-vert" : ""), {}, spec),
    h("div.sc-tile-foot", {}, h("div.sc-tile-name", { title:s.name }, s.name), h("div.sc-tile-when", {}, spanChip(s.from, s.to), dots)),
    eraStrip(s.from, s.to));
}
function drawGrid(){
  const g = M.grid; g.innerHTML = ""; const list = M.visible;
  if (!list.length){ g.append(h("div.sc-empty", {}, h("div.sc-empty-glyph", {}, "?"), h("h3", {}, "Nothing matches"), h("p.muted", {}, "No script fits those filters. Undeciphered, perhaps."),
      h("button.btn.sm", { type:"button", onclick:() => { M.search.value = ""; setState({ q:"", family:"", region:"" }); } }, "Clear filters"))); return; }
  const inner = h("div.sc-gridwrap");
  for (const fam of M.families){ const items = list.filter(s => s.family === fam); if (!items.length) continue;
    const span = [Math.min(...items.map(s => s.from)), Math.max(...items.map(s => s.to))];
    inner.append(h("div.sc-famhead", {}, h("h3", {}, fam), h("span.sc-famn.mono", {}, String(items.length)), h("span.sc-famline"), h("span.sc-famspan.mono", {}, span[1] >= 1950 ? `${AS.fmtYear(span[0])} → now` : AS.rangeLabel(span[0], span[1]))),
      h("div.sc-grid", {}, items.map(tile))); }
  inner.append(h("div.sc-keys", {}, h("span.kbd", {}, "/"), " search ", h("span.kbd", {}, "←"), h("span.kbd", {}, "→"), " move ", h("span.kbd", {}, "Enter"), " open ", h("span.kbd", {}, "Esc"), " close ", h("span.kbd", {}, "T"), " quick test"));
  g.append(inner);
}
function markSelected(){ if (!M.grid) return; const id = M.st.id; M.body.classList.toggle("sc-has-detail", !!id);
  M.grid.querySelectorAll(".sc-tile").forEach(t => { t.classList.toggle("on", t.dataset.id === id); t.classList.toggle("cur", !id && t.dataset.id === M.cursor); }); }
function moveCursor(d){
  const list = M.visible; if (!list.length) return; const curId = M.st.id || M.cursor; let i = list.findIndex(s => s.id === curId);
  i = i < 0 ? (d > 0 ? 0 : list.length - 1) : AS.clamp(i + d, 0, list.length - 1); const id = list[i].id; M.cursor = id;
  if (M.st.id) setState({ id }); else markSelected();
  const t = M.grid && M.grid.querySelector(`.sc-tile[data-id="${window.CSS && CSS.escape ? CSS.escape(id) : id}"]`); if (t) t.scrollIntoView({ block:"nearest" });
}

function drawDetail(){
  killDetail(); const d = M.detail; d.innerHTML = ""; d.scrollTop = 0; const s = M.byId[M.st.id]; M.body.classList.toggle("sc-has-detail", !!s); if (!s) return;
  const vis = M.visible, idx = vis.findIndex(x => x.id === s.id), srs = AS.srs.state("scripts")[s.id];
  const nav = h("div.sc-d-nav", {},
    h("button.btn.ghost.icon", { type:"button", title:"Previous (←)", disabled:idx <= 0, onclick:() => moveCursor(-1) }, "‹"),
    h("button.btn.ghost.icon", { type:"button", title:"Next (→)", disabled:idx < 0 || idx >= vis.length - 1, onclick:() => moveCursor(1) }, "›"),
    h("button.btn.ghost.icon", { type:"button", title:"Close (Esc)", "aria-label":"Close", onclick:() => setState({ id:"" }) }, "✕"));
  d.append(h("div.sc-d-head", {}, h("div", {}, h("div.eyebrow", {}, s.family), h("h2.sc-d-name", {}, s.name)), nav));

  /* the specimen */
  if (hasSpec(s)) d.append(h("div.sc-d-spec" + (s.dir === "ttb" ? ".sc-d-vert" : ""), {}, glyphs(s, { size:s.dir === "ttb" ? Math.min(68, bigSize(s.sample)) : bigSize(s.sample), lines:0 })), s.sampleMeaning ? h("p.sc-d-meaning", {}, str(s.sampleMeaning)) : null);
  else d.append(hatch(noSpecLabel(s) + " · learn it by description", s.look[0] || "No digital specimen exists for this one.", "sc-hatch-big"));

  const chips = h("div.sc-d-chips", {}, spanChip(s.from, s.to), s.regions.map(r => AS.ui.regionTag(r)),
    s.dir === "rtl" ? h("span.tag.plain", {}, "← right to left") : s.dir === "ttb" ? h("span.tag.plain", {}, "↓ vertical") : null,
    srs ? h("span.sc-d-srs", { title:`Quick test: ${srs.right}/${srs.seen} right` }, AS.ui.pips(Math.min(3, Math.ceil(srs.box * 3 / 5)), 3)) : null);
  d.append(chips, eraStrip(s.from, s.to));
  if (s.dirNote || s.fontNote) d.append(h("div.sc-d-notes", {}, s.dirNote ? h("p", {}, h("span.faint", {}, "Direction  "), str(s.dirNote)) : null, s.fontNote ? h("p", {}, h("span.faint", {}, "Font  "), str(s.fontNote)) : null));

  if (s.infer) d.append(h("div.note.sc-infer", {}, h("div.eyebrow", {}, "What it tells you"), h("p", {}, s.infer)));
  const cols = h("div.sc-d-cols");
  if (s.look.length) cols.append(h("div", {}, h("div.section-title", {}, h("h4", {}, "Look for")), h("ul.sc-look", {}, s.look.map(t => h("li", {}, t)))));
  if (s.onWhat) cols.append(h("div", {}, h("div.section-title", {}, h("h4", {}, "Found on")), h("p.sc-onwhat", {}, s.onWhat)));
  if (cols.childNodes.length) d.append(cols);

  /* styles gallery */
  const styles = s.styles.slice().sort((a, b) => (num(a.from) == null ? 1e9 : num(a.from)) - (num(b.from) == null ? 1e9 : num(b.from)));
  if (styles.length){ d.append(h("div.section-title", {}, h("h4", {}, "Styles as date evidence"), h("span.sc-sub.mono", {}, `${styles.length} hand${styles.length > 1 ? "s" : ""}`)));
    d.append(h("div.sc-styles", { tabindex:"0" }, styles.map(x => { const f = num(x.from), t = num(x.to), ok = hasSpec(x);
      return h("div.sc-style", {}, h("div.sc-style-spec" + (isVlr(s) ? ".sc-tile-vert" : ""), {}, ok ? glyphs({ sample:x.sample, font:x.font || s.font, dir:x.dir || s.dir, id:s.id, name:s.name }, { size:46, lines:2, flat:true }) : hatch("described, not drawn", x.look || "No web font draws this hand.")),
        h("div.sc-style-name", {}, str(x.name) || "Unnamed hand"), h("div.sc-style-meta", {}, spanChip(f, t), x.where ? h("span.sc-style-where", {}, x.where) : null),
        x.look && ok ? h("p.sc-style-look", {}, x.look) : null, f != null && t != null ? eraStrip(f, t) : null); }))); }

  /* confusables */
  if (s.confusables.length){ d.append(h("div.section-title", {}, h("h4", {}, "Easily confused with")));
    d.append(h("div.sc-confs", {}, s.confusables.map(c => { const o = M.byId[c.id];
      const cell = (x, tag) => h("div.sc-conf-cell", {}, h("div.sc-conf-spec" + (x && isVlr(x) ? ".sc-tile-vert" : ""), {}, x && hasSpec(x) ? glyphs(x, { size:38, lines:1, flat:true }) : hatch(x ? noSpecLabel(x) : "not in this set", "")), h("div.sc-conf-name", {}, tag ? h("span.faint", {}, tag + " ") : null, x ? x.name : titleCase(c.id)));
      return h("div.sc-conf" + (o ? ".sc-link" : ""), o ? { role:"button", tabindex:"0", title:`Open ${o.name}`, onclick:() => select(o.id, true), onkeydown:e => { if (e.key === "Enter"){ e.stopPropagation(); select(o.id, true); } } } : {},
        h("div.sc-conf-pair", {}, cell(s, "this:"), h("span.sc-vs", {}, "vs"), cell(o, "")), c.how ? h("p.sc-conf-how", {}, c.how) : null); }))); }

  /* where + when */
  if (s.areas.length){
    d.append(h("div.section-title", {}, h("h4", {}, "Where and when"), M.readout = h("span.sc-sub.mono")));
    const host = h("div.sc-d-map"); d.append(host);
    M.detailMap = AS.createMap(host, { year:AS.MODERN_MAP, mode:"quiet", controls:true });
    const vals = []; for (let i = 0; i < 20; i++) vals.push(s.areas.filter(a => areaOn(a, i)).length);
    const barHost = h("div.sc-d-bar"); d.append(barHost);
    M.detailBar = AS.ui.eraBar(barHost, { value:M.st.era, allowAll:true, values:vals, ages:false, compact:true, log:false, tipUnit:"areas", onChange:i => setState({ era:i }) });
    M.detailBar.setDim(i => !inUse(s, i));
    const pts = []; for (const a of s.areas){ pts.push([a.lon, a.lat]); for (const b of [0, 90, 180, 270]) pts.push(AS.geo.dest(a.lon, a.lat, b, Math.min(a.r_km, 4000))); }
    M.detailMap.fit(pts, { pad:26, maxZoom:9, ms:0 }); drawDetailEra(false);
  }

  /* cross-links */
  d.append(h("div.sc-d-links", {}, s.regions.slice(0, 3).map(r => h("a.btn.sm", { href:AS.href("tells", { region:r }) }, h("span.sc-ldot", { style:{ background:AS.regionColor(r) } }), "Tells for " + AS.region(r).short)),
    h("a.btn.sm", { href:AS.href("practice", { mode:"scripts" }) }, "Drill scripts"),
    h("button.btn.sm.ghost", { type:"button", onclick:() => setState({ view:"world", era:M.st.era == null ? AS.eraOf((Math.max(s.from, -3000) + Math.min(s.to, 1999)) / 2) : M.st.era }) }, "See it among its neighbours")));
}
function drawDetailEra(syncBar){
  const s = M.byId[M.st.id], map = M.detailMap; if (!s || !map) return; const era = M.st.era;
  if (syncBar && M.detailBar && M.detailBar.value !== era) M.detailBar.set(era);
  map.setBase({ year:era == null ? AS.MODERN_MAP : AS.ERA2MAP[era] });
  const sorted = s.areas.slice().sort((a, b) => b.r_km - a.r_km), labelled = [];
  map.setAreas(sorted.map(a => { const on = areaOn(a, era), col = AS.regionColor(a.region);
    const lab = on && a.label && !labelled.some(q => AS.geo.havKm(a.lon, a.lat, q.lon, q.lat) < Math.max(a.r_km, q.r_km) * .45); if (lab) labelled.push(a);
    return on ? { lon:a.lon, lat:a.lat, r_km:a.r_km, color:col, alpha:.2, label:lab ? a.label : null, labelColor:AS.theme.light ? AS.theme.css("--map-label") : null } : { lon:a.lon, lat:a.lat, r_km:a.r_km, color:AS.theme.css("--faint") || "#5d627a", alpha:AS.theme.light ? .05 : .03, dashed:true }; }));
  const n = s.areas.filter(a => areaOn(a, era)).length;
  if (M.readout) M.readout.textContent = era == null ? `all periods · ${s.areas.length} area${s.areas.length > 1 ? "s" : ""}` : n ? `${AS.eraLabel(era)} · ${n} of ${s.areas.length} active` : `${AS.eraLabel(era)} · not in use`;
}

/* ================= World by era ================= */
function buildWorld(){
  M.body.className = "sc-body sc-world";
  const barHost = h("div.sc-w-bar"), stage = h("div.stage"), side = h("div.side.sc-w-side");
  M.body.append(barHost, h("div.split.sc-w-split", {}, stage, side)); M.wSide = side;
  if (M.st.era == null){ M.st.era = 13; AS.setParams({ era:"13" }); }
  M.worldBar = AS.ui.eraBar(barHost, { value:M.st.era, allowAll:false, values:null, play:true, ages:true, log:false, tipUnit:"scripts in use", playMs:1500, onChange:i => setState({ era:i }) });
  M.worldMap = AS.createMap(stage, { year:AS.ERA2MAP[M.st.era], mode:"quiet", controls:true });
  M.worldMap.on("click", ev => { if (ev.marker && ev.marker.data) select(ev.marker.data.id, true); });
  M.wCap = h("div.glass.sc-w-cap"); stage.append(h("div.map-overlay.tl", {}, M.wCap));
  M.hl = null; drawWorld(true);
}
function worldActive(){ const era = M.st.era; return M.visible.filter(s => inUse(s, era)).map(s => ({ s, areas:s.areas.filter(a => areaOn(a, era)) })).filter(x => x.areas.length); }
function drawWorld(refit){
  const era = M.st.era == null ? 13 : M.st.era; if (M.worldBar.value !== era) M.worldBar.set(era);
  const vals = []; for (let i = 0; i < 20; i++) vals.push(M.visible.filter(s => inUse(s, i) && s.areas.some(a => areaOn(a, i))).length); M.worldBar.setValues(vals);
  M.worldMap.setBase({ year:AS.ERA2MAP[era] });
  const act = worldActive(); M.wAct = act; if (M.hl && !act.some(x => x.s.id === M.hl)) M.hl = null;
  paintWorld();
  if (refit){ const narrowed = M.visible.length < M.all.length, pts = [];
    if (narrowed) for (const s of M.visible) for (const a of s.areas){ if (M.st.region && a.region !== M.st.region) continue; pts.push([a.lon, a.lat]); for (const b of [0, 90, 180, 270]) pts.push(AS.geo.dest(a.lon, a.lat, b, Math.min(a.r_km, 3000))); }
    if (pts.length) M.worldMap.fit(pts, { pad:70, maxZoom:6, ms:AS.still ? 0 : 600 }); else M.worldMap.reset(AS.still ? 0 : 500); }
  M.wCap.innerHTML = ""; M.wCap.append(h("div.eyebrow", {}, AS.ageOf(era).name), h("div.sc-w-era", { style:{ color:AS.theme.id === "night" ? AS.eraColor(era) : `color-mix(in srgb,${AS.eraColor(era)} 72%,var(--mix))` } }, AS.eraLabel(era)),
    h("div.sc-w-n", {}, h("b.mono", {}, String(act.length)), act.length === 1 ? " script in use" : " scripts in use"), h("div.faint.sc-w-b", {}, "borders c. " + AS.mapKeyLabel(AS.ERA2MAP[era])));
  /* side list, grouped by region */
  const side = M.wSide; side.innerHTML = "";
  side.append(h("div.sc-w-head", {}, h("div.eyebrow", {}, "Could be written on it"), h("h3", {}, AS.eraLabel(era)),
    h("p.muted", {}, act.length ? "Every script with a foothold somewhere in this era. Click one for its tells." : "No script in this set was in use" + (M.st.region || M.st.family || M.st.q ? " under these filters." : ". An unlettered object is no surprise here."))));
  for (const R of AS.REGIONS){ const rows = act.filter(x => x.areas.some(a => a.region === R.id)); if (!rows.length) continue;
    side.append(h("div.sc-w-group", {}, h("span.tag", { style:{ "--c":R.color } }, R.name), h("span.sc-famn.mono", {}, String(rows.length))));
    for (const x of rows){ const s = x.s, where = x.areas.filter(a => a.region === R.id).map(a => a.label).filter(Boolean).join(", ");
      side.append(h("div.sc-w-row", { role:"button", tabindex:"0", data:{ id:s.id }, onclick:() => select(s.id, true), onkeydown:e => { if (e.key === "Enter"){ e.stopPropagation(); select(s.id, true); } },
        onmouseenter:() => { M.hl = s.id; paintWorld(); }, onmouseleave:() => { if (M.hl === s.id){ M.hl = null; paintWorld(); } } },
        h("div.sc-w-spec" + (isVlr(s) ? ".sc-tile-vert" : ""), {}, hasSpec(s) ? glyphs(s, { size:24, lines:1, flat:true }) : hatch("", "")),
        h("div.sc-w-txt", {}, h("div.sc-w-name", { title:s.name }, shortName(s)), h("div.sc-w-where", { title:where }, where || s.family)), spanChip(s.from, s.to))); } }
}
function paintWorld(){
  if (!M || !M.worldMap) return; const act = M.wAct || [], hl = M.hl, areas = [], markers = [];
  for (const x of act){ const s = x.s, sorted = x.areas.slice().sort((a, b) => b.r_km - a.r_km), labelled = [], on = hl === s.id;
    for (const a of sorted){ const col = AS.regionColor(a.region);
      areas.push({ lon:a.lon, lat:a.lat, r_km:a.r_km, color:col, alpha:hl ? (on ? .36 : .04) : .11, _r:a.r_km });
      const lab = !labelled.some(q => AS.geo.havKm(a.lon, a.lat, q.lon, q.lat) < Math.max(2600, Math.max(a.r_km, q.r_km) * 1.3)); if (lab) labelled.push(a);
      const tip = `<div class="t">${AS.esc(s.name)}</div>` + (hasSpec(s) && !isVlr(s) ? `<div dir="${s.dir === "rtl" ? "rtl" : "ltr"}" style="font-family:${AS.esc(fontStack(s.font || s.fallbackFont))};${s.dir === "rtl" && !RTL_CHARS.test(s.sample) ? "unicode-bidi:bidi-override;" : ""}font-size:26px;line-height:1.7;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${AS.esc(s.sample)}</div>` : "") +
        `<div class="s">${AS.esc(a.label || AS.region(a.region).short)} · ${AS.esc(a.to >= 1950 ? AS.fmtYear(a.from) + " → now" : AS.rangeLabel(a.from, a.to))}</div>`;
      markers.push({ id:s.id + ":" + areas.length, lon:a.lon, lat:a.lat, r:on ? 5 : 3.2, color:col, fill:1, fixed:true, label:lab ? shortName(s) : null, labelAlways:on && lab, priority:(on ? 1e6 : 0) + a.r_km, tip, data:{ id:s.id } }); } }
  areas.sort((a, b) => b._r - a._r); M.worldMap.setAreas(areas); M.worldMap.setMarkers(markers);
}

/* ================= Name that script ================= */
function openQuiz(){
  if (!M || M.quiz) return; const pool = M.all.filter(hasSpec);
  if (pool.length < 4){ AS.toast("Not enough specimens to quiz on yet."); return; }
  const n = Math.min(10, pool.length), ids = AS.shuffle(AS.srs.order("scripts", pool.map(s => s.id)).slice(0, n));
  const q = M.quiz = { ids, i:0, score:0, res:[], answered:false, box:h("div.sc-quiz") };
  q.modal = AS.modal(q.box, { width:680, onClose:() => { if (M && M.quiz === q) M.quiz = null; } });
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  quizAsk();
}
function quizOptions(s){
  const out = [], add = x => { if (x && x.id !== s.id && !out.includes(x) && out.length < 3) out.push(x); };
  for (const c of AS.shuffle(s.confusables)) add(M.byId[c.id]);
  for (const x of AS.shuffle(M.all.filter(o => o.family === s.family))) add(x);
  for (const x of AS.shuffle(M.all.filter(o => o.regions.some(r => s.regions.includes(r))))) add(x);
  for (const x of AS.shuffle(M.all)) add(x);
  return AS.shuffle(out.concat([s]));
}
function quizHead(q){ const dots = h("div.sc-q-dots"); for (let i = 0; i < q.ids.length; i++) dots.append(h("i" + (i < q.res.length ? (q.res[i].ok ? ".ok" : ".no") : i === q.i ? ".cur" : "")));
  return h("div.sc-q-head", {}, h("div", {}, h("div.eyebrow", {}, "Quick test"), h("h3", {}, "Name that script")), dots, h("div.sc-q-score.mono", {}, `${q.score}/${q.res.length}`)); }
function quizAsk(){
  const q = M.quiz, s = M.byId[q.ids[q.i]]; q.answered = false; q.s = s;
  const sty = s.styles.filter(x => hasSpec(x) && x.font && !x.noFont); q.style = sty.length && Math.random() < .4 ? AS.rand(sty) : null;
  const shown = q.style ? { sample:q.style.sample, font:q.style.font || s.font, dir:q.style.dir || s.dir, id:s.id, name:s.name } : s;
  q.opts = quizOptions(s); q.btns = q.opts.map((o, i) => h("button.sc-q-opt", { type:"button", onclick:() => quizAnswer(i) }, h("span.kbd", {}, String(i + 1)), h("span", {}, o.name)));
  q.fb = h("div.sc-q-fb");
  q.box.innerHTML = ""; q.box.append(quizHead(q), h("div.sc-q-stage" + (s.dir === "ttb" ? ".sc-d-vert" : ""), {}, glyphs(shown, { size:s.dir === "ttb" ? 56 : Math.min(96, bigSize(shown.sample)), lines:0, maxCol:270 })),
    h("div.sc-q-opts", {}, q.btns), q.fb);
}
function quizAnswer(i){
  const q = M.quiz; if (!q || q.answered || !q.opts[i]) return; q.answered = true; const s = q.s, pick = q.opts[i], ok = pick.id === s.id;
  q.res.push({ id:s.id, ok, pick:pick.id }); if (ok) q.score++;
  q.btns.forEach((b, j) => { b.disabled = true; if (q.opts[j].id === s.id) b.classList.add("ok"); else if (j === i) b.classList.add("no"); else b.classList.add("off"); });
  AS.log.add({ mode:"scripts-quick", kind:"name", region:s.regions[0] || null, ok, ref:s.id, pts:ok ? 5000 : 0, max:5000 }); AS.srs.grade("scripts", s.id, ok);
  const conf = s.confusables.find(c => c.id === pick.id) || (M.byId[pick.id] && M.byId[pick.id].confusables.find(c => c.id === s.id));
  const how = !ok && conf && conf.how ? conf.how : q.style && q.style.look ? `${q.style.name}: ${q.style.look}` : s.look[0] || s.infer || "";
  const last = q.i >= q.ids.length - 1;
  q.fb.append(h("div.sc-q-verdict" + (ok ? ".ok" : ".no"), {}, h("span.sc-q-mark", {}, ok ? "✓" : "✕"), h("b", {}, ok ? s.name : `${s.name}, not ${pick.name}`), spanChip(s.from, s.to), s.regions.slice(0, 2).map(r => AS.ui.regionTag(r))),
    how ? h("p.sc-q-how", {}, h("span.eyebrow", {}, "How to tell "), how) : null,
    h("div.sc-q-actions", {}, h("button.btn.ghost.sm", { type:"button", onclick:() => { const id = s.id; q.modal.close(); select(id, true); } }, "Open specimen"),
      h("button.btn.primary", { type:"button", onclick:quizNext }, last ? "See score" : "Next", h("span.kbd.sc-q-enter", {}, "Enter"))));
  const head = q.box.querySelector(".sc-q-head"); if (head) head.replaceWith(quizHead(q));
}
function quizNext(){ const q = M.quiz; if (!q || !q.answered) return; if (q.i >= q.ids.length - 1) return quizEnd(); q.i++; quizAsk(); }
function quizEnd(){
  const q = M.quiz, n = q.ids.length, miss = q.res.filter(r => !r.ok); q.done = true;
  const line = q.score === n ? "Clean sweep. The scribes approve." : q.score >= n * .7 ? "Solid. The misses below are worth a second look." : q.score >= n * .4 ? "Halfway literate. Open the ones you missed." : "Everyone starts as an illiterate. Open a few and look again.";
  q.box.innerHTML = ""; q.box.append(quizHead(q), h("div.sc-q-end", {}, h("div.pts", {}, String(q.score), h("small", {}, "/ " + n)), h("p", {}, line)),
    miss.length ? h("div.sc-q-miss", {}, h("div.section-title", {}, h("h4", {}, "Missed"))) : null);
  const mh = q.box.querySelector(".sc-q-miss");
  if (mh) for (const r of miss){ const s = M.byId[r.id], p = M.byId[r.pick];
    mh.append(h("div.sc-w-row", { role:"button", tabindex:"0", onclick:() => { q.modal.close(); select(s.id, true); } }, h("div.sc-w-spec" + (isVlr(s) ? ".sc-tile-vert" : ""), {}, glyphs(s, { size:24, lines:1, flat:true })),
      h("div.sc-w-txt", {}, h("div.sc-w-name", {}, s.name), h("div.sc-w-where", {}, p ? "you said " + p.name : "")), spanChip(s.from, s.to))); }
  q.box.append(h("div.sc-q-actions", {}, h("button.btn.ghost.sm", { type:"button", onclick:() => q.modal.close() }, "Done"),
    h("button.btn.primary", { type:"button", onclick:() => { q.modal.close(); openQuiz(); } }, "Go again", h("span.kbd.sc-q-enter", {}, "Enter"))));
}

/* ================= keyboard ================= */
function onKey(e){
  if (!M || e.metaKey || e.ctrlKey || e.altKey) return; const t = e.target, typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  if (M.quiz){ const q = M.quiz; if (typing) return;
    if (/^[1-4]$/.test(e.key) && !q.done){ e.preventDefault(); quizAnswer(+e.key - 1); }
    else if (e.key === "Enter" || e.key === " "){ if (t && t.tagName === "BUTTON" && q.box.contains(t) && !t.classList.contains("sc-q-opt")) return; e.preventDefault(); if (q.done){ q.modal.close(); openQuiz(); } else quizNext(); }
    return; }
  if (typing || document.querySelector(".modal-back")) return;
  if (e.key === "/"){ e.preventDefault(); M.search.focus(); M.search.select(); return; }
  if (e.key === "t" || e.key === "T"){ e.preventDefault(); openQuiz(); return; }
  if (M.st.view !== "specimens") return;
  if (e.key === "ArrowRight" || e.key === "j"){ e.preventDefault(); moveCursor(1); }
  else if (e.key === "ArrowLeft" || e.key === "k"){ e.preventDefault(); moveCursor(-1); }
  else if (e.key === "Enter"){ if (t && (t.tagName === "BUTTON" || t.tagName === "A")) return; const id = M.cursor || (M.visible[0] && M.visible[0].id); if (id && id !== M.st.id){ e.preventDefault(); select(id, true); } }
  else if (e.key === "Escape" && M.st.id){ setState({ id:"" }); }
}

AS.views.scripts = { title:"Scripts", ownsDigits:true, mount, update(params){ if (M) apply(params); }, unmount };
})();
