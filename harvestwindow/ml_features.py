"""Build one forecast-origin feature row per measured room/date."""
from datetime import timedelta
from io import BytesIO
from zipfile import ZipFile

import numpy as np
import pandas as pd

from build_replay import PREFIX, REPLAY_DAY, load_climate, load_images, load_measurements
from model import confirmed_onset

SENSORS = {
    "par": "compartment/par",
    "rh": "compartment/relative_humidity",
    "co2": "compartment/co2_concentration",
    "temp": "compartment/air_temperature",
    "lamp": "compartment/lamps_activation_percentage",
}
FEATURE_SETS = {
    "heat": ("gdd",),
    "fusion": ("gdd", "dli7", "temp7", "rh7", "co2_7", "red", "onset_age"),
}


def daily_sensors(archive, rooms):
    result = {}
    for room in rooms:
        stream = BytesIO(archive.read(f"{PREFIX}timeseries/{room.lower()}.csv"))
        raw = pd.read_csv(stream, usecols=lambda col: col == "time" or col in SENSORS.values())
        raw = raw.set_index(pd.to_datetime(raw.pop("time").str[:10])).sort_index()
        for key, name in SENSORS.items():
            raw[key] = pd.to_numeric(raw[name], errors="coerce") if name in raw else np.nan
        raw["par"] = raw.par.where(raw.par >= 0)
        raw["rh"] = raw.rh.where(raw.rh.between(0, 100))
        raw["co2"] = raw.co2.where(raw.co2 > 0)
        raw["lamp"] = raw.lamp.where(raw.lamp.between(0, 100))
        group = raw.groupby(level=0)
        daily = group[list(SENSORS)].mean()
        # Integrate five-minute samples only when at least 90% of a local day is covered.
        local_midnight = daily.index.tz_localize("Europe/Amsterdam")
        expected = ((local_midnight + pd.DateOffset(days=1) - local_midnight)
                    / pd.Timedelta(minutes=5))
        daily["dli"] = (group.par.sum(min_count=1) * 300 / 1e6).where(
            group.par.count() >= 0.9 * expected)
        daily["temp_sd"] = group.temp.std()
        result[room] = daily
    return result


def read_sources(path, camera):
    with ZipFile(path) as archive:
        climate, harvest = load_climate(archive)
        observations = load_measurements(archive, harvest)
        sensors = daily_sensors(archive, climate)
    return climate, harvest, observations, load_images(camera), sensors


def origin_features(sensors, frames, cutoff):
    past = sensors.loc[:pd.Timestamp(cutoff)]
    week = past.loc[pd.Timestamp(cutoff - timedelta(days=6)):]
    onset = confirmed_onset(frames, cutoff)
    recent = [day for day in frames if cutoff - timedelta(days=2) <= day <= cutoff]
    return {
        "dli7": week.dli.mean(), "temp7": week.temp.mean(), "rh7": week.rh.mean(),
        "co2_7": week.co2.mean(), "temp3": week.tail(3).temp.mean(),
        "temp_sd7": week.temp_sd.mean(), "lamp7": week.lamp.mean(),
        "dli_cumulative": past.dli.sum(min_count=1),
        "dli_days_missing": int(past.dli.isna().sum()),
        "days_since_first_log": (pd.Timestamp(cutoff) - past.index.min()).days,
        "red": frames[max(recent)] if recent else np.nan,
        "onset_age": (cutoff - onset).days if onset else np.nan,
    }


def labeled_cases(observations, finals):
    for room, labels in observations.items():
        for target, sample in sorted(labels.items()):
            origin = REPLAY_DAY if target == finals[room] else target - timedelta(days=7)
            yield room, origin, target, sample["red"]
