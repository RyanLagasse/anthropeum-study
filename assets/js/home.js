/* Desk — the landing room: a living "world through time" hero, today's three things, the rooms, a calibration snapshot. */
(function(){
"use strict";
const AS = window.AS, h = AS.h, D = window.AS_DATA;
const dayIndex = () => { const d = new Date(); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 0, 1)) / 864e5); };
const pick = (arr, salt) => arr && arr.length ? arr[((dayIndex() * 2654435761 + salt * 40503) >>> 0) % arr.length] : null;
const tells = () => (D.tells && D.tells.tells) || [], looks = () => (D.tells && D.tells.lookalikes) || [];
const scripts = () => ((D.scripts && D.scripts.scripts) || []), techs = () => (D.techniques && D.techniques.techniques) || [], gallery = () => (D.gallery && D.gallery.objects) || [];
function ensureFonts(){ const f = D.scripts && D.scripts.fontsCss; if (!f) return; for (const u of [].concat(f)) if (!document.querySelector(`link[href="${u}"]`)) document.head.append(h("link", { rel:"stylesheet", href:u })); }

AS.views.home = {
  title:"Desk",
  mount(el){
    let era = AS.still ? 12 : (dayIndex() % 20 + 20) % 20, timer = null;
    /* ---------- hero ---------- */
    const stage = h("div.hm-stage"), eraName = h("div.hm-era-name"), eraAge = h("div.hm-era-age"), powers = h("div.hm-powers");
    const barHost = h("div.hm-bar");
    const hero = h("section.hm-hero", {}, stage, h("div.hm-scrim"),
      h("div.hm-copy", {},
        h("div.eyebrow", {}, "Anthropeum study desk"),
        h("h1", { html:"Learn the world,<br><em>not the catalogue.</em>" }),
        h("p.hm-lede", {}, "Where and when things were made: priors, tells, scripts and first appearances. Practised on a held-out set, because you don't train on the test set."),
        h("div.row.wrap", { style:{ gap:"12px", marginTop:"6px" } },
          h("a.btn.primary.lg", { href:AS.href("practice", { mode:"place" }) }, "Play a round"),
          h("a.btn.lg", { href:AS.href("atlas") }, "Open the Atlas")),
        h("div.hm-rule", {}, h("span.hm-rule-dot"), h("span", { html:"<b>0</b> Met objects shown anywhere on this site. Aggregate counts only." }))),
      h("div.hm-now", {}, h("div.eyebrow", {}, "The world in"), eraName, eraAge, powers),
      barHost);
    const map = this.map = AS.createMap(stage, { year:AS.ERA2MAP[era], mode:"polities", controls:false });
    const showEra = i => { era = i; map.setBase({ year:AS.ERA2MAP[i] });
      const ems = ((D.empires && D.empires.eras[i]) || { empires:[] }).empires;
      map.setMarkers(ems.map(e => ({ lon:e.lon, lat:e.lat, r:3 + e.strength * 2.2, shape:"diamond", color:"#f7d98b", label:e.strength >= 2 ? e.name : null, priority:e.strength, glow:e.strength === 3, tip:`<div class="t">${AS.esc(e.name)}</div><div class="s">${AS.esc(e.note || "")}</div>` })));
      eraName.textContent = AS.eraLabel(i); eraName.style.color = AS.eraColor(i); eraAge.textContent = AS.ageOf(i).name;
      powers.innerHTML = ""; for (const e of ems.filter(e => e.strength === 3).slice(0, 4)) powers.append(h("span.hm-power", {}, e.name)); };
    const stop = () => { clearInterval(timer); timer = null; };
    const bar = AS.ui.eraBar(barHost, { value:era, allowAll:false, compact:true, ages:false, onChange:i => { stop(); showEra(i); } });
    showEra(era);
    if (!AS.still) timer = setInterval(() => { if (!document.hidden){ const n = (era + 1) % 20; bar.set(n); showEra(n); } }, 3200);
    stage.addEventListener("pointerdown", stop);
    this._stop = stop;

    /* ---------- today ---------- */
    ensureFonts();
    const tell = pick(tells().filter(t => t.strength >= 2), 1), script = pick(scripts().filter(s => s.sample && !s.noFont && !s.noUnicode), 2), tech = pick(techs(), 3);
    const today = h("div.grid.c3.hm-today");
    if (tell){ const ans = h("div.hm-cover", { role:"button", tabindex:"0" }, h("span", {}, "What does it tell you?"), h("span.kbd", {}, "click"));
      const reveal = () => { ans.replaceWith(h("div.hm-answer", {}, h("p", {}, tell.infer), tell.caveat ? h("p.hm-caveat", {}, h("b", {}, "Misleads when: "), tell.caveat) : null)); };
      ans.onclick = reveal; ans.onkeydown = e => { if (e.key === "Enter" || e.key === " "){ e.preventDefault(); reveal(); } };
      today.append(h("div.card.gilt.hm-day", { style:{ "--c":AS.regionColor(tell.place && tell.place.region) } }, h("div.eyebrow", {}, "Tell of the day"), h("h3", {}, tell.title), h("p.hm-cue", {}, tell.cue), ans,
        h("div.row.between.hm-day-foot", {}, h("span.row", {}, tell.place ? AS.ui.regionTag(tell.place.region) : null, AS.ui.pips(tell.strength || 1)), h("a", { href:AS.href("tells", { id:tell.id }) }, "Open in Tells →")))); }
    if (script){ today.append(h("div.card.gilt.hm-day", { style:{ "--c":"#22b5c9" } }, h("div.eyebrow", {}, "Script of the day"),
        h("div.hm-specimen", { dir:script.dir === "rtl" ? "rtl" : null, style:{ fontFamily:`"${script.font}", serif` } }, script.sample),
        h("h3", {}, script.name), h("p.hm-cue", {}, script.infer || (script.look || [])[0] || ""),
        h("div.row.between.hm-day-foot", {}, AS.ui.yearChip(script.from, script.to), h("a", { href:AS.href("scripts", { id:script.id }) }, "Open in Scripts →")))); }
    if (tech){ today.append(h("div.card.gilt.hm-day", { style:{ "--c":AS.eraColor(AS.eraOf(tech.origin.year)) } }, h("div.eyebrow", {}, "Earliest possible"), h("h3", {}, tech.name), h("p.hm-rule-text", {}, tech.rule),
        h("div.row.between.hm-day-foot", {}, h("span.row", {}, AS.ui.yearChip(tech.origin.year), AS.ui.regionTag(tech.origin.region)), h("a", { href:AS.href("when", { id:tech.id }) }, "Open in When →")))); }
    if (!today.children.length) today.append(h("div.card.empty", { style:{ gridColumn:"1 / -1" } }, "Today's cards appear once the tells, scripts and techniques data is packed."));

    /* ---------- rooms ---------- */
    const art = {
      atlas(){ const s = h("div.hm-art.atlas"); const pts = [[18, 52, 16, "#8fb9c9"], [46, 38, 22, "#5d8ff2"], [52, 58, 10, "#edd15a"], [70, 44, 14, "#ef5350"], [62, 62, 7, "#f6a821"], [30, 72, 8, "#f06f9b"], [80, 70, 6, "#4dd6c1"], [56, 76, 6, "#e07a3f"]];
        for (const p of pts) s.append(h("i", { style:{ left:p[0] + "%", top:p[1] + "%", width:p[2] * 2 + "px", height:p[2] * 2 + "px", "--c":p[3] } })); return s; },
      when(){ const s = h("div.hm-art.when"); for (let i = 0; i < 12; i++) s.append(h("i", { style:{ left:(4 + i * 7.6) + "%", top:(8 + i * 7) + "%", "--c":AS.eraColor(Math.round(i * 1.7)) } })); return s; },
      tells(){ const s = h("div.hm-art.tells"); ["#ef5350", "#edd15a", "#22b5c9"].forEach((c, i) => s.append(h("i", { style:{ "--c":c, "--i":i } }, h("b"), h("u"), h("u"), h("u")))); return s; },
      scripts(){ return h("div.hm-art.scripts", {}, h("span", {}, "文"), h("span", {}, "ع"), h("span", {}, "अ"), h("span", {}, "Ω"), h("span", {}, "ᚠ")); },
      practice(){ return h("div.hm-art.practice", {}, h("i"), h("i"), h("i"), h("b")); }
    };
    const n = { tells:tells().length, looks:looks().length, scripts:scripts().length, techs:techs().length, gal:gallery().length };
    const prog = (deck, ids) => { if (!ids.length) return null; const s = AS.srs.summary(deck, ids); return h("div.hm-prog", { title:`${s.known} known · ${s.seen} seen · ${s.total} total` }, h("div.bar", {}, h("i", { style:{ width:(100 * s.known / s.total) + "%" } })), h("span.mono", {}, `${s.known}/${s.total} known`)); };
    const room = (id, name, tag, text, stat, extra) => h("a.card.hover.hm-room", { href:AS.href(id) }, art[id](), h("div.hm-room-body", {}, h("div.eyebrow", {}, tag), h("h3", {}, name), h("p", {}, text), h("div.hm-room-stat.mono", {}, stat), extra || null));
    const rooms = h("div.hm-rooms", {},
      room("atlas", "Atlas", "Base rates", "Where the Met's open-access objects were made, by era, material, instrument and animal. De-biased so 1750–2000 stops drowning everything else.", `${AS.fmtN(D.agg.meta.rows)} objects · 108 places`),
      room("when", "When", "Earliest possible", "What existed when, and when it reached each region. Lower bounds you can apply to the thing in front of you.", n.techs ? `${n.techs} techniques & motifs` : "data pending", prog("when", techs().map(t => t.id))),
      room("tells", "Tells", "Cue → inference", "The random facts that win rounds, as a field guide you can self-test on. Plus the classic lookalike showdowns.", n.tells ? `${n.tells} tells · ${n.looks} lookalike sets` : "data pending", prog("tells", tells().map(t => t.id))),
      room("scripts", "Scripts", "Read the writing", "Writing systems as live specimens: where, when, and what the style says about the date.", n.scripts ? `${n.scripts} writing systems` : "data pending", prog("scripts", scripts().map(t => t.id))),
      room("practice", "Practice", "Validation set", "The real game on objects from Cleveland, Chicago and Minneapolis, plus drills. Your misses turn into a calibration report.", n.gal ? `${n.gal} held-out objects · 0 Met` : "data pending"));

    /* ---------- calibration snapshot ---------- */
    const log = AS.log.all(), scored = log.filter(e => e.max), last = scored.slice(-50);
    const avg = last.length ? Math.round(100 * last.reduce((s, e) => s + e.pts, 0) / last.reduce((s, e) => s + e.max, 0)) : null;
    const kms = log.filter(e => e.km != null).map(e => e.km).sort((a, b) => a - b), med = kms.length ? kms[Math.floor(kms.length / 2)] : null;
    const byReg = {}; for (const e of scored) if (e.region){ const r = byReg[e.region] = byReg[e.region] || { p:0, m:0, n:0 }; r.p += e.pts; r.m += e.max; r.n++; }
    const weak = Object.entries(byReg).filter(([, r]) => r.n >= 3).map(([id, r]) => ({ id, f:r.p / r.m, n:r.n })).sort((a, b) => a.f - b.f).slice(0, 3);
    const stat = (v, l) => h("div.stat", {}, h("b", {}, v), h("span", {}, l));
    const calib = h("div.card.hm-calib", {},
      h("div.row.between.wrap", { style:{ gap:"18px" } }, h("div", {}, h("div.eyebrow", {}, "Your residuals"), h("h3", {}, log.length ? "Where you're off" : "No answers logged yet")), h("a.btn.sm", { href:AS.href("practice") }, "Full calibration →")),
      log.length ? h("div.hm-stats", {}, stat(String(log.length), "questions answered"), stat(String(AS.log.streak()), "day streak"), stat(avg == null ? "–" : avg + "%", "of points, last 50"), stat(med == null ? "–" : AS.fmtN(med) + " km", "median pin error"))
        : h("p.muted", { style:{ margin:"10px 0 0" } }, "Play a round and this turns into a report: pin error by region, whether you date things too early or too late, and what to drill next."),
      weak.length ? h("div.hm-weak", {}, h("span.muted", {}, "Weakest regions:"), weak.map(w => h("a.chip", { href:AS.href("practice", { mode:"place", region:w.id }), style:{ "--c":AS.regionColor(w.id) } }, h("span.dot"), AS.region(w.id).short, h("span.n", {}, Math.round(w.f * 100) + "%")))) : null);

    const foot = h("footer.hm-foot", {}, h("span", { html:"Study tool for <a href='https://www.anthropeum.games/' target='_blank' rel='noopener'>anthropeum.games</a>; not affiliated with the game or any museum." }),
      h("span", { html:"Atlas: Met Open Access aggregate counts (CC0). Practice images: Cleveland Museum of Art, Art Institute of Chicago and Minneapolis Institute of Art (open access / public domain). Borders: <a href='https://github.com/aourednik/historical-basemaps' target='_blank' rel='noopener'>historical-basemaps</a> (CC BY-NC-SA 4.0)." }),
      h("span", { html:"<a href='anthropeum-study-map.html'>Classic single-file map</a> · keys <span class='kbd'>1</span>–<span class='kbd'>6</span> switch rooms" }));

    el.append(h("div.view-scroll", {}, hero, h("div.page.hm-page", {}, h("div.section-title", {}, h("h4", {}, "Today")), today, h("div.section-title", {}, h("h4", {}, "Rooms")), rooms, calib, foot)));
  },
  unmount(){ if (this._stop) this._stop(); if (this.map) this.map.destroy(); }
};
})();
