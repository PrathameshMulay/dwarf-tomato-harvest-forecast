# L02 · Harvest window, profit & temperature what-if

**Wave** 1 · **Spec** §5, §6 · **Feeds** publish, L04

## Goal

Turn a ripeness forecast into the three dates a grower acts on (earliest sellable, best profit, losses start) with a profit curve and band, and answer "what if we run the room 1 °C warmer or cooler?" in days and euros.

## Owns

- `harvest/economics.py`, `harvest/whatif.py`
- `tests/test_economics.py`, `tests/test_whatif.py`

## Tasks

- [ ] `profit_by_day` per contract. Port `main`'s `profit_tables` logic: pots ripen at different times (plant spread from settings), a pot sells only if ≥ 1/3 red, revenue capped at 150 g red, plant and re-spacing costs, costs to date from the log plus the 7-day cost rate, profit per m² per day grown. Fruit weight = latest crop sample dated ≤ today (else the other rooms' mean at that age).
- [ ] Band: scenarios early/late ripening (forecast band) × price low/high from settings; `profit_low/high` = min/max.
- [ ] `harvest_window` per SPEC §5. `best_day_low/high` = best day under the early and late scenarios.
- [ ] `heating_cost_per_degree`: regress daily heating cost per m² on (inside − outside mean temperature) across rooms and days with heating on; return slope, r², n. If r² < 0.3, say so in `note`.
- [ ] `whatif`: re-run forecast with `delta_c`, recompute window, add extra energy cost to the cost rate for future days. Fill `note` with plain wording ("model estimate, not tested in the greenhouse").
- [ ] All settings from `config/crop.yaml` (use `tests/fixtures/crop.yaml` until L05 lands).

## Tests

- A tiny hand-worked profit day (2 plants, known % red, costs) → expected €/m²/day.
- Unsellable pots (<1/3 red) earn nothing; the best day never has a sellable share below the setting.
- Window ordering: earliest sellable ≤ best ≤ losses start.
- What-if sign: +1 °C never makes ripening slower; extra cost ≥ 0 for positive delta.
- Use the fixture forecast in `tests/fixtures/forecast_fixture.csv`, so you don't wait for L01.

## Done when

- Functions match the contract; `make test` green.
- On real inputs, Tomatonuts as of 2024-11-06 gives a best day within a day of `main`'s 11 Nov (or the difference is explained in the hand-off).

## Not this lane

- The ripeness forecast itself (L01); JSON writing (publish); app charts (L04).

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
