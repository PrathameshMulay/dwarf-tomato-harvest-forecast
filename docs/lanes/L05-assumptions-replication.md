# L05 · Assumptions, outside data & replication

**Wave** 1 · **Spec** §0 D3, D5, §5, §11 · **Feeds** L01, L02, L03, publish

## Goal

Every setting the model uses is written down once with its source and what changes if it's wrong; the challenge scoring rules are checked against the paper; and a customer could read one page to know what data to send us.

## Owns

- `config/crop.yaml`
- `docs/assumptions.md`, `docs/input-contract.md`
- `scripts/outside_data/` (download + tidy scripts and small cleaned outputs for any outside dataset)

## Tasks

- [ ] **Verify the scoring rules** in Maree et al. 2025, *Sensors* 25(14):4321 (open the article in a browser; automated fetch was refused). For each rule in SPEC §5: stated or not, short quote (<15 words), section. Record result in `docs/assumptions.md` and tell the integrator under "Blocked" if any rule differs.
- [ ] `config/crop.yaml` with every setting the lanes need: base temperature, sellable red share (1/3), red-weight cap (150 g), price + low/high, plant cost, re-spacing cost, plant spread sd, sample weight, cost-rate days, horizon, earliest-sellable share (0.95), `confidence:` thresholds, `alerts:` thresholds, room area. Each with a comment naming its source. Start from `tests/fixtures/crop.yaml` (integrator) and keep its keys.
- [ ] Outside data (secondary, only if it earns its place in the time box):
  1. A public price reference for potted/vine tomatoes in the EU or NL (e.g. EU agri-food data portal), to sanity-check €2.15 per pot. Document what it does and doesn't support.
  2. A published source for a tomato degree-day base temperature (~10 °C).
  Each gets a source, licence, date accessed and its role (sanity check, not a model input, unless the integrator agrees).
- [ ] `docs/input-contract.md`: what a customer sends (feeds, intervals, required fields, units, formats, minimum history, photos), what we send back, and what changes for another crop (just `crop.yaml`). One page, plain words.
- [ ] `docs/assumptions.md`: a table of name, value, source, if wrong; plus the scoring-rule check.

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

**Blocked:** none.

**Hand-off**
- Built:
- Checked:
- Known limits:
- Follow-ups:
