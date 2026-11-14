/* Reproduce the saved comparison and one-factor sensitivity analysis. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { optimize, defaults, presets } = require("./dashboard/market.js");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "dashboard/replay-data.js"), "utf8"), context);
const room = context.window.harvestReplay.rooms.MuGrow;
const format = ms => new Date(ms).toISOString().slice(0, 16).replace("T", " ");
const shifts = {
  ...presets,
  "Distance only, 1000 km": { distance: 1000 },
  "Drive time only, 48 hours": { drive: 48 },
  "Hotter vehicle, 28 C": { temp: 28 },
  "Cold vehicle, 7 C": { temp: 7 },
  "Higher fixed freight, EUR 200": { fixed: 200 },
  "Regional, strict rejection limit": { ...presets.regional, maxReject: 1 },
  "Regional, no watering": { ...presets.regional, watered: false },
  "Long, tight display life": { ...presets.long, minLife: 7 },
  "Long, provisional color development": { ...presets.long, redRate: 4 }
};
const rows = Object.entries(shifts).map(([caseName, settings]) => {
  const o = { ...defaults, ...settings };
  const result = optimize(room.prior, room.forecastInputs, o);
  const b = result.best;
  return { case: caseName, settings: o,
    original: room.prior.points[room.prior.selected].date,
    harvest: b?.date ?? null, dispatch: b ? format(b.dispatch) : null,
    arrival: b ? format(b.expected.arrival) : null,
    red: b?.expected.red ?? null, quality: b?.expected.quality ?? null,
    displayDays: b?.expected.life ?? null, saleable: b?.saleable ?? null,
    freight: b?.freight ?? null, net: b?.profit ?? null, risk: b?.risk ?? null,
    reason: result.reason || null };
});
console.log(JSON.stringify(rows, null, 2));
