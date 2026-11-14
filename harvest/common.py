"""Shared loading and date helpers for the Tomato Harvest POC pipeline.

Owner: integrator. Lanes import from here; they don't edit it (see docs/development-plan.md §1).

Inputs are the derived tables `main`'s scripts write to `out/` (all built from the organizer dataset).
Set HARVEST_INPUTS to point at another folder with the same files (tests use tests/fixtures/inputs).
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import yaml

REPO = Path(__file__).resolve().parent.parent
ROOMS = ['agrifusion', 'ideas', 'mugrow', 'reference', 'tomatonuts', 'trigger']
PLANTED = date(2024, 9, 3)
FIRST_TODAY = date(2024, 10, 20)   # earliest "today" the app offers (contracts/app-data.md §1)


@dataclass
class Inputs:
    """The tables the pipeline reads. Every `date` column is a datetime.date."""
    daily: pd.DataFrame      # room x day: climate, degree-days (gdd_cum), costs, density
    ripeness: pd.DataFrame   # room x measurement day: mean % red by weight, fruit weight, gdd_cum
    plants: pd.DataFrame     # room x measurement day x plant: fw_total, fw_red, pct_red_weight
    images: pd.DataFrame     # room x day: noon photo red_index, green_pct, canopy_distance_mm, lamps_on_noon
    weather: pd.DataFrame    # day: outside temperature, sun
    folder: Path


def _read(folder: Path, name: str) -> pd.DataFrame:
    df = pd.read_csv(folder / name)
    if 'team' in df.columns:
        df = df.rename(columns={'team': 'room'})
    if 'date' in df.columns:
        df['date'] = pd.to_datetime(df['date']).dt.date
    return df


def inputs_folder(path: str | os.PathLike | None = None) -> Path:
    """Folder holding dash/*.csv: argument, else $HARVEST_INPUTS, else <repo>/out."""
    return Path(path or os.environ.get('HARVEST_INPUTS') or REPO / 'out')


def load_inputs(path: str | os.PathLike | None = None) -> Inputs:
    """Load the five input tables from `<folder>/dash/`."""
    d = inputs_folder(path) / 'dash'
    daily = _read(d, 'daily.csv').sort_values(['room', 'date']).reset_index(drop=True)
    daily['density'] = daily.groupby('room')['density'].transform(lambda s: s.ffill().fillna(56.0))
    return Inputs(daily=daily, ripeness=_read(d, 'ripeness.csv'), plants=_read(d, 'plants.csv'),
                  images=_read(d, 'images.csv'), weather=_read(d, 'weather.csv'), folder=d.parent)


def load_settings(path: str | os.PathLike | None = None) -> dict:
    """Crop settings: config/crop.yaml (L05) if it exists, else the fixture copy."""
    p = Path(path) if path else REPO / 'config' / 'crop.yaml'
    if not p.exists():
        p = REPO / 'tests' / 'fixtures' / 'crop.yaml'
    with open(p) as f:
        return yaml.safe_load(f)


def actual_harvest(inputs: Inputs, room: str) -> date:
    """The day the grower actually harvested the room (the 'final' measurement)."""
    r = inputs.ripeness
    return r[(r.room == room) & (r['sample'] == 'final')]['date'].iloc[0]


def today_range(inputs: Inputs, room: str) -> list[date]:
    """Every 'today' the app offers for a room: FIRST_TODAY to the day before its harvest."""
    end = actual_harvest(inputs, room) - timedelta(days=1)
    n = (end - FIRST_TODAY).days + 1
    return [FIRST_TODAY + timedelta(days=i) for i in range(max(n, 0))]


def known_by(df: pd.DataFrame, today: date) -> pd.DataFrame:
    """Rows dated on or before `today`: what a grower would know at the end of that day."""
    return df[df['date'] <= today]
