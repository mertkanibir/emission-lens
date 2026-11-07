"""Strict normalizer for aggregated EMFAC Web project-analysis CSV exports."""
from __future__ import annotations

import csv
import hashlib
import io
import itertools
import math
from datetime import datetime

MILES_TO_KM = 1.609344
OUTPUT_DOC = "https://emfac.arb.ca.gov/emfac2025-usersguide/uchap/ch7.output.html"
METHOD_DOC = "https://emfac.arb.ca.gov/emfac2025-usersguide/uchap/ch6.pl_mode.html"
REQUIRED_COLUMNS = {
    "calendar_year", "season_month", "sub_area", "vehicle_class", "temperature",
    "relative_humidity", "process", "speed_time", "pollutant", "emission_rate",
}


def number(value: str, field: str) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"Invalid number in {field}.") from error
    if not math.isfinite(result):
        raise ValueError(f"Non-finite number in {field}.")
    return result


def normalize(raw: bytes, config: dict, *, source_url: str, retrieved_at: str) -> dict:
    if (config["emfacVersion"] != "EMFAC2025 v2.1.1" or config["region"] != "Los Angeles (SC)"
            or config["seasonMonthValue"] != "Annual"):
        raise ValueError("This importer is scoped to EMFAC2025 v2.1.1, Los Angeles (SC), Annual.")
    if config["fuelMode"] != "Aggregate" or config["modelYears"] != "Aggregate":
        raise ValueError("Only CARB-aggregated fuel and model-year factors are supported.")
    if config["regionType"] != "Sub-Area" or config["seasonMonth"] != "Season":
        raise ValueError("Expected one sub-area and a documented season.")
    if config["vehicleCategoryMode"] != "emfac2007":
        raise ValueError("Expected the EMFAC2007 vehicle-category scheme.")
    year = int(config["calendarYears"])
    classes = config["vehicleCategory"].split(",")
    speeds = [int(value) for value in config["speeds"].split(",")]
    if len(classes) != len(set(classes)) or not classes:
        raise ValueError("Duplicate or missing requested vehicle classes.")
    if speeds != list(range(5, 91, 5)):
        raise ValueError("Expected all 18 EMFAC speed bins, 5 through 90 mph.")
    pairs = [tuple(map(int, pair.split(","))) for pair in config["temperatureHumidity"].split(":")]
    if len(pairs) != len(set(pairs)) or any(not (0 <= t <= 120 and 0 <= h <= 100) for t, h in pairs):
        raise ValueError("Invalid or duplicate meteorological assumptions.")
    if not source_url.startswith("https://emfac.arb.ca.gov/media/"):
        raise ValueError("Factors must retain their CARB export URL.")
    if not retrieved_at.endswith("Z") or datetime.fromisoformat(retrieved_at[:-1] + "+00:00").utcoffset().total_seconds() != 0:
        raise ValueError("Retrieval time must be UTC.")
    reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))
    if reader.fieldnames is None or not REQUIRED_COLUMNS.issubset(reader.fieldnames):
        raise ValueError("Unrecognized EMFAC project-analysis CSV columns.")
    # These columns must be absent for the aggregate export. A schema change
    # requires review instead of accidentally mixing fuel/model-year rows.
    if {"fuel", "model_year"}.intersection(reader.fieldnames):
        raise ValueError("Unexpected fuel/model-year dimensions in an aggregate export.")
    factors, seen = [], set()
    source_rows, excluded = 0, 0
    for line, row in enumerate(reader, start=2):
        source_rows += 1
        if (row["calendar_year"] != str(year) or row["sub_area"] != config["region"]
                or row["season_month"] != config["seasonMonthValue"]):
            raise ValueError(f"Unexpected year, region, or season at source line {line}.")
        pollutant = row["pollutant"].lower()
        if row["process"] != "RUNEX" or pollutant not in {"co2", "nox"}:
            excluded += 1
            continue
        vehicle = row["vehicle_class"]
        speed = number(row["speed_time"], "speed_time")
        temp = number(row["temperature"], "temperature")
        humidity = number(row["relative_humidity"], "relative_humidity")
        rate = number(row["emission_rate"], "emission_rate")
        if vehicle not in classes or speed not in speeds or (temp, humidity) not in pairs or rate < 0:
            raise ValueError(f"Unexpected factor dimensions or negative rate at source line {line}.")
        key = (vehicle, pollutant, int(speed), int(temp), int(humidity))
        if key in seen:
            raise ValueError(f"Duplicate factor key at source line {line}: {key}")
        seen.add(key)
        factors.append({
            "vehicle_class": vehicle,
            "pollutant": pollutant,
            "speed_bin_mph": int(speed),
            "temperature_f": int(temp),
            "relative_humidity_pct": int(humidity),
            "source_g_per_vehicle_mile": rate,
            "g_per_vehicle_km": rate / MILES_TO_KM,
            "source_line": line,
        })
    expected = {
        (v, p, s, t, h)
        for v, p, s, (t, h) in itertools.product(classes, ["co2", "nox"], speeds, pairs)
    }
    if seen != expected:
        raise ValueError(f"Incomplete factors: {len(expected - seen)} requested cells are missing. Missing is not zero.")
    factors.sort(key=lambda row: (row["vehicle_class"], row["pollutant"], row["temperature_f"], row["relative_humidity_pct"], row["speed_bin_mph"]))
    source_hash = hashlib.sha256(raw).hexdigest()
    return {
        "schema_version": "1.0",
        "factor_version": f"emfac2025-v2.1.1-la-sc-{year}-annual-{source_hash[:12]}",
        "model_version": config["emfacVersion"],
        "source_url": source_url,
        "source_sha256": source_hash,
        "retrieved_at": retrieved_at,
        "methodology_url": METHOD_DOC,
        "output_documentation_url": OUTPUT_DOC,
        "region": config["region"],
        "calendar_year": year,
        "season": config["seasonMonthValue"],
        "vehicle_category_scheme": "EMFAC2007",
        "fuel_assumption": "CARB regional VMT-weighted fuel mixture; aggregated by CARB",
        "model_year_assumption": "CARB regional age mixture; aggregated by CARB",
        "process": "RUNEX",
        "source_units": "g/vehicle-mile",
        "units": "g/vehicle-km",
        "meteorology_assumptions": [
            {"temperature_f": t, "relative_humidity_pct": h} for t, h in pairs
        ],
        "range_interpretation": "Sensitivity across specified temperatures at fixed humidity; not a confidence interval or complete uncertainty range.",
        "missing_cell_policy": "Reject incomplete requested CO2/NOx RUNEX grids; never fill absent cells with zero.",
        "request": config,
        "validation": {
            "source_rows": source_rows,
            "excluded_other_process_or_pollutant_rows": excluded,
            "factor_rows": len(factors),
            "expected_factor_rows": len(expected),
            "duplicate_keys": 0,
            "missing_cells": 0,
            "non_finite_or_negative_rates": 0,
        },
        "factors": factors,
    }
