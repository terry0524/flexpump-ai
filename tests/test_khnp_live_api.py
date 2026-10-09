import importlib.util
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("khnp_live_api", ROOT / "src" / "khnp_live_api.py")
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class KhnpLiveApiTest(unittest.TestCase):
    def setUp(self):
        self.fetched_at = datetime(2026, 8, 11, 13, 50, tzinfo=ZoneInfo("Asia/Seoul"))

    def test_number_parser_handles_thousands_separator(self):
        self.assertEqual(MODULE.parse_number("-197,323.0"), -197323.0)

    def test_zero_water_level_is_flagged(self):
        row = MODULE.normalize_item(
            {"expl": "청송 하부댐수위", "name": "3360LOWL", "time": "2026-08-11 13:45", "value": "0.0"},
            "3360", "청송", "KHNP_PUMPED_ALL", self.fetched_at,
        )
        self.assertEqual(row["quality_flag"], "OUTLIER")

    def test_stale_observation_is_flagged(self):
        observed = datetime(2026, 8, 11, 13, 29, tzinfo=ZoneInfo("Asia/Seoul"))
        flag, _ = MODULE.quality_for("power", 1.0, observed, self.fetched_at)
        self.assertEqual(flag, "STALE")

    def test_missing_value_is_flagged(self):
        flag, _ = MODULE.quality_for("power", None, self.fetched_at, self.fetched_at)
        self.assertEqual(flag, "MISSING")

    def test_negative_power_is_labeled_as_inferred_pumping(self):
        row = MODULE.normalize_item(
            {"expl": "예천 발전량", "name": "3370-PWRGEN.C", "time": "2026-08-11 13:45", "value": "-416.8"},
            "3370", "예천", "KHNP_PUMPED_PWR", self.fetched_at,
        )
        self.assertEqual(row["operating_state_inferred"], "PUMPING")
        self.assertIn("가설", row["operating_state_basis"])

    def test_metric_mapping(self):
        self.assertEqual(MODULE.canonical_metric("삼랑진 상부저수지 실시간 저수량"), "upper_storage")
        self.assertEqual(MODULE.canonical_metric("양양 양수 수문개도2"), "gate_opening")

    def test_transmission_missingness_separates_latest_date(self):
        rows = [
            {"tradeDt": "20260809", "resourceType": "양수", **{f"qt_{h}h": "1" for h in range(1, 25)}},
            {"tradeDt": "20260810", "resourceType": "양수", "qt_1h": "1"},
        ]
        profile = MODULE.transmission_profile(rows)
        self.assertEqual(profile["missing_hour_fields"], 23)
        self.assertEqual(profile["missing_hour_fields_latest_date"], 23)
        self.assertEqual(profile["missing_hour_fields_prior_dates"], 0)


if __name__ == "__main__":
    unittest.main()
