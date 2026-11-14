"""Grouped benchmark and offline forecast export. Run from harvestwindow/."""
import argparse
from datetime import timedelta
from hashlib import sha256
import json
from pathlib import Path
from statistics import mean

import numpy as np
import pandas as pd
import scipy
import xgboost

from build_replay import ROOT, REPLAY_DAY, create_replay
from ml_features import FEATURE_SETS, labeled_cases, origin_features, read_sources
from ml_models import ForecastPath, hierarchical, fit_booster
from model import LOOKAHEAD, decision_inputs, forecast_curves, plan

OPTIONS = {
    "xgboost_heat": (48, 96),
    "xgboost": (48, 96),
    "hybrid": (24, 48),
    "hierarchical": (0.05, 0.5),
}
LEGACY = ("mean", "persistence", "warmth", "never", "selective", "always")


class Benchmark:
    def __init__(self, sources):
        self.climate, self.finals, self.obs, self.images, self.sensors = sources
        self.rooms = tuple(sorted(self.obs))
        self.cases = list(labeled_cases(self.obs, self.finals))
        self.curves = {}
        self.origins = {}
        self.training = {
            room: [(self.climate[room][day]["heat"], sample["red"])
                   for day, sample in observations.items()]
            for room, observations in self.obs.items()
        }

    def exclude(self, rooms, held):
        return tuple(room for room in rooms if room != held)

    def origin(self, room, cutoff):
        key = room, cutoff
        if key not in self.origins:
            self.origins[key] = origin_features(self.sensors[room], self.images[room], cutoff)
        return self.origins[key]

    def heat(self, room, cutoff, horizon):
        inputs = decision_inputs(cutoff, self.climate[room])
        return inputs["heat"] + inputs["daily_heat"] * horizon

    def baseline(self, rooms, room, cutoff):
        if room in rooms:
            raise ValueError("Forecast room must be held out")
        key = rooms, room, cutoff
        if key not in self.curves:
            self.curves[key] = forecast_curves(
                room, cutoff, {r: self.training[r] for r in rooms},
                self.climate, self.images, True)[0]
        return self.curves[key]

    def matrix(self, room, cutoff, heat, features):
        heat = np.atleast_1d(heat)
        origin = self.origin(room, cutoff)
        return pd.DataFrame({name: heat if name == "gdd" else origin[name]
                             for name in features}, index=range(len(heat)))

    def fit(self, rooms, method, parameter):
        if method == "hierarchical":
            curve = hierarchical({r: self.training[r] for r in rooms}, parameter)
            return lambda room, cutoff, heat: curve.predict(heat), {}
        features = FEATURE_SETS["heat" if method == "xgboost_heat" else "fusion"]
        hybrid = method == "hybrid"
        matrices, targets = [], []
        for room, cutoff, target, observed in self.cases:
            if room not in rooms:
                continue
            heat = self.heat(room, cutoff, (target - cutoff).days)
            matrices.append(self.matrix(room, cutoff, heat, features))
            if hybrid:
                observed -= self.baseline(self.exclude(rooms, room), room, cutoff).predict(heat)
            targets.append(observed)
        monotone = None if hybrid else (1,) + (0,) * (len(features) - 1)
        model = fit_booster(pd.concat(matrices, ignore_index=True), targets, parameter, monotone)

        def predict(room, cutoff, heat):
            estimate = model.inplace_predict(self.matrix(room, cutoff, heat, features).to_numpy(dtype=float))
            if hybrid:
                estimate = self.baseline(rooms, room, cutoff).predict(heat) + estimate
            return estimate

        return predict, model.get_score(importance_type="gain")

    def path(self, predict, room, cutoff):
        return ForecastPath(lambda heat: predict(room, cutoff, heat))

    def tune(self, rooms, method):
        # Score every label once per inner held-out room, using the same origin rule as outer evaluation.
        scores = []
        for option in OPTIONS[method]:
            errors = []
            for held in rooms:
                predict, _ = self.fit(self.exclude(rooms, held), method, option)
                for room, cutoff, target, observed in self.cases:
                    if room != held:
                        continue
                    heat = self.heat(room, cutoff, np.arange((target - cutoff).days + 1))
                    errors.append(abs(self.path(predict, room, cutoff).predict(heat)[-1] - observed))
            scores.append(mean(errors))
        return OPTIONS[method][int(np.argmin(scores))]

    def run(self, replay):
        forecasts, scores, decisions, fits = {}, [], [], []
        replay_rows = {r["room"]: r for r in replay["evaluation"]}
        for held in self.rooms:
            rooms = self.exclude(self.rooms, held)
            inputs = decision_inputs(REPLAY_DAY, self.climate[held])
            fruit_weight = mean(self.obs[r][REPLAY_DAY]["weight"] for r in rooms)
            heat = self.heat(held, REPLAY_DAY, np.arange(LOOKAHEAD + 1))
            original = replay["rooms"][held]["prior"]
            forecasts[held] = {"never": original}
            decisions.append(decision(held, "never", original, original))
            for method in OPTIONS:
                parameter = self.tune(rooms, method)
                predict, gain = self.fit(rooms, method, parameter)
                path = self.path(predict, held, REPLAY_DAY)
                sensitivity = [
                    self.path(self.fit(self.exclude(rooms, omitted), method, parameter)[0],
                              held, REPLAY_DAY)
                    for omitted in rooms
                ]
                forecast = plan(path, sensitivity, REPLAY_DAY, inputs, fruit_weight)
                forecasts[held][method] = forecast
                decisions.append(decision(held, method, forecast, original))
                fits.append({"room": held, "model": method, "parameter": parameter, "gain": gain,
                             "raw_decreasing_steps": int(np.sum(np.diff(path.raw_predict(heat)) < -1e-7))})
                for room, cutoff, target, observed in self.cases:
                    if room != held:
                        continue
                    days = (target - cutoff).days
                    projected = self.heat(room, cutoff, np.arange(days + 1))
                    estimate = self.path(predict, room, cutoff).predict(projected)[-1]
                    scores.append(score(room, cutoff, target, method, observed * 100, estimate * 100))
            for room, cutoff, target, observed in self.cases:
                if room != held:
                    continue
                if target == self.finals[held]:
                    row = replay_rows[held]
                    for method in LEGACY:
                        scores.append(score(room, cutoff, target, method, row["actual"],
                                            row["predictions"][method]))
                else:
                    projected = self.heat(room, cutoff, (target - cutoff).days)
                    for method, use_camera in (("warmth", False), ("never", True)):
                        curve, _, _ = forecast_curves(
                            room, cutoff, {r: self.training[r] for r in rooms},
                            self.climate, self.images, use_camera)
                        scores.append(score(room, cutoff, target, method, observed * 100,
                                            curve.predict(projected) * 100))
        return forecasts, scores, decisions, fits


def score(room, cutoff, target, model, actual, predicted):
    return {"room": room, "origin": cutoff.isoformat(), "date": target.isoformat(),
            "horizon": (target - cutoff).days, "model": model, "actual": round(actual, 2),
            "prediction": round(float(predicted), 2), "error": round(round(float(predicted), 2) - round(actual, 2), 2),
            "endpoint": "harvest" if cutoff == REPLAY_DAY else "destructive"}


def decision(room, model, forecast, original):
    selected = forecast["selected"]
    point = forecast["points"][selected] if selected is not None else None
    return {"room": room, "model": model, "action": forecast["action"],
            "selected": point["date"] if point else None,
            "shift_days": selected - original["selected"]
            if selected is not None and original["selected"] is not None else None,
            "simulated_profit": point["profit"] if point else None,
            **{f"first_{threshold}": next((p["date"] for p in forecast["points"] if p["red"] >= threshold), None)
               for threshold in (50, 70, 85)}}


def metrics(scores):
    df = pd.DataFrame(scores)
    df["band"] = np.where(df.horizon <= 7, "6-7 days", np.where(df.horizon <= 11, "8-11 days", "12-16 days"))
    harvest = df[df.endpoint == "harvest"]
    result = []
    for subset, data in [("harvest", harvest), ("destructive", df[df.endpoint == "destructive"]),
                         *list(harvest.groupby("band"))]:
        for model, values in data.groupby("model"):
            errors = values.error.to_numpy()
            result.append({"subset": subset, "model": model, "n": len(errors),
                           "mae": round(float(np.abs(errors).mean()), 3),
                           "rmse": round(float(np.sqrt((errors ** 2).mean())), 3),
                           "bias": round(float(errors.mean()), 3)})
    return result


def paired_sensitivity(scores):
    data = pd.DataFrame(scores)
    errors = data[data.endpoint == "harvest"].pivot(index="room", columns="model", values="error").abs()
    result = []
    for model in OPTIONS:
        for reference in ("mean", "never"):
            delta = errors[model] - errors[reference]
            leave_one_out = [(delta.sum() - value) / (len(delta) - 1) for value in delta]
            result.append({"model": model, "reference": reference, "wins": int((delta < 0).sum()),
                           "mean_delta": round(float(delta.mean()), 3),
                           "drop_one_min": round(min(leave_one_out), 3),
                           "drop_one_max": round(max(leave_one_out), 3)})
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--camera", type=Path, default=ROOT / "data/noon_red_index.csv")
    parser.add_argument("--output", type=Path, default=ROOT / "ml_results")
    parser.add_argument("--dashboard-export", type=Path, default=ROOT / "dashboard/ml-data.js")
    args = parser.parse_args()
    benchmark = Benchmark(read_sources(args.archive, args.camera))
    replay = create_replay(args.archive, args.camera)
    forecasts, scores, decisions, fits = benchmark.run(replay)
    cases = [{"room": r, "origin": c.isoformat(), "date": t.isoformat(), "plants": benchmark.obs[r][t]["n"],
              "actual": round(y * 100, 2), "gdd": benchmark.heat(r, c, (t - c).days),
              **benchmark.origin(r, c)} for r, c, t, y in benchmark.cases]
    case_frame = pd.DataFrame(cases)
    missing = {f: int(case_frame[f].isna().sum()) for f in FEATURE_SETS["fusion"]}
    report = {"metrics": metrics(scores), "paired": paired_sensitivity(scores),
              "scores": scores, "decisions": decisions, "fits": fits,
              "missing": missing, "labels": len(cases), "baseline_mae": replay["metrics"],
              "sources": {"archive_sha256": sha256(args.archive.read_bytes()).hexdigest(),
                          "camera_sha256": sha256(args.camera.read_bytes()).hexdigest()},
              "versions": {"numpy": np.__version__, "scipy": scipy.__version__,
                           "xgboost": xgboost.__version__, "pandas": pd.__version__}}
    args.output.mkdir(parents=True, exist_ok=True)
    case_frame.to_csv(args.output / "features.csv", index=False, float_format="%.6f")
    for name in ("metrics", "scores", "decisions", "paired"):
        pd.DataFrame(report[name]).to_csv(args.output / f"{name}.csv", index=False)
    (args.output / "report.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    asset = {**report, "forecasts": forecasts}
    args.dashboard_export.write_text("window.harvestML = " + json.dumps(asset, separators=(",", ":"),
                                                                         allow_nan=False) + ";\n", encoding="utf-8")
    print(pd.DataFrame(report["metrics"]).query("subset == 'harvest'").to_string(index=False))


if __name__ == "__main__":
    main()
