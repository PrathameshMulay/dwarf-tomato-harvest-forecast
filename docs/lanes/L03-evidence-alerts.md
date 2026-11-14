# L03 · Evidence trail, photos & alerts

**Wave** 1 · **Spec** §3, §7 · **Feeds** publish, L04

## Goal

For every room and day, show the grower what we saw (the noon photo and the numbers from it, the last crop sample, the warmth so far), and raise plain-English alerts when something looks off.

## Owns

- `harvest/evidence.py`, `harvest/alerts.py`
- `scripts/select_photos.py`, `app/data/photos/` (selected, resized JPEGs)
- `tests/test_evidence.py`, `tests/test_alerts.py`

## Tasks

- [ ] `select_photos.py`: from `out/thumbs/` copy noon photos for 2024-10-15 → harvest (not the harvest day itself) into `app/data/photos/<room>_<date>.jpg`, resized to 320 px wide, quality 70. Keep the folder under 3 MB; if over, keep every other day before 25 Oct.
- [ ] `evidence_rows` per contract. `photo_usable` false when lamps were on at noon or the red index is missing; `canopy_distance_mm` from depth. Last crop sample = latest measurement dated ≤ that date (mean % red and mean fruit weight).
- [ ] `alerts` per SPEC §7: behind/ahead of schedule (camera red index or sample vs the forecast band — call L01's `forecast` if merged, else use `tests/fixtures/forecast_fixture.csv`); sensor checks on the daily table (missing days, flat lines ≥ 3 days, out-of-range values); room drift (7-day degree-day rate more than 15% below the other rooms' median). Thresholds in `config/crop.yaml` (`alerts:` block; fixture copy until L05 lands).
- [ ] Every alert has a short `title`, a one-sentence `message` a non-specialist understands, and the `numbers` behind it.

## Tests

- Harvest-day photo is never selected.
- Lamp-lit frame → `photo_usable` false.
- Each alert kind fires on a crafted fixture and stays quiet on a clean one.

## Done when

- `make test` green; photos folder ≤ 3 MB; alert counts on real inputs listed in the hand-off (so the integrator can sanity-check they aren't noise).

## Not this lane

- Forecast maths (L01), economics (L02), app display (L04). No disease detection (not in v1).

---

## Status log

_Only this lane writes here. Newest first._

| Date | State | Note |
|---|---|---|

**Blocked:** none.

**Hand-off**
- Built:
- Checked:
- Known limits:
- Follow-ups:
