# Harvest-to-Market Planner

Open `dashboard/index.html#market` in Chrome or Edge. Choose a greenhouse at the top of the page, then select a route preset and edit the order, window, and assumptions. A crop sample or camera fallback in the original planner automatically updates the shipment calculation. The Local, Regional, and Long buttons replace only route fields. Expand the date comparison to inspect exact values and chart contribution, arrival color, or freight. The app uses the existing logistic replay and works from local files.

The Ship screen displays road distance in miles and freight rate in euros per mile. The simulator and saved reference routes use kilometers internally, with conversion at the dashboard boundary. The main navigation groups Harvest, Ship, Orders, Crop checks, Tasks and Forecast results into separate views.

## Product and evidence

The Track 1 Challenge 2 brief identifies the Wageningen dwarf-tomato trial. The study's harvest decision removes marketable whole pots with fruit attached, and the existing planner grades pots using a red-fruit share proxy and minimum red weight. Those are the units in this module. Detached tomatoes require their own postharvest model. The calculator explicitly rejects a detached-fruit product input. [Trial and harvest scoring](https://pmc.ncbi.nlm.nih.gov/articles/PMC12299141/) · [Detached tomato handling reference](https://postharvest.ucdavis.edu/ar/produce-facts-sheets/tomato)

Live-plant transport references identify water status, temperature extremes, and protection from mechanical handling as relevant. These references support the direction of the effects. They do not supply calibrated tomato-in-pot thresholds or rates. The challenge archive records greenhouse and crop conditions without shipment observations. [USDA transport guidance](https://www.ams.usda.gov/sites/default/files/media/Tropical%20Products%20Transport%20Handbook.pdf) · [NC State guidance on container plant transport](https://content.ces.ncsu.edu/extension-gardener-handbook/18-plants-grown-in-containers)

## Architecture and constraints

- `dashboard/market.js` is a pure offline scheduling and simulation module shared by the app and Node scripts. `market-ui.js` connects the inputs, tables and chart to the active room's existing daily forecast. The main planner, ML comparison, and separate six-room order optimizer retain their original objectives.
- Search the next 21 forecast dates. Because the replay is at the end of November 5, the first shipment harvest slot is November 6. Harvest is modeled as releasing whole pots at 18:00. Search integer hours of preloading hold from zero to the entered limit. Dispatch is the end of loading. Arrival is the end of unloading, including driving and scenario delay. The search optimizes over this grid. Date endpoints are inclusive calendar days on a shared fixed planning clock. No time zones, delivery opening hours, or vehicle calendars are inferred.
- An order is one shipment from the selected room. Gross lot inventory is floor(allocated area × current pot density). The ordered quantity must fit room inventory and vehicle capacity, including other cargo. The buyer explicitly allows up to the entered rejection percentage. Every modeled arrival must fall in the window. The expected scenario must pass plant condition, display life, and rejection limits. Adverse quality failure contributes costs and downside risk. The optimizer selects the largest scenario-weighted contribution, with earliest harvest and shortest wait breaking exact ties. A negative optimum is displayed alongside a warning. Declining the order is an outside option.
- The optimizer assumes sufficient harvest and loading labor for this batch at each grid slot. It assumes allocated space can be freed proportionally and only the ordered pots are committed. Other cargo already has its own scheduling and revenue plan. Split orders, truck reuse, multi-stop routing, destination queues, and surplus sales require a broader scheduler. Use carrier-supplied road distance and duration. Matching distance to duration or invoking a routing service is unnecessary for this prototype.

## Arrival simulation

Three scenarios pair the current greenhouse forecast's upper, central, and lower ripeness curves with unfavorable or favorable logistics assumptions. Weights are 25%, 50%, 25%. Delay is zero, half the entered adverse delay, and the full adverse delay. Handling damage multipliers are 0.5, 1, and 1.5. The adverse temperature uses the entered signed deviation for the full loading-to-unloading interval. These paired scenarios span stress cases and do not estimate calibrated probabilities or independent drivers.

The complete exposure formulas are in `market.js`. Temperature stress is degree-days **outside an illustrative 16–24°C band**, unrelated to greenhouse GDD. Preloading hold and transportation accrue exposure. Watered/protected pots accrue 1 damage percentage point per day and unwatered pots 4. Temperature stress adds 1.5 points per exposure degree-day. Condition starts at 100 and subtracts damage plus 2 points/day of holding and shipping. Display life subtracts elapsed time, stress, damage and a small advanced-ripeness adjustment from the entered base life. These values are demonstration assumptions and the condition score has no industry scale.

Default color gain is zero. The optional color parameter applies a first-order gain to the remaining unripe fraction during transit, attenuated by temperature stress. Holding has zero color gain. Fruit remains attached, fruit mass is fixed, and the truck does not advance the greenhouse GDD curve. Color here is red fresh-weight percentage. It does not directly measure visual grading or firmness.

As in the greenhouse model, a 41-point spread of pot ripeness is simulated around the central estimate in log-odds space. A pot must meet the greater of the customer minimum and the original one-third red-weight proxy and contain at least 50 g red fruit. Damage removes a fraction of otherwise eligible pots, with saleable counts rounded down. Failed whole-lot condition or life yields zero accepted pots. Thresholds and damage rates need a prospective shipping trial before operational use.

## Contribution and cost allocation

Accepted pots earn the entered contract price once. This replaces the greenhouse-only graded-price curve for this destination quote. The metric is absolute incremental euros per order, since room area and shipment size are specified. Subtract forward greenhouse operating costs once, using the room replay's €/pot/day at 0.75×, 1× and 1.25×, plus entered space cost on the estimated batch footprint. Existing cultivation expenditure is sunk. Subtract harvest and packing per ordered pot, disposal per rejected pot, and one penalty per failed order scenario. Rejected pots already lose sale revenue, so disposal represents additional costs only.

Allocate truck-level fixed, mileage and temperature-control cost by occupied pot count: ordered / (ordered + other cargo). Apply this rule consistently across orders in the same truck so shared expense is counted once. Packing and disposal remain order-specific. Constant fixed or distance costs affect the value of accepting the order. They cannot change the relative ranking of dates for a single fixed route by themselves.

## Reproduce and interpret

Run from `harvestwindow` using Node.js:

```powershell
node market_demo.cjs
node tests/test_market.cjs
node tests/test_orders.cjs
python -m unittest discover -s tests -v
node tests/browser.cjs
```

The browser test requires Playwright and Chrome. The JSON in `market-demo.json` is the saved output for the MuGrow replay. All routes target November 15, 2024 and share the same order inputs except the named adjustments.

| Scenario | Harvest | Dispatch | Expected arrival | Contribution |
|---|---|---|---|---:|
| Local 30 km, 1 h driving | Nov 14 | Nov 14 22:30 | Nov 15 02:00 | €835.54 |
| Regional 400 km, 8 h driving | Nov 14 | Nov 14 18:30 | Nov 15 07:00 | €660.24 |
| Long 1,000 km, 48 h driving | Nov 12 | Nov 12 23:30 | Nov 15 08:00 | €332.32 |

The original greenhouse planner has a November 5 central date with sampling recommended. The November 15 single-day delivery window and 48-hour maximum preloading hold push the local and regional harvest later. Long driving time consumes more of the same window and moves the date earlier relative to local delivery. Increasing distance alone to 1,000 km leaves harvest on November 14 and reduces modeled contribution by €339.50. Keeping local travel time and raising fixed freight from €50 to €200 reduces contribution by €150 and leaves the date unchanged. Changing local temperature from 19°C to 28°C or 7°C reduces simulated contribution, with no date change. Raising minimum remaining display life to seven days on the long route makes the order infeasible. The regional route fails with a 1% rejection limit. These are model comparisons. They provide no measured savings or calibrated rejection probabilities.

A practical pilot would record departure and arrival photos or fruit weights, transit temperature and duration, watering, packaging, actual rejects and display days by batch. It could then estimate parameters by product and transport regime and validate them on separate shipments.
