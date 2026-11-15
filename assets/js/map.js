/* Anthropeum Study — shared map engine.
   AS.createMap(host, opts) → map. Canvas-rendered Equal Earth world with period borders.

   const map = AS.createMap(hostEl, {
     year: "2000",            // border snapshot key (see AS.ERA2MAP / AS.MODERN_MAP)
     mode: "quiet",           // "quiet" = one-tone land + hairline borders; "polities" = each named polity gets its own colour
     controls: true,          // +/−/reset buttons
     featureTip: f => html,   // optional: tooltip for hovered polity (f = {name, sub})
     crosshair: false         // crosshair cursor (pin-drop quizzes)
   });
   map.setBase({ year, mode })                       change border snapshot / colouring
   map.setMarkers([{ id, lon, lat, r, color, label, priority, tip, shape, glow, ring, fill, selected, pulse, labelAlways, inert, fixed, data }])
        pulse: true → expanding ring for ~4.5 s after each setMarkers call, then a static ring. inert: ignore pointer. fixed: don't grow with zoom.
        r in CSS px. shape: "circle" (default) | "diamond" | "pin". glow: true → luminous halo. tip: html string for hover tooltip.
   map.setAreas([{ lon, lat, r_km, color, label, alpha }])   geographic circles (true km radius)
   map.setArcs([{ from:[lon,lat], to:[lon,lat], color, width, t, label, dashed }])  great-circle arcs; t = 0..1 draw progress (default 1), arrowhead at tip
   map.setHeat(null | { points:[{lon,lat,w}], color })       soft additive glow field
   map.on("click", ({ lon, lat, marker, feature, x, y }) => …)   marker = the marker object under the pointer (or null)
   map.on("hover", ({ marker, feature, x, y }) => …)
   map.flyTo(lon, lat, zoom = 3, ms = 700)   zoom is relative to the fitted world (1 = whole world)
   map.fit(points:[[lon,lat],…], { pad = 80, maxZoom = 8, ms = 700 })
   map.reset(ms)   map.project(lon,lat) → [x,y] CSS px   map.unproject(x,y) → [lon,lat]
   map.setCrosshair(bool)   map.redraw()   map.destroy()
   Marker/area/arc arrays are replaced wholesale on each set* call; call again to update. */
(function(){
"use strict";
const AS = window.AS;
const RAD = Math.PI / 180, A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
function project(lon, lat){ const l = lon * RAD, t = Math.asin(M * Math.sin(lat * RAD)), t2 = t * t, t6 = t2 * t2 * t2;
  return [l * Math.cos(t) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))), -t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))]; }
function unproject(x, y){ y = -y; let t = y, d; for (let i = 0; i < 12; i++){ const t2 = t * t, t6 = t2 * t2 * t2;
    d = (t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)) - y) / (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)); t -= d; if (Math.abs(d) < 1e-9) break; }
  const t2 = t * t, t6 = t2 * t2 * t2; const lon = M * x * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)) / Math.cos(t);
  const s = Math.sin(t) / M; return [lon / RAD, Math.asin(Math.max(-1, Math.min(1, s))) / RAD]; }
AS.project = project; AS.unproject = unproject;

const hashStr = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
/* jewel-toned polity fill from its name */
const polityColor = name => { const h = hashStr(name); const hue = h % 360, sat = 38 + (h >> 9) % 22, lig = 30 + (h >> 15) % 12; return `hsl(${hue} ${sat}% ${lig}%)`; };
AS.polityColor = polityColor;

/* per-snapshot geometry cache shared by all map instances */
const geoCache = {};
function buildYear(key){
  if (geoCache[key]) return geoCache[key];
  const fc = (window.AS_DATA.borders || {})[key]; const feats = []; const all = new Path2D();
  if (fc) for (const f of fc.features){ const g = f.geometry; const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates; const path = new Path2D();
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const poly of polys) for (const ring of poly){ for (let i = 0; i < ring.length; i++){ const p = project(ring[i][0], ring[i][1]);
            if (i === 0) path.moveTo(p[0], p[1]); else path.lineTo(p[0], p[1]); if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; } path.closePath(); }
      const name = f.properties.n || ""; feats.push({ path, name, sub:f.properties.s || "", color:name ? polityColor(name) : null, bbox:[x0, y0, x1, y1] }); all.addPath(path); }
  return geoCache[key] = { feats, all };
}
let spherePath = null, gratPath = null, equatorPath = null;
function buildSphere(){ if (spherePath) return; spherePath = new Path2D(); gratPath = new Path2D(); equatorPath = new Path2D();
  const edge = []; for (let lat = -90; lat <= 90; lat += 2) edge.push(project(180, lat)); for (let lat = 90; lat >= -90; lat -= 2) edge.push(project(-180, lat));
  edge.forEach((p, i) => i ? spherePath.lineTo(p[0], p[1]) : spherePath.moveTo(p[0], p[1])); spherePath.closePath();
  for (let lon = -150; lon <= 150; lon += 30){ for (let lat = -90; lat <= 90; lat += 3){ const p = project(lon, lat); lat === -90 ? gratPath.moveTo(p[0], p[1]) : gratPath.lineTo(p[0], p[1]); } }
  for (let lat = -60; lat <= 60; lat += 30){ if (lat === 0) continue; const a = project(-180, lat), b = project(180, lat); gratPath.moveTo(a[0], a[1]); gratPath.lineTo(b[0], b[1]); }
  const a = project(-180, 0), b = project(180, 0); equatorPath.moveTo(a[0], a[1]); equatorPath.lineTo(b[0], b[1]); }

AS.createMap = function(host, opts = {}){
  buildSphere();
  const o = Object.assign({ year:AS.MODERN_MAP, mode:"quiet", controls:true, crosshair:false, featureTip:null }, opts);
  const css = getComputedStyle(document.documentElement); const V = n => css.getPropertyValue(n).trim();
  const C = { ocean0:V("--ocean-0") || "#0e1a33", ocean1:V("--ocean-1") || "#070c19", land:V("--land") || "#232c45", landLine:V("--land-line") || "rgba(241,235,221,.2)",
    coast:V("--coast") || "rgba(120,170,255,.16)", grat:V("--grat") || "rgba(160,180,230,.07)", ink:V("--ink") || "#f1ebdd", bg:V("--bg") || "#080b14", gold:V("--gold") || "#ecbd4f",
    font:V("--f-body") || "system-ui", mono:V("--f-mono") || "monospace" };
  const root = AS.h("div.asmap" + (o.crosshair ? ".crosshair" : "")); const base = AS.h("canvas"), over = AS.h("canvas"); root.append(base, over);
  const bx = base.getContext("2d"), ox = over.getContext("2d"); host.append(root);
  let W = 0, H = 0, dpr = 1, k = 1, tx = 0, ty = 0, k0 = 1; // screen = world * k + t
  let markers = [], areas = [], arcs = [], heat = null, hover = null, hoverFeat = null, geo = buildYear(o.year), raf = 0, needBase = true, needOver = true, anim = null, destroyed = false, clock = 0, pulseUntil = 0;
  const handlers = { click:[], hover:[] };
  /* default framing: crop the poles */
  const FRAME = { lon0:-168, lon1:180, lat0:-56, lat1:78 };
  function fitWorld(){ const a = project(FRAME.lon0, 0), b = project(FRAME.lon1, 0), t = project(0, FRAME.lat1), bt = project(0, FRAME.lat0);
    const ww = b[0] - a[0], wh = bt[1] - t[1]; const pad = Math.min(28, W * .03); k0 = Math.min((W - pad * 2) / ww, (H - pad * 2) / wh); return { k:k0, tx:W / 2 - (a[0] + b[0]) / 2 * k0, ty:H / 2 - (t[1] + bt[1]) / 2 * k0 }; }
  function resize(){ const r = root.getBoundingClientRect(); if (!r.width || !r.height) return; const first = !W; const cx = W ? (W / 2 - tx) / k : 0, cy = W ? (H / 2 - ty) / k : 0, rel = W ? k / k0 : 1;
    W = r.width; H = r.height; dpr = Math.min(2.5, window.devicePixelRatio || 1); for (const c of [base, over]){ c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const f = fitWorld(); if (first || rel <= 1.001){ k = f.k; tx = f.tx; ty = f.ty; } else { k = k0 * rel; tx = W / 2 - cx * k; ty = H / 2 - cy * k; } invalidate(true); }
  function clampView(){ const f = k0; k = Math.max(f * .85, Math.min(f * 60, k)); const sx = 2.72 * k, sy = 1.33 * k; tx = Math.max(W * .5 - sx, Math.min(W * .5 + sx, tx)); ty = Math.max(H * .5 - sy, Math.min(H * .5 + sy, ty)); }
  const toScreen = (lon, lat) => { const p = project(lon, lat); return [p[0] * k + tx, p[1] * k + ty]; };
  const toLonLat = (x, y) => unproject((x - tx) / k, (y - ty) / k);
  function invalidate(b){ if (b) needBase = true; needOver = true; if (!raf && !destroyed) raf = requestAnimationFrame(frame); }

  function drawBase(){
    bx.setTransform(dpr, 0, 0, dpr, 0, 0); bx.clearRect(0, 0, W, H);
    bx.setTransform(dpr * k, 0, 0, dpr * k, dpr * tx, dpr * ty);
    /* ocean: sphere-shaped, radial gradient, soft outer glow */
    bx.save(); bx.shadowColor = "rgba(70,120,255,.25)"; bx.shadowBlur = 50 * dpr; const g = bx.createRadialGradient(0, -.2, .2, 0, 0, 2.9); g.addColorStop(0, C.ocean0); g.addColorStop(1, C.ocean1); bx.fillStyle = g; bx.fill(spherePath); bx.restore();
    bx.save(); bx.clip(spherePath);
    bx.lineWidth = 1 / k; bx.strokeStyle = C.grat; bx.stroke(gratPath); bx.setLineDash([4 / k, 5 / k]); bx.strokeStyle = "rgba(236,189,79,.16)"; bx.stroke(equatorPath); bx.setLineDash([]);
    /* coast halo under the land */
    bx.lineJoin = "round"; bx.strokeStyle = C.coast; bx.lineWidth = 7 / k; bx.stroke(geo.all); bx.strokeStyle = "rgba(140,185,255,.10)"; bx.lineWidth = 16 / k; bx.stroke(geo.all);
    const pol = o.mode === "polities";
    for (const f of geo.feats){ bx.fillStyle = pol && f.color ? f.color : C.land; bx.fill(f.path); }
    if (hoverFeat && hoverFeat.name){ bx.fillStyle = "rgba(255,255,255,.14)"; for (const f of geo.feats) if (f.name === hoverFeat.name) bx.fill(f.path); }
    bx.lineWidth = (pol ? .9 : .7) / k; bx.strokeStyle = pol ? "rgba(8,11,20,.75)" : C.landLine; for (const f of geo.feats) bx.stroke(f.path);
    bx.restore();
    bx.lineWidth = 1.2 / k; bx.strokeStyle = "rgba(160,190,255,.22)"; bx.stroke(spherePath);
    /* polity names (polities mode, when zoomed enough for them to fit) */
    if (pol){ bx.setTransform(dpr, 0, 0, dpr, 0, 0); bx.textAlign = "center"; bx.textBaseline = "middle"; const seen = new Set(); const boxes = [];
      const cand = geo.feats.filter(f => f.name).map(f => ({ f, w:(f.bbox[2] - f.bbox[0]) * k, h:(f.bbox[3] - f.bbox[1]) * k })).sort((a, b) => b.w * b.h - a.w * a.h);
      for (const c of cand){ if (seen.has(c.f.name)) continue; const fs = Math.max(10, Math.min(15, c.w / (c.f.name.length * .62))); if (c.w < c.f.name.length * 6.2 || c.h < 16) continue;
        const cx = (c.f.bbox[0] + c.f.bbox[2]) / 2 * k + tx, cy = (c.f.bbox[1] + c.f.bbox[3]) / 2 * k + ty; if (cx < -50 || cx > W + 50 || cy < -20 || cy > H + 20) continue;
        bx.font = `600 ${fs}px ${C.font}`; const tw = bx.measureText(c.f.name).width; const b = [cx - tw / 2 - 4, cy - fs / 2 - 3, cx + tw / 2 + 4, cy + fs / 2 + 3]; if (boxes.some(q => !(b[2] < q[0] || b[0] > q[2] || b[3] < q[1] || b[1] > q[3]))) continue;
        boxes.push(b); seen.add(c.f.name); bx.fillStyle = "rgba(255,255,255,.62)"; bx.strokeStyle = "rgba(8,11,20,.55)"; bx.lineWidth = 3; bx.strokeText(c.f.name, cx, cy); bx.fillText(c.f.name, cx, cy); } }
  }
  function label(ctx, text, x, y, opt = {}){ const fs = opt.size || 12; ctx.font = `${opt.weight || 600} ${fs}px ${C.font}`; ctx.textAlign = opt.align || "center"; ctx.textBaseline = opt.base || "alphabetic";
    ctx.lineJoin = "round"; ctx.lineWidth = 3.5; ctx.strokeStyle = "rgba(6,9,18,.9)"; ctx.strokeText(text, x, y); ctx.fillStyle = opt.color || C.ink; ctx.fillText(text, x, y); }
  function drawOver(){
    ox.setTransform(dpr, 0, 0, dpr, 0, 0); ox.clearRect(0, 0, W, H);
    /* heat field */
    if (heat && heat.points.length){ ox.save(); ox.globalCompositeOperation = "lighter"; for (const p of heat.points){ const s = toScreen(p.lon, p.lat), r = (18 + 46 * Math.sqrt(p.w)) * Math.sqrt(k / k0);
        const g = ox.createRadialGradient(s[0], s[1], 0, s[0], s[1], r); g.addColorStop(0, withAlpha(heat.color || C.gold, .32 * (0.35 + 0.65 * p.w))); g.addColorStop(1, withAlpha(heat.color || C.gold, 0)); ox.fillStyle = g; ox.beginPath(); ox.arc(s[0], s[1], r, 0, 7); ox.fill(); } ox.restore(); }
    /* geographic areas */
    for (const a of areas){ ox.beginPath(); for (let b = 0; b <= 360; b += 6){ const q = AS.geo.dest(a.lon, a.lat, b, a.r_km), s = toScreen(q[0], q[1]); b ? ox.lineTo(s[0], s[1]) : ox.moveTo(s[0], s[1]); } ox.closePath();
      ox.fillStyle = withAlpha(a.color || C.gold, a.alpha == null ? .16 : a.alpha); ox.fill(); ox.lineWidth = 1.4; ox.setLineDash(a.dashed ? [5, 4] : []); ox.strokeStyle = withAlpha(a.color || C.gold, .8); ox.stroke(); ox.setLineDash([]);
      if (a.label){ const s = toScreen(a.lon, a.lat); label(ox, a.label, s[0], s[1] + 4, { color:a.labelColor || "#fff" }); } }
    /* arcs */
    for (const a of arcs){ const pts = AS.geo.arc(a.from[0], a.from[1], a.to[0], a.to[1], 40).map(p => toScreen(p[0], p[1])); const t = a.t == null ? 1 : Math.max(0, Math.min(1, a.t)); if (t <= 0) continue;
      const n = Math.max(1, Math.floor((pts.length - 1) * t)); /* lift the arc off the ground for a "flight path" look */
      const lift = Math.min(60, Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]) * .16); const L = pts.map((p, i) => { const u = i / (pts.length - 1); return [p[0], p[1] - Math.sin(u * Math.PI) * lift]; });
      ox.beginPath(); ox.moveTo(L[0][0], L[0][1]); for (let i = 1; i <= n; i++) ox.lineTo(L[i][0], L[i][1]);
      ox.lineCap = "round"; ox.lineWidth = (a.width || 2) + 4; ox.strokeStyle = withAlpha(a.color || C.gold, .14); ox.stroke(); ox.lineWidth = a.width || 2; ox.setLineDash(a.dashed ? [6, 5] : []); ox.strokeStyle = a.color || C.gold; ox.stroke(); ox.setLineDash([]);
      const e = L[n], p = L[Math.max(0, n - 2)], ang = Math.atan2(e[1] - p[1], e[0] - p[0]); ox.fillStyle = a.color || C.gold; ox.beginPath(); ox.moveTo(e[0] + Math.cos(ang) * 6, e[1] + Math.sin(ang) * 6); ox.lineTo(e[0] + Math.cos(ang + 2.5) * 7, e[1] + Math.sin(ang + 2.5) * 7); ox.lineTo(e[0] + Math.cos(ang - 2.5) * 7, e[1] + Math.sin(ang - 2.5) * 7); ox.closePath(); ox.fill();
      if (a.label && t >= 1){ const m = L[Math.floor(L.length / 2)]; label(ox, a.label, m[0], m[1] - 6, { size:11, color:a.color || C.gold }); } }
    /* markers, largest first so small ones stay clickable on top */
    const zs = Math.pow(k / k0, .28); const order = markers.map(m => { const s = toScreen(m.lon, m.lat); m._x = s[0]; m._y = s[1]; m._r = (m.r || 5) * (m.fixed ? 1 : zs); return m; }).sort((a, b) => b._r - a._r);
    for (const m of order){ if (m._x < -80 || m._x > W + 80 || m._y < -80 || m._y > H + 80) continue; const col = m.color || C.gold, r = m._r, hov = hover === m;
      if (m.glow){ ox.save(); ox.globalCompositeOperation = "lighter"; const g = ox.createRadialGradient(m._x, m._y, r * .2, m._x, m._y, r * 2.4); g.addColorStop(0, withAlpha(col, .42)); g.addColorStop(1, withAlpha(col, 0)); ox.fillStyle = g; ox.beginPath(); ox.arc(m._x, m._y, r * 2.4, 0, 7); ox.fill(); ox.restore(); }
      if (m.pulse){ const ph = performance.now() < pulseUntil ? (clock / 1400 + (m._ph || (m._ph = Math.random()))) % 1 : .45; ox.beginPath(); ox.arc(m._x, m._y, r + ph * 22, 0, 7); ox.strokeStyle = withAlpha(col, .55 * (1 - ph)); ox.lineWidth = 2; ox.stroke(); }
      if (m.shape === "pin"){ const hgt = r * 2.6; ox.beginPath(); ox.moveTo(m._x, m._y); ox.bezierCurveTo(m._x - r * 1.3, m._y - hgt * .55, m._x - r, m._y - hgt, m._x, m._y - hgt); ox.bezierCurveTo(m._x + r, m._y - hgt, m._x + r * 1.3, m._y - hgt * .55, m._x, m._y); ox.closePath();
        ox.fillStyle = col; ox.shadowColor = "rgba(0,0,0,.6)"; ox.shadowBlur = 8; ox.fill(); ox.shadowBlur = 0; ox.lineWidth = 1.6; ox.strokeStyle = "rgba(255,255,255,.9)"; ox.stroke(); ox.beginPath(); ox.arc(m._x, m._y - hgt * .68, r * .36, 0, 7); ox.fillStyle = "rgba(255,255,255,.95)"; ox.fill(); }
      else { ox.beginPath(); if (m.shape === "diamond"){ ox.moveTo(m._x, m._y - r * 1.25); ox.lineTo(m._x + r * 1.25, m._y); ox.lineTo(m._x, m._y + r * 1.25); ox.lineTo(m._x - r * 1.25, m._y); ox.closePath(); } else ox.arc(m._x, m._y, r, 0, 7);
        const g = ox.createRadialGradient(m._x - r * .3, m._y - r * .35, r * .1, m._x, m._y, r * 1.05); const fa = m.fill == null ? (r > 9 ? .55 : .9) : m.fill; g.addColorStop(0, withAlpha(lighten(col), Math.min(1, fa + .25))); g.addColorStop(1, withAlpha(col, fa)); ox.fillStyle = g; ox.fill();
        ox.lineWidth = m.selected ? 2.6 : hov ? 2.2 : 1.2; ox.strokeStyle = m.selected || hov ? "#fff" : (m.ring || withAlpha(lighten(col), .95)); ox.stroke();
        if (m.selected){ ox.beginPath(); ox.arc(m._x, m._y, r + 5, 0, 7); ox.lineWidth = 1.2; ox.strokeStyle = withAlpha(C.gold, .9); ox.stroke(); } }
    }
    /* labels with collision avoidance: selected/always first, then by priority */
    const boxes = []; const cand = markers.filter(m => m.label).sort((a, b) => ((b.selected ? 1e9 : 0) + (b.labelAlways ? 1e8 : 0) + (b.priority != null ? b.priority : b._r)) - ((a.selected ? 1e9 : 0) + (a.labelAlways ? 1e8 : 0) + (a.priority != null ? a.priority : a._r)));
    for (const m of cand){ if (m._x < 0 || m._x > W || m._y < 0 || m._y > H) continue; const fs = m.labelSize || (m._r > 16 ? 13 : 11.5); ox.font = `600 ${fs}px ${C.font}`; const tw = ox.measureText(m.label).width;
      const ly = m.shape === "pin" ? m._y - m._r * 2.6 - 6 : m._y - m._r - 5; const b = [m._x - tw / 2 - 3, ly - fs, m._x + tw / 2 + 3, ly + 3];
      if (!m.labelAlways && !m.selected && hover !== m && boxes.some(q => !(b[2] < q[0] || b[0] > q[2] || b[3] < q[1] || b[1] > q[3]))) continue; boxes.push(b); label(ox, m.label, m._x, ly, { size:fs, color:m.labelColor }); }
  }
  function frame(ts){ raf = 0; if (destroyed) return; clock = ts || 0;
    if (anim){ const u = Math.min(1, (performance.now() - anim.t0) / anim.ms), e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; k = anim.k0 + (anim.k1 - anim.k0) * e; tx = anim.tx0 + (anim.tx1 - anim.tx0) * e; ty = anim.ty0 + (anim.ty1 - anim.ty0) * e; needBase = true; if (u >= 1) anim = null; }
    if (needBase){ drawBase(); needBase = false; } drawOver(); needOver = false;
    if (anim || (performance.now() < pulseUntil && markers.some(m => m.pulse))) raf = requestAnimationFrame(frame); }
  function animateTo(k1, tx1, ty1, ms){ if (!ms){ k = k1; tx = tx1; ty = ty1; clampView(); invalidate(true); return; } anim = { k0:k, tx0:tx, ty0:ty, k1, tx1, ty1, ms, t0:performance.now() }; invalidate(true); }

  /* ---- hit testing ---- */
  function markerAt(x, y){ let best = null, bd = 1e9; for (const m of markers){ if (m._x == null || m.inert) continue; const cy = m.shape === "pin" ? m._y - m._r * 1.5 : m._y; const d = Math.hypot(x - m._x, y - cy), lim = Math.max(m._r, 7) + 3; if (d <= lim && d - m._r * .5 < bd){ bd = d - m._r * .5; best = m; } } return best; }
  function featureAt(x, y){ const wx = (x - tx) / k, wy = (y - ty) / k; bx.save(); bx.setTransform(1, 0, 0, 1, 0, 0); let hit = null;
    for (let i = geo.feats.length - 1; i >= 0; i--){ const f = geo.feats[i], b = f.bbox; if (wx < b[0] || wx > b[2] || wy < b[1] || wy > b[3]) continue; if (bx.isPointInPath(f.path, wx, wy)){ hit = f; break; } } bx.restore(); return hit; }
  const local = ev => { const r = root.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };

  /* ---- pointer interaction ---- */
  const ptrs = new Map(); let drag = null, pinch = null, moved = 0;
  root.addEventListener("pointerdown", ev => { if (ev.target.closest(".zoomctl")) return; root.setPointerCapture(ev.pointerId); ptrs.set(ev.pointerId, local(ev)); anim = null; moved = 0;
    if (ptrs.size === 1){ drag = { x:ev.clientX, y:ev.clientY, tx, ty }; } else if (ptrs.size === 2){ const [a, b] = [...ptrs.values()]; pinch = { d:Math.hypot(a[0] - b[0], a[1] - b[1]), k, cx:(a[0] + b[0]) / 2, cy:(a[1] + b[1]) / 2, tx, ty }; drag = null; } });
  root.addEventListener("pointermove", ev => { const p = local(ev);
    if (ptrs.has(ev.pointerId)) ptrs.set(ev.pointerId, p);
    if (pinch && ptrs.size === 2){ const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), nk = pinch.k * d / pinch.d; const wx = (pinch.cx - pinch.tx) / pinch.k, wy = (pinch.cy - pinch.ty) / pinch.k; k = nk; clampView(); tx = (a[0] + b[0]) / 2 - wx * k; ty = (a[1] + b[1]) / 2 - wy * k; clampView(); moved = 99; invalidate(true); return; }
    if (drag){ const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y; moved = Math.max(moved, Math.hypot(dx, dy)); if (moved > 3){ root.classList.add("dragging"); tx = drag.tx + dx; ty = drag.ty + dy; clampView(); AS.tip.hide(); invalidate(true); } return; }
    const m = markerAt(p[0], p[1]); const f = (!m && (o.featureTip || handlers.hover.length || o.mode === "polities")) ? featureAt(p[0], p[1]) : null;
    if (m !== hover){ hover = m; invalidate(false); } if (o.mode === "polities" && f !== hoverFeat){ hoverFeat = f; invalidate(true); }
    root.style.cursor = m ? "pointer" : "";
    if (m && m.tip) AS.tip.show(ev, m.tip); else if (f && o.featureTip){ const html = o.featureTip({ name:f.name, sub:f.sub }); html ? AS.tip.show(ev, html) : AS.tip.hide(); } else AS.tip.hide();
    for (const h of handlers.hover) h({ marker:m, feature:f ? { name:f.name, sub:f.sub } : null, x:p[0], y:p[1] }); });
  const up = ev => { const had = ptrs.has(ev.pointerId); ptrs.delete(ev.pointerId); root.classList.remove("dragging"); if (ptrs.size < 2) pinch = null;
    if (had && drag && moved <= 3 && ev.type === "pointerup"){ const p = local(ev), m = markerAt(p[0], p[1]), ll = toLonLat(p[0], p[1]); const f = featureAt(p[0], p[1]);
      for (const h of handlers.click) h({ lon:ll[0], lat:ll[1], marker:m, feature:f ? { name:f.name, sub:f.sub } : null, x:p[0], y:p[1] }); }
    drag = null; };
  root.addEventListener("pointerup", up); root.addEventListener("pointercancel", up);
  root.addEventListener("pointerleave", () => { if (hover){ hover = null; invalidate(false); } if (hoverFeat){ hoverFeat = null; invalidate(true); } AS.tip.hide(); for (const h of handlers.hover) h({ marker:null, feature:null }); });
  function zoomAt(x, y, f, ms){ const nk = Math.max(k0 * .85, Math.min(k0 * 60, k * f)), wx = (x - tx) / k, wy = (y - ty) / k; const ntx = x - wx * nk, nty = y - wy * nk; if (ms) animateTo(nk, ntx, nty, ms); else { k = nk; tx = ntx; ty = nty; clampView(); invalidate(true); } }
  root.addEventListener("wheel", ev => { ev.preventDefault(); const p = local(ev); anim = null; zoomAt(p[0], p[1], Math.exp(-ev.deltaY * (ev.ctrlKey ? .012 : .0018))); }, { passive:false });
  root.addEventListener("dblclick", ev => { const p = local(ev); zoomAt(p[0], p[1], 2, 300); });
  if (o.controls){ const z = AS.h("div.zoomctl", {}, AS.h("button", { type:"button", title:"Zoom in", onclick:() => zoomAt(W / 2, H / 2, 1.7, 250) }, "+"), AS.h("button", { type:"button", title:"Zoom out", onclick:() => zoomAt(W / 2, H / 2, 1 / 1.7, 250) }, "−"), AS.h("button", { type:"button", title:"Reset view", onclick:() => api.reset(500) }, "⟲")); root.append(z); }
  const ro = new ResizeObserver(resize); ro.observe(root);

  const api = {
    el:root,
    setBase(b){ if (b.year && b.year !== o.year){ o.year = b.year; geo = buildYear(o.year); hoverFeat = null; } if (b.mode) o.mode = b.mode; if ("featureTip" in b) o.featureTip = b.featureTip; invalidate(true); return api; },
    setMarkers(a){ markers = a || []; hover = null; pulseUntil = AS.still ? 0 : performance.now() + 4500; invalidate(false); return api; },
    setAreas(a){ areas = a || []; invalidate(false); return api; },
    setArcs(a){ arcs = a || []; invalidate(false); return api; },
    setHeat(h){ heat = h; invalidate(false); return api; },
    on(ev, fn){ (handlers[ev] = handlers[ev] || []).push(fn); return api; },
    flyTo(lon, lat, zoom = 3, ms = 700){ const p = project(lon, lat), nk = k0 * zoom; animateTo(nk, W / 2 - p[0] * nk, H / 2 - p[1] * nk, ms); return api; },
    fit(points, { pad = 80, maxZoom = 8, ms = 700 } = {}){ if (!points || !points.length) return api; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of points){ const p = project(q[0], q[1]); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      const nk = Math.max(k0, Math.min(k0 * maxZoom, Math.min((W - pad * 2) / Math.max(1e-6, x1 - x0), (H - pad * 2) / Math.max(1e-6, y1 - y0)))); animateTo(nk, W / 2 - (x0 + x1) / 2 * nk, H / 2 - (y0 + y1) / 2 * nk, ms); return api; },
    reset(ms = 0){ const f = fitWorld(); animateTo(f.k, f.tx, f.ty, ms); return api; },
    project:toScreen, unproject:toLonLat,
    get zoom(){ return k / k0; },
    setCrosshair(b){ root.classList.toggle("crosshair", !!b); return api; },
    redraw(){ invalidate(true); return api; },
    destroy(){ destroyed = true; cancelAnimationFrame(raf); ro.disconnect(); root.remove(); AS.tip.hide(); }
  };
  resize(); return api;
};

/* ---- colour utils ---- */
const cctx = document.createElement("canvas").getContext("2d"); const ccache = {};
function rgb(c){ if (ccache[c]) return ccache[c]; cctx.fillStyle = "#000"; cctx.fillStyle = c; const s = cctx.fillStyle; let r;
  if (s[0] === "#") r = [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]; else { const m = s.match(/[\d.]+/g) || [0, 0, 0]; r = [+m[0], +m[1], +m[2]]; } return ccache[c] = r; }
function withAlpha(c, a){ const r = rgb(c); return `rgba(${r[0]},${r[1]},${r[2]},${a})`; }
function lighten(c, f = .35){ const r = rgb(c); return `rgb(${Math.round(r[0] + (255 - r[0]) * f)},${Math.round(r[1] + (255 - r[1]) * f)},${Math.round(r[2] + (255 - r[2]) * f)})`; }
AS.color = { rgb, withAlpha, lighten };
})();
