# L01 · Forecast, confidence & timing test

**Wave** 1 · **Spec** §4 · **Feeds** L02, publish

## Goal

For any room and any "today", an honest ripeness forecast for the next 21 days with a band, a confidence level a grower can understand, and a timing test that compares us fairly with simple baselines.

## Owns

- `harvest/forecast.py`, `harvest/confidence.py`, `harvest/backtest.py`
- `tests/test_forecast.py`, `tests/test_confidence.py`, `tests/test_backtest.py`

## Tasks

- [ ] `fit_params` / `forecast` per `contracts/app-data.md` §2. Start from `main`'s `forecast.py` (curve, leave-one-room-out fit, photo onset needing 3 days, 7-day warmth rate). Only data dated ≤ today; the room's own hand measurements never used to fit the shared curve.
- [ ] Crop-sample update: if the room has a measurement dated ≤ today, shift G50 so the curve moves toward it (weight from `config/crop.yaml`, `sample_weight`; default 0.7). Record `sample_used`.
- [ ] Band: low/high from the spread of G50 across the other rooms (±1.96 sd), as `main` does.
- [ ] `delta_c`: future degree-days per day change by `delta_c` (never below 0).
- [ ] `confidence`: three parts per SPEC §4 with thresholds from `config/crop.yaml` (`confidence:` block); level = worst of the three; reasons in plain English ("Camera and crop sample agree", "Last crop sample was 9 days ago").
- [ ] `timing_test`: for each room, forecast made on 2024-11-05 of the date it reaches the % red it actually had at harvest; error in days vs actual harvest. Baselines: same days-after-planting as other rooms' mean harvest; and for % red at harvest, the other rooms' mean final % red. Report all, including where a baseline wins.

## Tests

- Curve and inverse on hand-worked values (k=0.03, G50=750 → 50% at 750; 70% at 778.2).
- Leakage test: changing the held-out room's own hand measurements after `today` must not change its forecast.
- Onset needs 3 consecutive days and isn't known until the 3rd day.
- Fixture-based confidence cases for each level.
- Backtest numbers on `tests/fixtures/` with hand-worked expected values.

## Done when

- Functions match the contract signatures; `make test` green.
- `python -m harvest.backtest` prints the timing table on real inputs.

## Not this lane

- Profit, harvest window, what-if (L02); photos and alerts (L03); writing JSON (publish).

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
