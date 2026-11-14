# L04 · Web app & demo customers

**Wave** 1 · **Spec** §8 · **Reads** `contracts/app-data.md`

## Goal

A v1 web app that feels like a real product for a grower with several greenhouse rooms: open it, see which rooms to harvest and when, how sure we are and why, and try a warmer or cooler room. Clear enough for an executive in a 2-minute video.

## Owns

- `app/index.html`, `app/app.js`, `app/style.css`, `app/mock/*.json`
- `config/customers.yaml` (three fictional customers, two rooms each, with display names and room areas)

## Tasks

- [ ] Mock data in `app/mock/` exactly matching `contracts/app-data.md` (with `"mock": true`), realistic values, so the app works before real data exists. The app reads `data/` if present, else `mock/`.
- [ ] Customer switcher (three demo customers) and a date control for "today" (default 2024-11-06).
- [ ] **My greenhouses:** a card per room — status pill, best day, harvest window, confidence, alerts count.
- [ ] **Room detail:** profit-by-harvest-day chart with the three markers and band; ripeness forecast chart with band; confidence level with its three parts and reasons; today's photo and evidence; temperature what-if slider (−2 to +2 °C, step 0.5) reading `whatif.json`; "what the grower actually did" marker.
- [ ] **Alerts** list and **How it works & limits** page (logic in plain words, assumptions from `assumptions.json`, timing test from `backtest.json`, credits).
- [ ] Always-visible banner: "Demo customer — replayed 2024 data". Phone width works (no sideways scroll). Light and dark themes. d3 v7 from cdnjs pinned; no other network calls.
- [ ] No numbers hard-coded in HTML/JS; every chart has a one-line finding, units and a source caption.

## Tests

- A small script (`app/check.mjs` or Python) that loads each mock file and asserts the fields the app reads exist. Manual check at 390 px and 1280 px wide, screenshot in hand-off.

## Done when

- App runs from `make app` on mock data with no console errors; every screen works at phone width; hand-off lists any contract field that was awkward.

## Not this lane

- Computing any number (pipeline lanes). Names must be clearly fictional, no logos, no real companies.

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
