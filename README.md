# Anthropeum Study Map

Interactive single-file study map for [anthropeum.games](https://www.anthropeum.games/) — the daily game of guessing where and when Met Museum artifacts were made.

**Open `anthropeum-study-map.html` in any browser** (fully offline, no dependencies).

Tabs:
- **Hotspots** — where the Met's 484,956 open-access objects were made, per 250-year era, with a toggle to exclude works on paper
- **Empires** — dominant powers per era over period-correct historical borders
- **Materials** — stone / metal / perishables / ceramic+glass, each drilling into ~46 specific materials (limestone, marble, jade, bronze, silk, linen, plant-fiber cordage, faience, porcelain…) with per-place material mixes and regional prior notes
- **Instruments** — the Met's musical instruments by place and era, drilling into 14 instrument families (drums, zithers, plucked lutes, bells & gongs…)
- **Quiz** — 10-question practice rounds: pin-drop questions scored by distance (like the real game) plus multiple choice on empires and material priors

Keyboard: `1–4` tabs · `←/→` eras. Bookmarkable views via URL hash, e.g. `#tab=materials&era=4&sub=limestone`.

## Rebuilding

`build/` contains the pipeline: download `MetObjects.csv` from [metmuseum/openaccess](https://github.com/metmuseum/openaccess), run `aggregate.py` → `aggregate.json`, `simplify.py` → `borders_data.js` (from [historical-basemaps](https://github.com/aourednik/historical-basemaps)), then substitute `/*%%AGG%%*/`, `/*%%EMPIRES%%*/`, `/*%%BORDERS%%*/` tokens in `template.html`.

Data: Met Open Access (CC0) · borders CC BY-NC-SA 4.0 (aourednik/historical-basemaps). Personal study use; not affiliated with the Met or Anthropeum.
