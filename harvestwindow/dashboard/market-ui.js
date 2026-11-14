"use strict";
(() => {
  const api = window.harvestMarket;
  const form = document.getElementById("market-form");
  const KM_PER_MILE = 1.609344;
  const toForm = (key, value) => ({
    distance: () => (value / KM_PER_MILE).toFixed(2),
    perKm: () => (value * KM_PER_MILE).toFixed(6)
  })[key]?.() ?? value;
  const groups = [
    ["Customer and order", { order: "Order identifier", origin: "Origin", destination: "Destination",
      earliest: "Earliest arrival", deadline: "Delivery deadline", quantity: "Order size (pots)",
      distance: "Road distance (miles)", drive: "Driving (hours)", price: "Selling price (€/accepted pot)" }],
    ["Customer quality requirements", {
      minRed: "Minimum red fruit by weight (%)", minQuality: "Minimum plant condition score (0–100)",
      minLife: "Minimum remaining display life (days)", maxReject: "Maximum rejected pots (%)" }],
    ["Transport and handling", { vehicle: "Vehicle description",
      loading: "Loading (hours)", unloading: "Unloading (hours)",
      delay: "Adverse delay (hours)", hold: "Maximum preloading hold (hours)",
      capacity: "Vehicle capacity (pots)", sharedPots: "Other orders on truck (pots)",
      temp: "Transport temperature (°C)", excursion: "Adverse temperature change (°C)",
      watered: "Watered and protected while holding", damage: "Base handling damage (%)" }],
    ["Price, costs, and simulator assumptions", {
      area: "Allocated greenhouse area (m²)",
      fixed: "Fixed freight (€/truck)", perKm: "Mileage rate (€/mile)", cooling: "Temperature control (€/hour)",
      packing: "Harvest and packaging (€/pot)", rejectCost: "Disposal (€/rejected pot)",
      penalty: "Failed delivery penalty (€)", space: "Space opportunity cost (€/m²/day)",
      redRate: "Color development rate (% of unripe fraction/day)", baseLife: "Base display life (days)"
    }]
  ];
  for (const [index, [title, fields]] of groups.entries()) {
    const area = document.createElement(index ? "details" : "div");
    const heading = document.createElement(index ? "summary" : "h3");
    heading.textContent = title;
    area.append(heading);
    const grid = document.createElement("div");
    grid.className = "method-grid market-fields";
    for (const [key, name] of Object.entries(fields)) {
      const label = document.createElement("label");
      label.textContent = name;
      const input = document.createElement("input");
      input.name = key;
      const bounds = api.limits[key];
      if (bounds) {
        input.type = "number";
        input.max = toForm(key, bounds[1]);
        input.min = toForm(key, bounds[0]);
        input.step = ["quantity", "capacity", "sharedPots"].includes(key) ? "1" : "any";
      } else if (key === "earliest" || key === "deadline") input.type = "date";
      else if (key === "watered") input.type = "checkbox";
      else input.maxLength = 100;
      if (input.type !== "checkbox") input.required = true;
      label.append(input);
      grid.append(label);
    }
    area.append(grid);
    form.append(area);
  }

  const euros = n => "€" + n.toFixed(2);
  const percent1 = n => n.toFixed(1) + "%";
  const time = n => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short",
    day: "numeric", hour: "numeric", minute: "2-digit" }).format(n);
  const count = n => Math.round(n).toLocaleString();
  function showTable(id, columns, rows) {
    document.getElementById(id).replaceChildren();
    table(id, columns, rows.map(values => ({ values })));
  }

  let currentDays = [];
  function cards(id, entries) {
    const container = document.getElementById(id);
    container.replaceChildren(...entries.map(([label, value]) => {
      const card = document.createElement("div");
      const title = document.createElement("span");
      const amount = document.createElement("strong");
      title.textContent = label;
      amount.textContent = value;
      card.append(title, amount);
      return card;
    }));
  }
  function bars(entries) {
    const container = document.getElementById("market-bars");
    container.replaceChildren(...entries.map(([label, value, display]) => {
      const row = document.createElement("div");
      const title = document.createElement("span");
      const meter = document.createElement("meter");
      const amount = document.createElement("strong");
      title.textContent = label;
      meter.max = 100;
      meter.value = value;
      meter.setAttribute("aria-label", label);
      amount.textContent = display;
      row.append(title, meter, amount);
      return row;
    }));
  }
  function draw() {
    const canvas = document.getElementById("market-chart");
    const {clientWidth: width, clientHeight: height} = canvas;
    if (!width || !height) return;
    const ratio = devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    const metric = document.getElementById("market-metric").value;
    const points = currentDays.map((row, index) => ({
      index, value: metric === "red" ? row.expected?.red : row[metric], feasible: row.feasible
    })).filter(p => Number.isFinite(p.value));
    if (!points.length) {
      ctx.fillStyle = "#52645a";
      ctx.fillText("No schedules to chart in this delivery window.", 12, 26);
      return;
    }
    const lo = Math.min(...points.map(p => p.value));
    const hi = Math.max(...points.map(p => p.value));
    const x = index => 58 + index * (width - 80) / 20;
    const y = value => height - 30 - (value - lo) / Math.max(1, hi - lo) * (height - 50);
    ctx.font = "12px system-ui"; ctx.fillStyle = "#52645a";
    for (const label of new Set([lo, hi])) ctx.fillText(label.toFixed(1), 1, y(label) + 4);
    for (const index of [0, 6, 13, 20]) {
      const date = currentDays[index]?.date;
      if (date) ctx.fillText(date.slice(5), x(index) - 10, height - 7);
    }
    for (const p of points) {
      ctx.beginPath(); ctx.fillStyle = p.feasible ? "#266248" : "#ae4837";
      ctx.arc(x(p.index), y(p.value), 4, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.fillStyle = "#52645a";
    ctx.fillText("Green: meets order  ·  Red: falls short", 58, 13);
  }

  function renderMarket() {
    const source = replay.rooms[document.getElementById("room").value];
    const plan = currentPlan(source);
    const raw = Object.fromEntries(new FormData(form));
    const output = document.getElementById("market-result");
    const compare = document.getElementById("market-comparison");
    const costs = document.getElementById("market-costs");
    costs.textContent = "";
    const existing = plan.selected === null ? "beyond outlook" : plan.points[plan.selected].date;
    compare.textContent = "Harvest without shipping: " + existing + " (" + plan.action + ").";
    document.getElementById("market-order").textContent = [raw.order, raw.destination].filter(Boolean).join(" · ");
    let result;
    try {
      if (!form.checkValidity()) throw new Error("Complete the highlighted shipment fields to calculate a schedule.");
      for (const key of Object.keys(api.limits)) raw[key] = Number(raw[key]);
      raw.distance = Math.min(api.limits.distance[1], raw.distance * KM_PER_MILE);
      raw.perKm = Math.min(api.limits.perKm[1], raw.perKm / KM_PER_MILE);
      raw.watered = form.elements.watered.checked;
      result = api.optimize(plan, source.forecastInputs, raw);
      output.textContent = result.reason;
    } catch (error) {
      output.textContent = error.message;
    }
    const best = result?.best;
    cards("market-timeline", []);
    cards("market-kpis", []);
    bars([]);
    if (best) {
      const row = best.expected;
      output.textContent = best.profit < 0 ? "All feasible plans lose money under these assumptions." : "Recommended schedule";
      cards("market-timeline", [["Harvest", time(best.harvest)], ["Dispatch", time(best.dispatch)],
        ["Expected arrival", time(row.arrival)]]);
      cards("market-kpis", [["Estimated earnings after costs", euros(best.profit)],
        ["Freight", euros(best.freight)], ["Display life on arrival", row.life.toFixed(1) + " days"],
        ["Worst scenario", euros(best.worstProfit)]]);
      bars([["Red fruit at harvest", row.harvestRed, percent1(row.harvestRed)],
        ["Red fruit on arrival", row.red, percent1(row.red)],
        ["Expected saleable pots", 100 * best.saleable / raw.quantity, count(best.saleable) + " / " + count(raw.quantity)],
        ["Failing scenario weight", 100 * best.risk, percent1(100 * best.risk)]]);
      const originalDay = result.days.find(day => day.date === existing);
      compare.textContent += " Transportation-aware harvest: " + best.date + ". " +
        (best.date === existing ? "Both objectives selected this harvest date."
          : !originalDay?.expected ? "The original day has no dispatch on this grid with all arrivals inside the delivery window."
          : !originalDay.feasible ? "The original day misses expected quality, display life or rejection limits."
          : "The selected date earns " + euros(best.profit - originalDay.profit) +
            " more in modelled delivery contribution than the original day.");
      const weighted = key => euros(best.scenarios.reduce((sum, scenario) =>
        sum + scenario.weight * scenario[key], 0));
      costs.textContent = "Expected revenue " + weighted("revenue") + " less freight " + weighted("freight") +
        ", harvest and packing " + weighted("packing") + ", greenhouse operating cost " + weighted("cultivation") +
        ", space " + weighted("space") + ", disposal " + weighted("disposal") + " and penalties " + weighted("penalty") + ".";
    } else {
      compare.textContent += " Transportation-aware harvest: no feasible schedule.";
    }
    showTable("market-scenarios", ["Scenario", "Arrival", "Red", "Plant score", "Display days", "Saleable",
      "Freight", "Net", "Meets order"], (best?.scenarios || []).map(s => [
      s.name + " (" + percent1(s.weight * 100) + ")", time(s.arrival), percent1(s.red), s.quality.toFixed(1),
      s.life.toFixed(1), s.saleable, euros(s.freight), euros(s.profit), s.fulfills ? "Yes" : "No"
    ]));
    currentDays = result?.days || [];
    showTable("market-days", ["Harvest", "Dispatch", "Expected arrival", "Arrival red", "Saleable",
      "Freight", "Net", "Feasible"], currentDays.map(d => d.expected
      ? [d.date, time(d.dispatch), time(d.expected.arrival), percent1(d.expected.red), count(d.saleable),
        euros(d.freight), euros(d.profit), d.feasible ? "Yes" : "No"]
      : [d.date, "—", "—", "—", "—", "—", "—", "No arrival in window"]));
    draw();
  }

  function setPreset(button) {
    const values = { ...api.defaults, ...api.presets[button.dataset.route] };
    // Change the route without discarding customer thresholds or commercial inputs.
    for (const key of ["destination", "distance", "drive", "delay", "fixed"]) {
      form.elements[key].value = toForm(key, values[key]);
    }
    document.querySelectorAll("#market-presets button").forEach(preset =>
      preset.setAttribute("aria-pressed", String(preset === button)));
    renderMarket();
  }
  for (const input of form.elements) {
    if (input.type === "checkbox") input.checked = api.defaults[input.name];
    else input.value = toForm(input.name, api.defaults[input.name]);
  }
  document.querySelectorAll("#market-presets button").forEach(button =>
    button.addEventListener("click", () => setPreset(button)));
  form.addEventListener("submit", event => event.preventDefault());
  form.addEventListener("input", renderMarket);
  document.addEventListener("harvestwindow:forecast", renderMarket);
  document.getElementById("market-metric").addEventListener("change", draw);
  new ResizeObserver(draw).observe(document.getElementById("market-chart"));
  renderMarket();
})();
