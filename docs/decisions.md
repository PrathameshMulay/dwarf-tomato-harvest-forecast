# Decisions log

Changes to SPEC.md's locked decisions (D1–D8) and fills for gaps in it. Each entry: date, decision, reason, SPEC sections touched. Newest last.

```
## Dn · Short title
Date · SPEC §x · Lanes affected
Decision. Reason.
```

---

## D9 · Scoring rules unverified until L05 checks the paper

14 Nov 2026 · SPEC §5 · L02, L05

The economic rules come from `main`'s code comments citing Maree et al. 2025 (*Sensors* 25:4321). An automated fetch of the paper was refused (HTTP 403), so they are unverified. L05 checks them in a browser. Until then the app labels them "assumed from the challenge rules".

## D10 · Use the scoring rules as verified in the paper

14 Nov 2026 · SPEC §0 D5, §5 · L02, L05 (also changes `main`'s €2.15 example figures)

L05 read Maree et al. 2025. Confirmed: one-third red by weight, 150 g cap, €0.75 per plant, ranking on profit per m² per day, 96 m² rooms. Corrected: (1) revenue per pot follows the paper's gains curve (€0 below 50 g red, €1.60 at 80 g, €1.80 at 150 g for dry matter ≤ 7%; €1.80 and €2.00 for ≥ 8%), not a flat €2.15 scaled linearly; (2) re-spacing is €1.50/m² per year per step as a fixed cost, not a one-off €1.50/m². Dry matter isn't measured, so the ≤ 7% curve is the main case and ≥ 8% is the high scenario. The user approved the switch. Reason: the project claims to be evidence-based; D9 is resolved.
