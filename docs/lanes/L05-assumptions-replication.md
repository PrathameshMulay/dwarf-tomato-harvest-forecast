# L05 · Assumptions, outside data & replication

**Wave** 1 · **Spec** §0 D3, D5, §5, §11 · **Feeds** L01, L02, L03, publish

## Goal

Every setting the model uses is written down once with its source and what changes if it's wrong; the challenge scoring rules are checked against the paper; and a customer could read one page to know what data to send us.

## Owns

- `config/crop.yaml`
- `docs/assumptions.md`, `docs/input-contract.md`
- `scripts/outside_data/` (download + tidy scripts and small cleaned outputs for any outside dataset)

## Tasks

- [x] **Verify the scoring rules** in Maree et al. 2025, *Sensors* 25(14):4321 (open the article in a browser; automated fetch was refused). For each rule in SPEC §5: stated or not, short quote (<15 words), section. Record result in `docs/assumptions.md` and tell the integrator under "Blocked" if any rule differs.
- [x] `config/crop.yaml` with every setting the lanes need: base temperature, sellable red share (1/3), red-weight cap (150 g), price + low/high, plant cost, re-spacing cost, plant spread sd, sample weight, cost-rate days, horizon, earliest-sellable share (0.95), `confidence:` thresholds, `alerts:` thresholds, room area. Each with a comment naming its source. Start from `tests/fixtures/crop.yaml` (integrator) and keep its keys.
- [x] Outside data (secondary, only if it earns its place in the time box):
  1. A public price reference for potted/vine tomatoes in the EU or NL (e.g. EU agri-food data portal), to sanity-check €2.15 per pot. Document what it does and doesn't support.
  2. A published source for a tomato degree-day base temperature (~10 °C).
  Each gets a source, licence, date accessed and its role (sanity check, not a model input, unless the integrator agrees).
- [x] `docs/input-contract.md`: what a customer sends (feeds, intervals, required fields, units, formats, minimum history, photos), what we send back, and what changes for another crop (just `crop.yaml`). One page, plain words.
- [x] `docs/assumptions.md`: a table of name, value, source, if wrong; plus the scoring-rule check.

## Tests

- `tests/test_settings.py`: `crop.yaml` loads, has every key in the fixture copy, values in sane ranges.

## Done when

- Scoring rules checked (or the reason they couldn't be is recorded); `crop.yaml` complete; both docs written in plain language; `make test` green.

## Not this lane

- Model code. Don't wire outside data into the model without integrator agreement (log a decision).

---

## Status log

_Only this lane writes here. Newest first._

| Date | State | Note |
|---|---|---|
| 14 Nov 2026 | done | Hand-off filled; `make test` green (8 passed). |
| 14 Nov 2026 | done | `docs/assumptions.md` and `docs/input-contract.md` written. Outside price series skipped: the paper's own price chart is the better source. Base-temp sources found but unreadable (403); 10 °C recorded as an unverified convention. |
| 14 Nov 2026 | done | `config/crop.yaml` (all fixture keys, source per value, `scoring_verified:` and `assumptions:` blocks) + `tests/test_settings.py`. |
| 14 Nov 2026 | blocked | Paper read in full in Chrome (mdpi.com, incl. Table 1 and Fig. 3). Two SPEC §5 values differ; see Blocked. Integrator messaged. |

**Blocked:** (integrator decision; touches SPEC §5, D9 and L02)
1. **Price per pot.** Paper Fig. 3: €0 below 50 g red, €1.60 (dry matter ≤7%) / €1.80 (≥8%) at 80 g, €1.80 / €2.00 at 150 g, flat above. Table 1 gains = price − €0.75, matching all six rooms to the cent. SPEC's €2.15 is about €0.35 too high, and the straight line from 0 g is the wrong shape. Proposed: use `scoring_verified` (price 1.80, band 1.60–2.00, the 50/80/150 g curve).
2. **Re-spacing cost.** Paper §2.5: €1.50 per m² **per year** per step, inside daily fixed costs, not a one-off €1.50/m². Proposed: `respacing_eur_m2_per_year` × days grown ÷ 365 per step.
3. **D9 label.** Rules 1 (1/3 red), 2 (150 g cap), 4 (€0.75) and 7 (profit per m² per day) are verified, so the app can drop "assumed" for those once 1–2 are settled.
4. **publish.py.** `crop.yaml` now has an `assumptions:` list (name, key, unit, source, if_wrong) to build `assumptions.json` from without retyping values.

**Hand-off**
- Built: `config/crop.yaml` (every fixture key, a source comment on each value, the paper's verified scoring values under `scoring_verified:`, a machine-readable `assumptions:` list for `assumptions.json`); `docs/assumptions.md` (rule-by-rule paper check with section and short quote, settings table, outside data); `docs/input-contract.md` (one page: what a customer sends, what they get, another crop); `tests/test_settings.py`.
- Checked: paper read in full in Chrome (no sign-in, nothing accepted). Table 1 reproduced from our data: net profit per m² per day for all six rooms, and harmonic-mean density to 0.1 pots/m². The Fig. 3 price curve reproduces Table 1 gains for all six rooms (`test_price_curve_reproduces_paper_table1_gains`). `make test` green.
- Known limits: Fig. 3 values read off the image (±€0.02). Equations (1)–(5) did not render as text; formulas were rebuilt from Table 1. Room-log costs are 4–7% below the paper's costs; the gap isn't explained. Base temperature 10 °C has no verified primary source. No market price check.
- Follow-ups: integrator decides the Blocked items 1–2; then L02 switches to `scoring_verified` and re-runs (expect the same or slightly earlier best days, lower profit). If the profit level shown matters to judges, reconcile log costs with the paper's fixed costs.
