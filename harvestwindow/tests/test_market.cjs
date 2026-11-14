const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { optimize, presets } = require("../dashboard/market.js");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dashboard/replay-data.js"), "utf8"), context);
const rooms = context.window.harvestReplay.rooms;
const room = rooms.MuGrow;
const run = (options = {}, source = room, plan = source.prior) =>
  optimize(plan, source.forecastInputs, options);
const hour = 3600000;
const local = run().best;
const regional = run(presets.regional).best;
const long = run(presets.long).best;
assert.equal(local.date, "2024-11-14");
assert.equal(regional.date, local.date);
assert.ok(long.date < regional.date);
assert.equal(run({ distance: 1000 }).best.date, local.date);
assert.ok(Math.abs(run({ fixed: 200 }).best.profit - local.profit + 150) < 1e-8);
assert.ok(run({ temp: 28 }).best.expected.quality < local.expected.quality);
assert.ok(run({ temp: 7 }).best.expected.life < local.expected.life);
assert.ok(run({ watered: false }).best.profit < local.profit);
assert.ok(run({ damage: 100 }).reason.includes("quality"));
assert.ok(run({ earliest: "2024-11-06", deadline: "2024-11-06", delay: 24 }).reason.includes("window"));
assert.ok(run({ capacity: 499 }).reason.includes("capacity"));
assert.ok(run({ area: 0.01 }).reason.includes("inventory"));
assert.ok(run({ quantity: 1000000, capacity: 1000000 }).reason.includes("inventory"));
assert.ok(run({}, room, { ...room.prior, fruitGrams: 10 }).reason.includes("rejection"));
assert.throws(() => run({ product: "detached" }), /potted/);
for (const options of [{ quantity: 0 }, { quantity: 0.5 }, { fixed: -1 }, { packing: NaN },
  { earliest: "2024-02-30" }, { earliest: "2024-11-16" }]) assert.throws(() => run(options), RangeError);

const noTrip = run({ distance: 0, drive: 0, loading: 0, unloading: 0, delay: 0, hold: 0,
  earliest: "2024-11-14", deadline: "2024-11-14", fixed: 0, damage: 0 }).best;
assert.equal(noTrip.harvest, noTrip.expected.arrival);
assert.equal(noTrip.expected.red, noTrip.expected.harvestRed);
assert.equal(noTrip.expected.freight, 0);
const shared = run({ sharedPots: 250 }).best;
assert.ok(Math.abs(shared.freight - local.freight * 2 / 3) < 1e-8);

let checked = 0;
for (const source of Object.values(rooms)) {
  for (const preset of Object.values(presets)) {
    const options = { ...preset, earliest: "2024-11-13", deadline: "2024-11-18" };
    for (const result of [run(options, source), run(options, source, source.after)]) {
      for (const day of result.days.filter(row => row.feasible)) {
        checked++;
        assert.ok(result.best.profit >= day.profit);
        assert.ok(day.expected.fulfills);
        assert.ok(day.scenarios.every(s => s.onTime));
        assert.ok(day.scenarios.every(s => s.saleable >= 0 && s.saleable <= 500));
        assert.ok(day.scenarios.every(s => s.arrival >= day.dispatch));
        assert.ok(day.scenarios.every(s => s.red === s.harvestRed));
        for (const s of day.scenarios) {
          const sum = s.revenue - s.freight - s.packing - s.cultivation - s.space - s.disposal - s.penalty;
          assert.ok(Math.abs(s.profit - sum) < 1e-8);
          assert.ok(s.arrival < Date.parse("2024-11-19T00:00:00Z"));
        }
      }
    }
  }
}
assert.ok(checked > 50);
const fixed = run({ earliest: "2024-11-06", deadline: "2024-11-26", hold: 0 }).days.filter(d => d.expected);
for (let i = 1; i < fixed.length; i++) {
  assert.equal(fixed[i].expected.arrival - fixed[i - 1].expected.arrival,
    fixed[i].dispatch - fixed[i - 1].dispatch);
}
assert.equal(long.scenarios[2].arrival - long.scenarios[0].arrival, presets.long.delay * hour);
assert.ok(long.scenarios[2].quality < long.scenarios[0].quality);
assert.equal(run({ damage: 16 }).best.risk, 0.25);
assert.ok(run({ redRate: 4, ...presets.long }).best.expected.red > long.expected.red);
console.log("Market scenarios passed, including " + checked + " feasible plan invariant checks.");
