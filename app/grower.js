/* Room intake demo. Uses a sample-anchored logistic curve and the existing trip simulator. */
(function (root) {
  "use strict";
  const dateOK = value => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const datePlus = (date, days) => new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
  function readCSV(source) {
    const lines = source.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
    if (lines.shift()?.trim() !== "date,temperature_c") throw Error("Use the template columns date,temperature_c.");
    if (lines.length < 3 || lines.length > 7) throw Error("Include 3–7 consecutive days ending on the crop check date.");
    const rows = lines.map(line => {
      const [date, raw, extra] = line.split(",").map(value => value.trim());
      const temp = Number(raw);
      if (!dateOK(date) || !raw || extra !== undefined || !Number.isFinite(temp) || temp < 0 || temp > 50) {
        throw Error("Each CSV row needs one valid date and a temperature from 0–50°C.");
      }
      return {date, temp};
    }).sort((a,b) => a.date.localeCompare(b.date));
    if (rows.some((row,i) => i && row.date !== datePlus(rows[i-1].date,1))) throw Error("CSV dates must be consecutive without duplicates.");
    return rows;
  }
  function project(o, observations, truck, trip) {
    if (!dateOK(o.today) || !dateOK(o.planted) || o.planted > o.today) throw Error("Planting must be on or before the crop check date.");
    if (!dateOK(o.fullWeightDay) || o.fullWeightDay < o.planted) throw Error("Enter a fruit weight-ready date on or after planting.");
    if (observations?.at(-1).date !== o.today && observations) throw Error("The last CSV date must match the crop check date.");
    if (observations?.[0].date < o.planted) throw Error("Climate dates must be on or after planting.");
    if (o.redWeight > o.weight) throw Error("Red fruit weight cannot exceed total fruit weight.");
    const heat = observations ? observations.reduce((sum,row) => sum + Math.max(0,row.temp - 10),0) / observations.length : Math.max(0,o.temp-10);
    const red = Math.max(0.01, Math.min(99.99, 100 * o.redWeight / o.weight));
    const rows = Array.from({length:22}, (_,i) => {
      const pct_red = trip.ripen(red, o.slope, heat*i);
      const sellable_share = trip.sellableShare(pct_red, truck);
      const profit_m2_day = o.density * (sellable_share * o.price * Math.min(1,o.weight*pct_red/15000) - 0.75) -
        (o.spent + o.cost*i);
      return {date:datePlus(o.today,i),pct_red,sellable_share,profit_m2_day};
    });
    const sellable = rows.filter(row => row.sellable_share >= truck.earliest_sellable_share && row.date >= o.fullWeightDay);
    const best = sellable.reduce((a,b) => !a || b.profit_m2_day > a.profit_m2_day ? b : a, null);
    const card = {today:o.today,k_x1000:1000*o.slope,weight_complete_day:o.fullWeightDay};
    const route = {transit_days:o.transit};
    const shipping = trip.planTrip(rows,card,truck,route);
    return {rows, best, shipping, arrivalRows:trip.projectTrip(rows,card,truck,route)};
  }
  const api = {readCSV,project};
  if (typeof module !== "undefined") module.exports = api;
  else root.Grower = api;
})(globalThis);
