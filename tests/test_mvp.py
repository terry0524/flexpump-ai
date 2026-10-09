import importlib.util
import math
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("flexpump_mvp", ROOT / "src" / "flexpump_mvp.py")
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class FlexPumpMvpTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Synthetic fixture; not real operational data or an accuracy benchmark.
        cls.frame = MODULE.load_daily(ROOT / "data" / "sample" / "synthetic_daily.csv")

    def test_daily_quality(self):
        self.assertEqual(len(self.frame), 366)
        self.assertEqual(self.frame["date"].nunique(), 366)

    def test_validation_reports_finite_metrics(self):
        metrics = MODULE.validate_model(self.frame)
        self.assertEqual(metrics["test_rows"], 73)
        self.assertTrue(math.isfinite(metrics["ridge_mae_source_units"]))
        self.assertTrue(math.isfinite(metrics["lag7_mae_source_units"]))

    def test_forecast_has_guardrail_label(self):
        forecast = MODULE.demo_forecast(self.frame, horizon=3)
        self.assertEqual(len(forecast), 3)
        self.assertTrue(all("DEMO_ONLY" in row["status"] for row in forecast))


if __name__ == "__main__":
    unittest.main()
