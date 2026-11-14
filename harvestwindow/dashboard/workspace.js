"use strict";
(() => {
  const main = document.querySelector("main");
  const harvest = [".workspace", ".stats", "#economics"];
  const views = {
    planner: ["Is it time to harvest?", harvest],
    market: ["Plan a delivery", ["#market"]],
    orders: ["Fill an order", ["#orders"]],
    operations: ["Check the crop", ["#operations", "#camera-section"]],
    journal: ["Manage greenhouse work", ["#journal"]],
    evidence: ["Review forecast results", ["#evidence", "#model-comparison", "#methods"]]
  };
  function showView() {
    const target = location.hash.slice(1);
    const view = Object.hasOwn(views, target) ? target
      : Object.keys(views).find(key => views[key][1].includes("#" + target)) || "planner";
    const [title, selectors] = views[view];
    document.getElementById("workspace-title").textContent = title;
    for (const panel of [...main.children].filter(node => !node.matches(".intro"))) {
      panel.toggleAttribute("data-view-hidden", !panel.matches(selectors.join(",")));
    }
    for (const link of document.querySelectorAll(".masthead nav a")) {
      if (link.hash === "#" + view) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    if (target === view || !target) window.scrollTo(0, 0);
    else requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView());
  }
  window.addEventListener("hashchange", showView);
  showView();
})();
