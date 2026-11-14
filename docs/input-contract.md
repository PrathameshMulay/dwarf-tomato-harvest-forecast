# What a grower sends us, and what they get back

One page for a greenhouse customer who wants the harvest forecast for their own rooms. Owner: lane L05. Based on SPEC §3; settings in [`config/crop.yaml`](../config/crop.yaml).

A **room** is one greenhouse compartment grown as one batch: planted on one day, harvested on one day.

## What you send

| Feed | How often | Fields we need | Units | Required? |
|---|---|---|---|---|
| **Climate log** per room | Every 5 min (hourly also works) | Air temperature | °C | **Yes.** Drives the ripening clock |
| | | Humidity, CO₂, light, lamp on/off | %, ppm, µmol/m²/s, 0/1 | Helpful (alerts, photo checks) |
| **Cost log** per room | Daily | Heating energy, lighting energy, total running cost | MJ/m², kWh/m², €/m² | **Yes.** For the profit by harvest day |
| **Crop plan** per room | When it changes | Planting date, plant density (pots per m²) and the date of each re-spacing, room area | date, pots/m², m² | **Yes** |
| **Crop samples** | A few per crop (we used 3 before harvest, 6 plants each) | Per plant: total fruit weight, red fruit weight (or % red) | g, % | **Yes, at least one** from the colour-turning stage. More samples make the forecast more sure |
| **Canopy photo** per room | Daily, around noon, fixed camera looking down | RGB image; depth image if you have one | JPG/PNG | Helpful. Gives early warning of ripening. Avoid photos taken under purple grow lamps |
| **Outside weather** | Hourly or daily | Outside temperature, sunlight | °C, W/m² | Optional (heating-cost estimate) |
| **Your prices** | Once per season | Price per pot (or per kg), plant cost, re-spacing cost, the "sellable" rule | € | **Yes.** Otherwise we use the challenge's rules |

**Format.** CSV files, one row per room per time stamp, with a `room` and a `timestamp` column (ISO 8601, local time with time zone), or a read-only link to your climate computer's data export. Photos named `room_YYYYMMDD_HHMM.jpg`.

**History needed.**
- Climate and cost logs from **planting day** to today, with no gap longer than a day.
- To learn how your crop ripens, we need **at least three finished crops** (rooms or cycles) of the same variety with their harvest-day measurements. The demo learned from five rooms at a time and tested on the sixth.
- For each room being forecast: the log up to today and its latest crop sample.

## What you get back

For every room, every day:
- **Harvest window:** earliest day the pots are sellable, the best-profit day, and the day waiting starts to lose money.
- **How sure we are:** High / Medium / Low, with the three reasons (how wide the likely range is, whether camera, crop samples and the warmth model agree, and how fresh the evidence is).
- **Profit by harvest day** (€ per m² per day) with a low/high band.
- **Evidence:** today's photo, the latest crop sample, warmth so far.
- **Alerts:** room ripening ahead of or behind plan, sensor problems, a room drifting colder than the others.
- **What-if:** the estimated effect of running the room 1–2 °C warmer or cooler on the best day and the energy bill.

All of it as a web page, and the same numbers as small JSON files if you want them in your own systems.

## Another crop or variety

The method does not change; the settings do. For a new crop we change `config/crop.yaml`:
- base temperature for warmth (10 °C for tomato),
- the "sellable" rule and price curve (here: one-third red, up to 150 g red per pot),
- plant and re-spacing costs, room area,
- confidence and alert thresholds.

Then we re-learn the ripening curve from your own finished crops (at least three) and re-run the timing test on them before showing any forecast. Until that test is run, every number is labelled as untested.

## What we cannot do yet

- One harvest per room. Crops picked many times (high-wire tomatoes) need a different model.
- No disease or pest detection (no labelled examples in the data).
- The camera sees only the top of the canopy; fruit lower down is judged from crop samples and warmth.
