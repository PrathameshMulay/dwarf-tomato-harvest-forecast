/* Single-order, single-room, whole-pot shipment simulator. */
(function (root) {
  "use strict";
  const HOUR = 3600000;
  const DAY = 24 * HOUR;
  const scenarios = [
    { name: "Favorable", weight: 0.25, red: "high", cost: 0.75, delay: 0, offset: 0, handling: 0.5 },
    { name: "Expected", weight: 0.50, red: "red", cost: 1, delay: 0.5, offset: 0, handling: 1 },
    { name: "Adverse", weight: 0.25, red: "low", cost: 1.25, delay: 1, offset: 1, handling: 1.5 }
  ];
  const defaults = {
    product: "potted", order: "Demo order", origin: "Bleiswijk greenhouse", destination: "Local customer",
    earliest: "2024-11-15", deadline: "2024-11-15", quantity: 500, capacity: 750, sharedPots: 0,
    area: 96, minRed: 40, minQuality: 75, minLife: 3, maxReject: 20,
    distance: 30, drive: 1, loading: 0.5, unloading: 0.5, delay: 4, hold: 48,
    vehicle: "Temperature-controlled van", temp: 19, excursion: 5, watered: true,
    damage: 2, fixed: 50, perKm: 0.35, cooling: 1, packing: 0.15,
    price: 2.15, rejectCost: 0.25, penalty: 75, space: 0.1,
    redRate: 0, baseLife: 9
  };
  const presets = {
    local: {},
    regional: { destination: "Regional customer", distance: 400, drive: 8, delay: 8, fixed: 85 },
    long: { destination: "Long-distance customer", distance: 1000, drive: 48, delay: 16, fixed: 150 }
  };
  const limits = {
    quantity: [1, 1000000], capacity: [1, 1000000], sharedPots: [0, 1000000], area: [0.01, 100000],
    minRed: [0, 100], minQuality: [0, 100], minLife: [0, 30], maxReject: [0, 100],
    distance: [0, 30000], drive: [0, 336], loading: [0, 48], unloading: [0, 48], delay: [0, 336],
    hold: [0, 168], temp: [-30, 65], excursion: [-35, 35], damage: [0, 100],
    fixed: [0, 1000000], perKm: [0, 100], cooling: [0, 1000], packing: [0, 1000],
    price: [0, 1000], rejectCost: [0, 1000], penalty: [0, 1000000], space: [0, 1000],
    redRate: [0, 20], baseLife: [0, 30]
  };
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const dayStart = date => Date.parse(date + "T00:00:00Z");
  const validDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(dayStart(date)) &&
    new Date(dayStart(date)).toISOString().slice(0, 10) === date;
  const average = (rows, key) => rows.reduce((value, row) => value + row.weight * row[key], 0);
  const logistic = value => 1 / (1 + Math.exp(-value));

  function validate(o) {
    if (o.product !== "potted") throw new RangeError("This simulator supports living potted plants only.");
    for (const [key, [min, max]] of Object.entries(limits)) {
      if (!Number.isFinite(o[key]) || o[key] < min || o[key] > max) throw new RangeError("Invalid " + key + ".");
    }
    if (![o.quantity, o.capacity, o.sharedPots].every(Number.isInteger)) throw new RangeError("Use whole pot counts.");
    if (!validDate(o.earliest) || !validDate(o.deadline) || o.earliest > o.deadline) {
      throw new RangeError("Enter a valid delivery window.");
    }
  }

  function simulate(point, day, harvest, loadingStart, input, grams, o, scenario) {
    const transit = o.loading + o.drive + o.unloading + o.delay * scenario.delay;
    const arrival = loadingStart + transit * HOUR;
    const holding = (loadingStart - harvest) / DAY;
    const transportDays = transit / 24;
    const temp = o.temp + scenario.offset * o.excursion;
    // Illustrative exposure index for live plants. No greenhouse GDD is accrued here.
    const extreme = Math.max(0, 16 - temp, temp - 24);
    const heatStress = extreme * transportDays;
    const dehydration = (holding + transportDays) * (o.watered ? 1 : 4);
    const damage = clamp(o.damage * scenario.handling + 1.5 * heatStress + dehydration, 0, 100);
    const quality = clamp(100 - damage - 2 * holding - 2 * transportDays, 0, 100);
    const development = o.redRate * transportDays * clamp(1 - extreme / 12, 0, 1);
    const arrivalRed = red => red + (100 - red) * (1 - Math.exp(-development / 100));
    const red = arrivalRed(point[scenario.red]);
    const life = clamp(o.baseLife - holding - transportDays - heatStress / 4 -
      damage / 15 - 0.04 * Math.max(0, red - 65), 0, o.baseLife);

    // Reuse the planner's pot-level spread and minimum red-weight eligibility proxy.
    const p = clamp(point[scenario.red] / 100, 1e-9, 1 - 1e-9);
    const logOdds = Math.log(p / (1 - p));
    let eligible = 0;
    for (let plant = 0; plant < 41; plant++) {
      const potRed = arrivalRed(100 * logistic(logOdds + (-1.9 + plant * 3.8 / 40) * 0.55));
      if (potRed >= Math.max(100 / 3, o.minRed) && grams * potRed / 100 >= 50) eligible++;
    }
    const onTime = arrival >= dayStart(o.earliest) && arrival < dayStart(o.deadline) + DAY;
    const qualityOK = quality >= o.minQuality && life >= o.minLife;
    const saleable = qualityOK ? Math.floor(o.quantity * eligible / 41 * (1 - damage / 100) + 1e-9) : 0;
    const accepted = onTime ? saleable : 0;
    const rejected = o.quantity - accepted;
    const fulfills = onTime && qualityOK && 100 * rejected / o.quantity <= o.maxReject;
    const sharedFreight = o.fixed + o.distance * o.perKm + transit * o.cooling;
    const freight = sharedFreight * o.quantity / (o.quantity + o.sharedPots);
    const packing = o.packing * o.quantity;
    const cultivation = day * input.daily_cost * scenario.cost * o.quantity;
    const space = day * o.space * o.quantity / input.density;
    const disposal = rejected * o.rejectCost;
    const penalty = fulfills ? 0 : o.penalty;
    const revenue = accepted * o.price;
    return { name: scenario.name, weight: scenario.weight, arrival, temp, onTime, qualityOK, fulfills,
      harvestRed: point[scenario.red], red, quality, life, damage, saleable, accepted, rejected,
      freight, packing, cultivation, space, disposal, penalty, revenue,
      profit: revenue - freight - packing - cultivation - space - disposal - penalty };
  }

  function optimize(plan, input, options) {
    const o = { ...defaults, ...options };
    validate(o);
    if (!Number.isFinite(plan.fruitGrams) || plan.fruitGrams <= 0 ||
        !Number.isFinite(input.density) || input.density <= 0 ||
        !Number.isFinite(input.daily_cost) || input.daily_cost < 0) {
      throw new RangeError("The selected forecast has no usable fruit weight, density, or operating cost.");
    }
    const result = { best: null, days: [], reason: "" };
    if (o.quantity + o.sharedPots > o.capacity) return { ...result, reason: "Total shipment exceeds vehicle capacity." };
    if (o.quantity > Math.floor(o.area * input.density)) return { ...result, reason: "Selected room area has insufficient pot inventory." };
    let timing = false;
    let deliveryQuality = false;
    const points = plan.points;
    for (let day = 1; day < points.length; day++) {
      const point = points[day];
      // The 18:00 room-release slot is a planning convention.
      const harvest = dayStart(point.date) + 18 * HOUR;
      let bestForDay = null;
      let closest = null;
      for (let hold = 0; hold <= o.hold; hold++) {
        const loadingStart = harvest + hold * HOUR;
        const dispatch = loadingStart + o.loading * HOUR;
        const rows = scenarios.map(s => simulate(point, day, harvest, loadingStart, input, plan.fruitGrams, o, s));
        const expected = rows[1];
        const timeOK = rows.every(row => row.onTime);
        timing ||= timeOK;
        deliveryQuality ||= timeOK && expected.qualityOK;
        if (!timeOK) continue;
        const candidate = {
          day, date: point.date, harvest, dispatch, scenarios: rows, expected,
          profit: average(rows, "profit"), saleable: average(rows, "saleable"),
          freight: average(rows, "freight"), risk: rows.reduce((p, r) => p + (r.fulfills ? 0 : r.weight), 0),
          worstProfit: Math.min(...rows.map(r => r.profit)), feasible: expected.fulfills
        };
        if (!closest || candidate.profit > closest.profit) closest = candidate;
        if (candidate.feasible && (!bestForDay || candidate.profit > bestForDay.profit)) bestForDay = candidate;
      }
      result.days.push(bestForDay || closest || { date: point.date, feasible: false });
      if (bestForDay && (!result.best || bestForDay.profit > result.best.profit)) result.best = bestForDay;
    }
    if (!result.best) result.reason = !timing
      ? "No harvest and dispatch schedule reaches the delivery window in all three delay scenarios."
      : !deliveryQuality ? "Expected quality or display life falls below the customer minimum."
        : "Expected saleable inventory falls below the order’s rejection limit.";
    return result;
  }

  const api = { defaults, presets, limits, optimize };
  if (typeof module !== "undefined") module.exports = api;
  else root.harvestMarket = api;
})(globalThis);
