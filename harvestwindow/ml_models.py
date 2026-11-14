"""Small-data forecasting models, fitted independently for each training room set."""
import numpy as np
from scipy.optimize import least_squares
import xgboost as xgb

from model import Curve

SEED = 42


def fit_booster(features, targets, rounds, monotone):
    params = dict(objective="reg:squarederror", max_depth=1, eta=0.08,
                  reg_lambda=3, min_child_weight=2, tree_method="hist", nthread=1, seed=SEED)
    if monotone:
        params["monotone_constraints"] = "(" + ",".join(map(str, monotone)) + ")"
    matrix = xgb.DMatrix(features.to_numpy(dtype=float), label=np.asarray(targets),
                         feature_names=list(features.columns), nthread=1)
    return xgb.train(params, matrix,
                     num_boost_round=rounds)


def hierarchical(training, shrinkage):
    """Shared slope, population midpoint, and penalized room midpoint deviations."""
    heat, label, room_index = np.concatenate([
        np.column_stack((rows, np.full(len(rows), i)))
        for i, rows in enumerate(training.values())
    ]).T
    room_index = room_index.astype(int)
    n = len(training)

    def residual(params):
        slope, midpoint = params[:2]
        offsets = params[2:]
        logit = slope * (heat - midpoint - offsets[room_index])
        error = 1 / (1 + np.exp(-np.clip(logit, -60, 60))) - label
        return np.r_[error, np.sqrt(shrinkage) * offsets / 100]

    fit = least_squares(residual, [0.03, 750, *([0] * n)],
                        bounds=([0.004, 450, *([-200] * n)], [0.09, 1100, *([200] * n)]))
    if not fit.success:
        raise RuntimeError(fit.message)
    return Curve(*fit.x[:2])


class ForecastPath:
    """Adapter for the existing planner's projected heat inputs."""
    def __init__(self, predict):
        self.raw_predict = predict

    def predict(self, heat):
        return np.maximum.accumulate(np.clip(self.raw_predict(heat), 0, 1))

    def log_odds(self, heat):
        bounded = np.clip(self.predict(heat), 1e-9, 1 - 1e-9)
        return np.log(bounded / (1 - bounded))
