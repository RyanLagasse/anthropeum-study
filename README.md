# Anthropeum Study

A study desk for [anthropeum.games](https://www.anthropeum.games/), the daily game of guessing where and when museum artifacts were made.

**Rule of the house:** no Metropolitan Museum objects or images appear anywhere. The Met is the collection Anthropeum draws from, so practice objects never overlap with it. The Atlas uses aggregate Met counts only; practice runs on objects from other museums.

Open `index.html` (works from `file://` or any static host; no build step, no dependencies).

## Rooms

| Room | What it is | Deep link |
|---|---|---|
| **Desk** | Landing page: the world through time, today's tell / script / rule, calibration snapshot | `#/home` |
| **Atlas** | Base rates from the Met's 485k open-access records, by era, place, material, instrument family and animal. Metrics: *Balanced* (share within an era, every era weighted equally), *Raw*, *Signature* (lift) | `#/atlas?lens=materials&sub=jade&metric=signature` |
| **When** | 119 techniques, materials and motifs: when each first appears and when it reaches each region. Region lens, era cursor ("new / already around / not yet"), diffusion maps | `#/when?id=paper&region=eur_s` |
| **Tells** | 200 cue → inference cards with caveats, self-test mode with spaced repetition, and 23 lookalike showdowns | `#/tells?region=eas&medium=ceramics` |
| **Scripts** | 60 writing systems as live specimens (web fonts), period styles, confusables, world-by-era map | `#/scripts?id=arabic-kufic` |
| **Practice** | The real game (pin + era, same scoring) on 695 objects from Cleveland, Chicago and Minneapolis; duels, line-ups, five knowledge drills, and a calibration dashboard | `#/practice?mode=place&region=wan` |

Keys `1`–`6` switch rooms. The old single-file map is still at `anthropeum-study-map.html`.

## Layout

```
index.html            shell (classic scripts, hash router)
assets/css, assets/js one pair per room + base.css / core.js / map.js / quiz.js
data/*.js             packed data on window.AS_DATA (generated)
data-src/*.json       techniques, tells, scripts, gallery (source of truth)
build/                pipeline + legacy template
```

## Rebuilding data

- `python3 build/pack.py` packs `build/aggregate.json`, `build/empires.json` and `data-src/*.json` into `data/*.js`.
- `python3 build/gallery.py` re-pulls the practice gallery from the Cleveland Museum of Art, Art Institute of Chicago and Minneapolis Institute of Art open APIs (needs `requests`).
- `build/aggregate.py` and `build/simplify.py` are the original Met-aggregate and border pipelines (see comments in each).
- `build/shot.py` takes Playwright screenshots of the local preview: `python3 -m http.server 8920` then `uv run --with playwright python build/shot.py '#/atlas' out.png`.

## Content caveats

Tells, scripts and techniques were written from general art-historical knowledge and spot-checked, mostly against Wikipedia; treat dates as round consensus figures, not citations. Known soft spots are the entries marked `confidence: "contested"` in `data-src/techniques.json` and anything with a long caveat in `data-src/tells.json`.

## Credits

Met Open Access (CC0, aggregate counts) · Cleveland Museum of Art Open Access (CC0) · Art Institute of Chicago API (CC0) · Minneapolis Institute of Art (public-domain images) · borders from [historical-basemaps](https://github.com/aourednik/historical-basemaps) (CC BY-NC-SA 4.0) · fonts via Google Fonts. Personal study use; not affiliated with the Met or Anthropeum.
