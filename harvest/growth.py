"""When the fruit stops gaining weight: the "weight complete" day (shipping extension).

Fruit weight per plant follows an S-curve in warmth since planting (degree-days, G):
    weight(G) = W_max / (1 + exp(-a (G - G_half)))
`a` and `G_half` are shared by all rooms; W_max (final fruit weight) differs per room. After the
"weight complete" warmth (the share `growth.complete_share` of W_max, 98% by default) the fruit no
longer gets heavier: picking from then on costs no weight and the fruit only turns red.

Honest testing (SPEC D6): the curve for a room is fitted on the *other* rooms' weighings dated on or
before today. With too few weighings the configured starting guess is used instead.
"""
from __future__ import annotations

import math
from datetime import date, timedelta

import numpy as np
from scipy.optimize import least_squares

from harvest.common import Inputs, known_by


def weight_curve(g, w_max: float, a: float, g_half: float):
    """Fruit weight (g per plant) at warmth g. Hand check: w_max 300, a 0.02, g_half 500, g 500 -> 150."""
    return w_max / (1 + np.exp(-a * (np.asarray(g, dtype=float) - g_half)))


def complete_gdd(a: float, g_half: float, share: float) -> float:
    """Warmth at which fruit reaches `share` of its final weight.

    Hand check: a 0.0148, g_half 474, share 0.98 -> 474 + ln(49)/0.0148 = 474 + 263.0 = 737.0.
    """
    return g_half + math.log(share / (1 - share)) / a


def fit_growth(samples, settings: dict) -> dict:
    """Half-weight warmth from crop weighings (room, gdd_cum, fw_total); steepness stays at the setting.

    The steepness is held at `growth.prior_steepness` because three weighings per room cannot show
    where the curve flattens (freeing it on 6 Nov data gave 778-862 dd, against 737 dd on the full
    season); with it held, 6 Nov data gives 739-748 dd. Fits only when at least `growth.min_rooms`
    rooms each have 3+ weighings, the latest past the starting half-weight point. Returns
    {a, g_half, fitted (bool), rooms (n)}.
    """
    gs = settings['growth']
    prior = dict(a=float(gs['prior_steepness']), g_half=float(gs['prior_half_gdd']), fitted=False, rooms=0)
    s = samples.dropna(subset=['fw_total', 'gdd_cum'])
    s = s[s.groupby('room').gdd_cum.transform('count') >= 3]
    s = s[s.groupby('room').gdd_cum.transform('max') > prior['g_half']]
    rooms = sorted(s.room.unique())
    if len(rooms) < int(gs['min_rooms']):
        return prior
    idx = s.room.map({r: i for i, r in enumerate(rooms)}).to_numpy()
    g, w = s.gdd_cum.to_numpy(float), s.fw_total.to_numpy(float)

    a = prior['a']

    def resid(p):
        return (weight_curve(g, np.asarray(p[1:])[idx], a, p[0]) - w) / np.sqrt(np.maximum(w, 30.0))

    p0 = [prior['g_half']] + [float(s[s.room == r].fw_total.max()) for r in rooms]
    lo = [200.0] + [10.0] * len(rooms)
    hi = [1200.0] + [5000.0] * len(rooms)
    p = least_squares(resid, p0, bounds=(lo, hi)).x
    return dict(a=a, g_half=float(p[0]), fitted=True, rooms=len(rooms))


def weight_complete_day(inputs: Inputs, room: str, today: date, gdd_today: float, gdd_rate: float,
                        settings: dict) -> dict:
    """The first day the room's fruit is at `complete_share` of its final weight, as known by today.

    Uses the other rooms' weighings up to today (D6). Past days come from the room's warmth log; future
    days from today's warmth rate. Returns {day, gdd, fitted}; day is None if warmth has stopped.
    Hand check: complete at 737 dd, today 700 dd at 10 dd/day -> ceil(3.7) = 4 days after today.
    """
    rip = known_by(inputs.ripeness, today)
    fit = fit_growth(rip[rip.room != room], settings)
    target = complete_gdd(fit['a'], fit['g_half'], float(settings['growth']['complete_share']))
    if gdd_today >= target:
        log = known_by(inputs.daily[inputs.daily.room == room], today).sort_values('date')
        day = log[log.gdd_cum >= target]['date'].iloc[0]
    elif gdd_rate > 0:
        day = today + timedelta(days=math.ceil((target - gdd_today) / gdd_rate))
    else:
        day = None
    return dict(day=day, gdd=target, fitted=fit['fitted'])
