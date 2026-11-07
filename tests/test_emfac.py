"""Data-integrity checks against the retained public CARB export; no vision imports."""
import csv
import hashlib
import io
import json
from pathlib import Path
import unittest

from emissions.normalize_emfac import normalize

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "emissions/data/la-2026"


class EmfacTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = (DATA / "carb-source.csv").read_bytes()
        cls.config = json.loads((ROOT / "emissions/config/carb-la-2026.json").read_text())
        cls.dataset = json.loads((DATA / "factors.json").read_text())
        cls.receipt = json.loads((DATA / "receipt.json").read_text())

    def normal(self, raw=None, config=None):
        return normalize(self.raw if raw is None else raw, self.config if config is None else config,
                         source_url=self.receipt["source_url"], retrieved_at=self.receipt["retrieved_at"])

    def mutated(self, change):
        reader = csv.DictReader(io.StringIO(self.raw.decode()))
        rows = list(reader)
        target = next(i for i, row in enumerate(rows) if row["process"] == "RUNEX" and row["pollutant"] == "CO2")
        change(rows, target)
        out = io.StringIO()
        writer = csv.DictWriter(out, fieldnames=reader.fieldnames)
        writer.writeheader()
        writer.writerows(rows)
        return out.getvalue().encode()

    def test_source_and_normalized_checksums(self):
        self.assertEqual(hashlib.sha256(self.raw).hexdigest(), self.receipt["source_sha256"])
        self.assertEqual(hashlib.sha256((DATA / "factors.json").read_bytes()).hexdigest(), self.receipt["normalized_sha256"])

    def test_normalization_is_reproducible(self):
        self.assertEqual(self.normal(), self.dataset)

    def test_complete_grid_and_original_source_lines(self):
        rows = list(csv.DictReader(io.StringIO(self.raw.decode())))
        self.assertEqual(len(self.dataset["factors"]), 12 * 18 * 3 * 2)
        for factor in self.dataset["factors"]:
            source = rows[factor["source_line"] - 2]
            self.assertEqual(source["process"], "RUNEX")
            self.assertEqual(source["pollutant"].lower(), factor["pollutant"])
            self.assertEqual(float(source["emission_rate"]), factor["source_g_per_vehicle_mile"])
            self.assertAlmostEqual(factor["g_per_vehicle_km"] * 1.609344, float(source["emission_rate"]), places=9)

    def test_no_idle_start_or_other_pollutants_imported(self):
        self.assertEqual(self.dataset["process"], "RUNEX")
        self.assertEqual({r["pollutant"] for r in self.dataset["factors"]}, {"co2", "nox"})
        self.assertEqual(self.dataset["validation"]["excluded_other_process_or_pollutant_rows"], 13890)

    def test_missing_cell_is_not_zero(self):
        with self.assertRaisesRegex(ValueError, "missing"):
            self.normal(self.mutated(lambda rows, i: rows.pop(i)))

    def test_duplicate_cell_rejected(self):
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            self.normal(self.mutated(lambda rows, i: rows.append(rows[i].copy())))

    def test_non_finite_negative_and_blank_rejected(self):
        for value in ["nan", "inf", "-1", ""]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.normal(self.mutated(lambda rows, i: rows[i].update(emission_rate=value)))

    def test_supported_zero_is_preserved(self):
        zero = self.normal(self.mutated(lambda rows, i: rows[i].update(emission_rate="0")))
        self.assertEqual(sum(r["g_per_vehicle_km"] == 0 for r in zero["factors"]), 1)

    def test_region_year_season_and_meteorology_mismatch_rejected(self):
        for field, value in [("calendar_year", "2025"), ("sub_area", "Statewide"),
                             ("season_month", "Winter"), ("temperature", "90"),
                             ("relative_humidity", "")]:
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.normal(self.mutated(lambda rows, i: rows[i].update({field: value})))

    def test_inventory_or_html_response_rejected(self):
        for raw in [b"calendar_year,emission,vmt\n2026,10,30\n", b"<html>Request rejected</html>"]:
            with self.assertRaisesRegex(ValueError, "columns"):
                self.normal(raw)

    def test_disaggregated_fuel_model_year_or_other_model_rejected(self):
        for change in [{"fuelMode": "By Fuel"}, {"modelYears": "2020"}, {"emfacVersion": "EMFAC2021 v1.0.2"}]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.normal(config={**self.config, **change})

    def test_private_identifiers_not_in_shared_metadata(self):
        for filename in ["factors.json", "receipt.json"]:
            text = (DATA / filename).read_text()
            for forbidden in ["ipAddress", "userAgent", "requestSHA1"]:
                self.assertNotIn(forbidden, text)


if __name__ == "__main__":
    unittest.main()
