from datetime import date, timedelta
from importlib.util import find_spec
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import numpy as np
import pandas as pd

if not all(find_spec(package) for package in ("scipy", "xgboost")):
    raise unittest.SkipTest("Install requirements-ml.txt to run the ML checks")

from evaluate_ml import Benchmark
from ml_features import origin_features
from ml_models import ForecastPath
from model import Curve, plan

ROOT = Path(__file__).resolve().parents[1]


class MLTests(unittest.TestCase):
    def test_origin_features_ignore_future_records_and_confirmation(self):
        cutoff = date(2024, 11, 5)
        days = pd.date_range("2024-10-28", "2024-11-07")
        history = pd.DataFrame(1.0, index=days, columns=["dli", "temp", "rh", "co2", "temp_sd", "lamp"])
        frames = {cutoff - timedelta(days=1): 0.2, cutoff: 0.3, cutoff + timedelta(days=1): 0.4}
        before = origin_features(history, frames, cutoff)
        history.loc["2024-11-06":] = 999
        after = origin_features(history, frames, cutoff)
        self.assertEqual(before["temp7"], after["temp7"])
        self.assertEqual(after["dli_cumulative"], 9)
        self.assertEqual(after["red"], 0.3)
        self.assertTrue(np.isnan(after["onset_age"]))

    def test_hybrid_residuals_use_only_other_training_rooms(self):
        cutoff = date(2024, 11, 5)
        benchmark = Benchmark.__new__(Benchmark)
        benchmark.cases = [(room, cutoff, cutoff + timedelta(days=7), label)
                           for room, label in [("A", 0.6), ("B", 0.5), ("Held", 1)]]
        benchmark.heat = lambda *_: 750
        benchmark.origin = lambda *_: dict.fromkeys(("dli7", "temp7", "rh7", "co2_7", "red", "onset_age"), 1)
        called = []

        def baseline(rooms, room, origin):
            called.append((rooms, room))
            return Curve(0.03, 750)

        benchmark.baseline = baseline
        with patch("evaluate_ml.fit_booster") as train:
            train.return_value = SimpleNamespace(get_score=lambda **_: {})
            benchmark.fit(("A", "B"), "hybrid", 24)
            matrix, residuals, *_ = train.call_args.args
        self.assertEqual(called, [(("B",), "A"), (("A",), "B")])
        self.assertEqual(len(matrix), 2)
        np.testing.assert_allclose(residuals, [0.1, 0])

    def test_projection_and_planner_accept_bounded_monotone_paths(self):
        path = ForecastPath(lambda heat: np.resize([-0.2, 0.4, 0.3, 1.2], len(heat)))
        result = plan(path, [path], date(2024, 11, 5),
                      dict(heat=750, daily_heat=10, daily_cost=0.03, cost=0.5, area=1, density=20), 320)
        points = result["points"]
        self.assertEqual(len(points), 22)
        self.assertEqual([p["red"] for p in points[:4]], [0, 40, 40, 100])
        self.assertTrue(all(0 <= p["low"] <= p["red"] <= p["high"] <= 100 for p in points))

    def test_export_matches_scored_day_and_original_replay(self):
        def read(name, prefix):
            source = (ROOT / "dashboard" / name).read_text(encoding="utf-8")
            return json.loads(source.removeprefix(prefix).strip().removesuffix(";"))

        data = read("ml-data.js", "window.harvestML = ")
        replay = read("replay-data.js", "window.harvestReplay = ")
        self.assertEqual(data["baseline_mae"], replay["metrics"])
        for room in replay["rooms"]:
            paths = data["forecasts"][room]
            self.assertEqual(paths["never"], replay["rooms"][room]["prior"])
            for row in data["scores"]:
                if row["room"] == room and row["endpoint"] == "harvest" and row["model"] in paths:
                    points = paths[row["model"]]["points"]
                    self.assertEqual(points[row["horizon"]]["red"], row["prediction"])
                    self.assertTrue(all(a["red"] <= b["red"] for a, b in zip(points, points[1:])))
