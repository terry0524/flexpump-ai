"""Original-data checks; download the real 2024 KHNP CSV separately."""
from test_mvp import MODULE, ROOT
import unittest


@unittest.skipUnless((ROOT / "data/raw/15149830.csv").is_file(), "Download the real 2024 KHNP CSV first")
class RealDataIntegrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.frame = MODULE.load_daily(ROOT / "data/raw/15149830.csv")

    def test_daily_quality(self):
        self.assertEqual(len(self.frame), 366)
        self.assertEqual(self.frame["date"].nunique(), 366)

    def test_validation_beats_lag7_on_original_snapshot(self):
        metrics = MODULE.validate_model(self.frame)
        self.assertLess(metrics["ridge_mae_source_units"], metrics["lag7_mae_source_units"])

    def test_forecast_has_guardrail_label(self):
        self.assertTrue(all("DEMO_ONLY" in row["status"] for row in MODULE.demo_forecast(self.frame, 3)))
