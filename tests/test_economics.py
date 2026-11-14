"""Tests for harvest/economics.py: profit by harvest day and the harvest window (SPEC §5)."""
from dataclasses import replace
from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest

from harvest.economics import (costs_so_far, fruit_weight, harvest_window, plant_pct, pot_revenue,
                               profit_by_day, profit_m2_day)

TODAY = date(2024, 11, 6)
ROOM = 'tomatonuts'   # fixture room index 4: cost 0.24 €/m²/day, density 56 then 28 from day 30, fw 300 g


def test_plant_pct_spread_on_log_odds_scale():
    # room 50 % red, spread 12.5 points -> log-odds sd 4 * 12.5 / 100 = 0.5
    # pot one sd ahead: 100 / (1 + e^-0.5) = 62.246 ; one sd behind: 37.754 ; at the mean: 50
    got = plant_pct(50, 12.5, z=np.array([-1.0, 0.0, 1.0]))
    assert got == pytest.approx([37.754, 50.0, 62.246], abs=1e-3)
    # spread squeezes near the ends: room at 95 % -> log-odds 2.944 + 0.5 = 3.444 -> 96.90 %
    assert plant_pct(95, 12.5, z=np.array([1.0]))[0] == pytest.approx(96.90, abs=0.01)


def test_tiny_hand_worked_profit_day(settings):
    econ = settings['economics']
    # two pots, 300 g fruit each: pot A 20 % red (60 g red, under a third -> unsellable -> €0),
    # pot B 60 % red (180 g red, capped at 150 g -> full price €2.15)
    rev = pot_revenue(np.array([20.0, 60.0]), 300.0, 2.15, econ)
    assert rev == pytest.approx([0.0, 2.15])
    # mean €1.075 per pot; 20 pots/m², €30/m² other costs, 80 days grown, €0.75 per plant:
    # (20 * (1.075 - 0.75) - 30) / 80 = (6.5 - 30) / 80 = -0.29375 €/m²/day
    assert profit_m2_day(rev.mean(), 20, 30.0, 80, 0.75) == pytest.approx(-0.29375)


def test_unsellable_pots_earn_nothing(settings):
    econ = settings['economics']
    # just under a third red earns 0; just over earns price * red_g / 150: 0.34 * 300 = 102 g -> 2.15 * 102/150 = 1.462
    rev = pot_revenue(np.array([33.0, 34.0]), 300.0, 2.15, econ)
    assert rev[0] == 0.0
    assert rev[1] == pytest.approx(1.462)


def test_costs_so_far(inputs, settings):
    # tomatonuts: 3 Sep..6 Nov = 65 log days * €0.24 = 15.6, plus one re-spacing (56 -> 28) * €1.50 = 17.1
    c = costs_so_far(inputs, ROOM, TODAY, settings['economics'])
    assert c['running_m2'] == pytest.approx(17.1)
    assert c['rate_m2_day'] == pytest.approx(0.24)
    assert c['density'] == 28.0 and c['spacings'] == 1


def test_fruit_weight_latest_sample_known_by_today(inputs):
    assert fruit_weight(inputs, ROOM, TODAY) == 300.0
    # a room with no samples yet borrows the other rooms' mean on their latest sample day
    r = inputs.ripeness.copy()
    r.loc[(r.room == ROOM) & (r.date == date(2024, 11, 5)), 'fw_total'] = 999.0  # must not be used before 5 Nov
    r = r[~((r.room == 'ideas') & (r['sample'] != 'final'))]
    other = replace(inputs, ripeness=r)
    assert fruit_weight(other, ROOM, date(2024, 10, 30)) == 300.0
    assert fruit_weight(other, 'ideas', TODAY) == pytest.approx((999.0 + 4 * 300.0) / 5)


def _flat_forecast(pct, days=3):
    """A forecast with the same % red every day (band = same)."""
    return pd.DataFrame(dict(date=[TODAY + timedelta(days=h) for h in range(days)],
                             pct_red=pct, pct_red_low=pct, pct_red_high=pct))


def test_profit_by_day_hand_worked(inputs, settings):
    # all pots fully red: every pot earns €2.15 (300 g red capped at 150 g)
    # revenue 28 pots * 2.15 = 60.2 €/m²; cost today 17.1 + plants 28 * 0.75 = 21 -> 38.1 €/m²
    # day 0: 65 days grown -> (60.2 - 38.1) / 65 = 0.34 €/m²/day
    # day 1: cost +0.24 = 38.34, 66 days -> 21.86 / 66 = 0.331212
    c = profit_by_day(inputs, ROOM, TODAY, _flat_forecast(100.0), {}, settings=settings)
    assert c.cost_to_date_m2.tolist()[:2] == pytest.approx([38.1, 38.34])
    assert c.profit_m2_day.tolist()[:2] == pytest.approx([0.34, 0.331212], abs=1e-6)
    assert (c.sellable_share == 1.0).all()
    # band: low price 1.75 -> (28 * 1.75 - 38.1) / 65 = 0.167692 ; high 2.50 -> (70 - 38.1) / 65 = 0.490769
    assert c.profit_low[0] == pytest.approx(0.167692, abs=1e-6)
    assert c.profit_high[0] == pytest.approx(0.490769, abs=1e-6)


def test_green_room_sells_nothing(inputs, settings):
    c = profit_by_day(inputs, ROOM, TODAY, _flat_forecast(1.0), {}, settings=settings)
    assert (c.sellable_share == 0).all() and (c.revenue_m2 == 0).all()
    # only costs: -38.1 / 65 = -0.586154
    assert c.profit_m2_day[0] == pytest.approx(-0.586154, abs=1e-6)


def test_profit_by_day_on_fixture_forecast(inputs, settings, forecast_fixture):
    c = profit_by_day(inputs, ROOM, TODAY, forecast_fixture, {}, settings=settings)
    for col in ['sellable_share', 'profit_m2_day', 'profit_low', 'profit_high', 'cost_to_date_m2']:
        assert c[col].notna().all()
    assert (c.profit_low <= c.profit_m2_day + 1e-12).all() and (c.profit_m2_day <= c.profit_high + 1e-12).all()
    assert c.sellable_share.is_monotonic_increasing          # % red only rises in the fixture
    assert (c.sellable_share_early >= c.sellable_share_late).all()


def test_window_ordering_and_best_day_sellable(inputs, settings, forecast_fixture):
    c = profit_by_day(inputs, ROOM, TODAY, forecast_fixture, {}, settings=settings)
    w = harvest_window(c, settings)
    need = settings['economics']['earliest_sellable_share']
    assert w['earliest_sellable_day'] is not None
    assert w['earliest_sellable_day'] <= w['best_day']
    if w['losses_start_day'] is not None:
        assert w['best_day'] < w['losses_start_day']
    assert w['best_day_low'] <= w['best_day'] <= w['best_day_high']
    best = c[c.date == w['best_day']].iloc[0]
    assert best.sellable_share >= need                        # never a best day with too many unsellable pots
    assert w['profit_best_m2_day'] == pytest.approx(c.profit_m2_day.max() if (c.sellable_share >= need).all()
                                                    else c[c.sellable_share >= need].profit_m2_day.max())
    # early ripening reaches its best day no later than late ripening
    assert w['best_day_low'] <= w['best_day_high']


def test_window_hand_built_curve(settings):
    # Five days. Sellable share reaches 0.95 on day 2. Per-day profit peaks on day 1 (but only 90 %
    # sellable there), so the best day is day 3 (the best day that meets the share).
    # Total profit (revenue - cost): 10, 14, 15, 16, 15.5 -> first fall after day 3 is day 4.
    d0 = date(2024, 11, 6)
    c = pd.DataFrame(dict(
        date=[d0 + timedelta(days=i) for i in range(5)],
        sellable_share=[0.5, 0.9, 0.95, 1.0, 1.0],
        profit_m2_day=[0.10, 0.30, 0.20, 0.25, 0.24],
        revenue_m2=[20.0, 25.0, 26.5, 28.0, 28.0],
        cost_to_date_m2=[10.0, 11.0, 11.5, 12.0, 12.5],
        sellable_share_early=[0.9, 0.95, 1.0, 1.0, 1.0], profit_m2_day_early=[0.1, 0.27, 0.26, 0.2, 0.1],
        sellable_share_late=[0.1, 0.5, 0.9, 0.96, 1.0], profit_m2_day_late=[0.0, 0.1, 0.2, 0.21, 0.22]))
    w = harvest_window(c, settings)
    assert w['earliest_sellable_day'] == d0 + timedelta(days=2)
    assert w['best_day'] == d0 + timedelta(days=3)
    assert w['losses_start_day'] == d0 + timedelta(days=4)
    assert w['profit_best_m2_day'] == pytest.approx(0.25)
    # early: best of days 1-4 (share >= .95) = day 1 ; late: best of days 3-4 = day 4
    assert w['best_day_low'] == d0 + timedelta(days=1)
    assert w['best_day_high'] == d0 + timedelta(days=4)


def test_window_when_never_sellable(settings):
    d0 = date(2024, 11, 6)
    c = pd.DataFrame(dict(date=[d0, d0 + timedelta(days=1)], sellable_share=[0.0, 0.2], profit_m2_day=[-0.5, -0.4],
                          revenue_m2=[0.0, 1.0], cost_to_date_m2=[30.0, 30.2],
                          sellable_share_early=[0.0, 0.3], profit_m2_day_early=[-0.5, -0.3],
                          sellable_share_late=[0.0, 0.1], profit_m2_day_late=[-0.5, -0.45]))
    w = harvest_window(c, settings)
    assert w['earliest_sellable_day'] is None
    assert w['best_day'] == d0 + timedelta(days=1)    # least-bad day when nothing reaches the share
    assert w['losses_start_day'] is None
