"use strict";
(() => {
  const data = window.harvestML;
  const section = document.getElementById("model-comparison");
  if (!data) { section.hidden = true; return; }
  const byId = id => document.getElementById(id);
  const names = {
    mean: "Mean final ripeness", persistence: "Last measured ripeness", warmth: "Warmth only",
    never: "Logistic + camera", selective: "Selective sampling", always: "Sample all rooms",
    xgboost_heat: "XGBoost · heat only", xgboost: "XGBoost · sensor and camera",
    hybrid: "Logistic + XGBoost residual", hierarchical: "Hierarchical logistic"
  };
  function showTable(id, headers, rows) {
    byId(id).replaceChildren();
    table(id, headers, rows.map(values => ({values})));
  }
  showTable("ml-metrics", ["Model", "Rooms", "MAE (pp)", "RMSE (pp)", "Bias (pp)"],
    data.metrics.filter(row => row.subset === "harvest").sort((a,b) => a.mae - b.mae)
      .map(row => [names[row.model], row.n, row.mae, row.rmse, row.bias]));
  const selector = byId("ml-model");
  for (const name of ["xgboost", "hybrid", "hierarchical", "xgboost_heat"]) selector.add(new Option(names[name], name));

  function draw(points, baseline, observation) {
    const canvas = byId("ml-chart");
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = devicePixelRatio || 1;
    canvas.width = width * ratio; canvas.height = height * ratio;
    const ctx = canvas.getContext("2d"); ctx.scale(ratio, ratio);
    const x = i => 47 + i * (width - 67) / 21;
    const y = red => 14 + (100 - red) * (height - 43) / 100;
    ctx.font = "12px system-ui";
    ctx.fillStyle = "#52645a";
    for (const step of [0,25,50,75,100]) {
      ctx.strokeStyle = "#dce4d9"; ctx.beginPath();
      ctx.moveTo(x(0),y(step)); ctx.lineTo(x(21),y(step)); ctx.stroke();
      ctx.fillText(step + "%", 1, y(step) + 4);
    }
    for (const step of [0,7,14,21]) ctx.fillText("+" + step + "d", x(step) - 8, height - 6);
    ctx.beginPath();
    points.forEach((p,i) => ctx.lineTo(x(i),y(p.high)));
    for (let i = 21; i >= 0; i--) ctx.lineTo(x(i),y(points[i].low));
    ctx.closePath(); ctx.fillStyle = "#dfedcf"; ctx.fill();
    for (const [series,color,dash] of [[baseline,"#546477",[5,4]],[points,"#266248",[]]]) {
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.setLineDash(dash);
      series.forEach((p,i) => ctx.lineTo(x(i),y(p.red))); ctx.stroke();
    }
    ctx.beginPath(); ctx.fillStyle = "#ae4837";
    ctx.arc(x(observation.horizon),y(observation.actual),5,0,2*Math.PI); ctx.fill();
  }

  function render() {
    const room = byId("room").value;
    const model = selector.value;
    const reference = data.forecasts[room].never.points;
    const experiment = data.forecasts[room][model].points;
    const scores = data.scores.filter(row => row.room === room && row.endpoint === "harvest");
    const observed = scores.find(row => row.model === model);
    byId("ml-room-title").textContent = room + " · red fruit by weight";
    byId("ml-legend").textContent = "Green: experimental · dashed: logistic · dot: observed at harvest";
    byId("ml-actual").textContent = "On " + observed.date + ", measured " + observed.actual +
      "%. Experimental forecast " + observed.prediction + "% (" + observed.error + " pp signed error).";
    draw(experiment, reference, observed);
    showTable("ml-decisions", ["Model", "Action", "Modelled harvest", "Shift (days)", "First ≥70% red"],
      data.decisions.filter(row => row.room === room).map(row =>
        [names[row.model], row.action, row.selected ?? "Beyond outlook", row.shift_days ?? "—", row.first_70 ?? "Beyond outlook"]));
    showTable("ml-errors", ["Model","Predicted (%)","Signed error (pp)"],
      scores.map(row => [names[row.model],row.prediction,row.error]));
    showTable("ml-days", ["Date","Logistic (%)","Experimental (%)","Scenario range (%)"],
      experiment.map((p,i) => [p.date,reference[i].red,p.red,p.low + "–" + p.high]));
    const fit = data.fits.find(row => row.room === room && row.model === model);
    const gain = Object.entries(fit.gain).sort((a,b) => b[1] - a[1]);
    byId("ml-gain").textContent = gain.length
      ? "Training-fold mean split gain: " + gain.map(([key,value]) => key + " " + value.toFixed(3)).join(", ") +
        ". Gain describes this fitted model; correlated inputs may substitute for each other."
      : "Tree split gain is unavailable for this model.";
  }
  selector.addEventListener("change", render);
  byId("room").addEventListener("change", render);
  new ResizeObserver(render).observe(byId("ml-chart"));
  render();
})();
