/* Anthropeum Study — themes. Loaded right after core.js, before map.js and the rooms.
   <html data-theme data-mode> is set before first paint by the boot script in index.html (default vellum / light);
   CSS tokens for each theme live in assets/css/themes.css. This file swaps the era and region colour scales to
   match (light pages need darker, ink-like data colours) and adds the theme picker to the rail.
   AS.theme = { id, mode, light, list, set(id, mode), css(name) }.   Switching reloads the page, because canvases
   and rooms read colours when they are created. */
(function(){
"use strict";
const AS = window.AS, root = document.documentElement;
const THEMES = [
  { id:"vellum", name:"Vellum Atlas", note:"Paper, ink and serif type", modes:true, sw:{ light:["#f3ead6", "#8f2a21", "#21180f"], dark:["#16120c", "#d9a441", "#f0e5cc"] } },
  { id:"label",  name:"Museum Label", note:"White wall, black sans, colour only on data", modes:true, sw:{ light:["#ffffff", "#e63312", "#111214"], dark:["#0d0e10", "#ff5a36", "#f2f2ee"] } },
  { id:"night",  name:"Night Gallery", note:"Navy and gold; dark only", modes:false, sw:{ dark:["#080b14", "#ecbd4f", "#f1ebdd"] } }
];
const id = THEMES.some(t => t.id === root.dataset.theme) ? root.dataset.theme : "vellum";
const def = THEMES.find(t => t.id === id);
const mode = def.modes ? (root.dataset.mode === "dark" ? "dark" : "light") : "dark";
root.dataset.theme = id; root.dataset.mode = mode;

/* ---- data colour scales ---- */
const ramp = anchors => { const A = anchors.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))), out = [];
  for (let i = 0; i < 20; i++){ const u = i / 19 * (A.length - 1), a = Math.min(A.length - 2, Math.floor(u)), f = u - a;
    out.push("#" + A[a].map((v, j) => Math.round(v + (A[a + 1][j] - v) * f).toString(16).padStart(2, "0")).join("")); } return out; };
const ERA = {
  "vellum.light": ramp(["#b9831c", "#b5532a", "#8f2a21", "#742a52", "#3a3478", "#235a8a", "#2a7d6c", "#5c8a3c"]),   /* printing inks: ochre → sienna → oxblood → mulberry → indigo → Prussian blue → verdigris → moss */
  "label.light":  ramp(["#b07d00", "#cf5a12", "#cf2b3e", "#b4309a", "#6a4bd6", "#2468d8", "#0a8fa6", "#0a9460"])
};
const REG_LIGHT = { eas:"#c2362a", sas:"#d08a1c", sea:"#2f8a55", cas:"#8a6a45", wan:"#1b7f95", egy:"#b99a1f", ssa:"#c2602b",
  eur_s:"#6a4ea2", eur_nw:"#2f5ea8", eur_e:"#a0447d", nam:"#5d7d8e", mes:"#7c962b", and:"#c8557b", oce:"#35a798" };
const key = id + "." + mode;
if (ERA[key]) AS.ERA_COLORS = ERA[key];
if (mode === "light") for (const r of AS.REGIONS) if (REG_LIGHT[r.id]) r.color = REG_LIGHT[r.id];

const css = name => getComputedStyle(root).getPropertyValue(name).trim();
const store = (k, v) => { try { localStorage.setItem(k, v); } catch(e){} };
AS.theme = { id, mode, light:mode === "light", list:THEMES, css,
  set(nid, nmode){ const t = THEMES.find(x => x.id === nid) || def; store("anthro.theme", t.id); store("anthro.mode", t.modes ? (nmode === "dark" ? "dark" : "light") : "dark"); location.reload(); } };

/* ---- picker in the rail ---- */
function mount(){
  const rail = document.getElementById("rail"); if (!rail || rail.querySelector(".theme-btn")) return; const h = AS.h;
  const btn = h("button.theme-btn", { type:"button", title:"Theme", "aria-haspopup":"dialog" }, h("svg", { viewBox:"0 0 24 24" }, h("circle", { cx:"12", cy:"12", r:"9" }), h("path", { d:"M12 3a9 9 0 0 0 0 18z", fill:"currentColor", stroke:"none" })), "Theme");
  let pop = null;
  const close = () => { if (pop){ pop.remove(); pop = null; document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", onKey); } };
  const outside = e => { if (pop && !pop.contains(e.target) && !btn.contains(e.target)) close(); };
  const onKey = e => { if (e.key === "Escape") close(); };
  const open = () => { if (pop) return close();
    const sw = (t, m) => { const c = t.sw[m] || t.sw.dark; return h("span.theme-sw", {}, c.map(x => h("i", { style:{ background:x } }))); };
    pop = h("div.theme-pop", { role:"dialog", "aria-label":"Theme" }, h("h4", {}, "Theme"),
      THEMES.map(t => h("button.theme-opt" + (t.id === id ? ".on" : ""), { type:"button", onclick:() => AS.theme.set(t.id, t.modes ? mode : "dark") }, sw(t, t.modes ? mode : "dark"), h("span", {}, t.name, h("small", {}, t.note)), h("span.tick", {}, t.id === id ? "✓" : ""))),
      h("div.theme-mode", {}, h("span", {}, def.modes ? "Appearance" : "Night Gallery has no light mode"),
        (() => { const seg = h("div.seg"); for (const m of ["light", "dark"]) seg.append(h("button" + (m === mode ? ".on" : ""), { type:"button", disabled:!def.modes, onclick:() => { if (m !== mode) AS.theme.set(id, m); } }, m === "light" ? "Light" : "Dark")); return seg; })()));
    document.body.append(pop); document.addEventListener("pointerdown", outside, true); document.addEventListener("keydown", onKey); };
  btn.addEventListener("click", open);
  const streak = rail.querySelector(".streak"); rail.insertBefore(btn, streak || null);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
