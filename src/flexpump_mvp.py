"""Reproducible, non-operational FlexPump AI proof of concept.

This module validates the public daily Yecheon dataset, fits a leakage-safe
baseline, and emits seven demo forecast rows. It never controls equipment and
does not claim to represent KHNP operating constraints.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


FEATURES = [
    "lag_1", "lag_2", "lag_3", "lag_7", "lag_14", "lag_28",
    "mean_7", "mean_14", "mean_28", "std_7", "std_14", "std_28",
    "dow_sin", "dow_cos", "doy_sin", "doy_cos",
]


def load_daily(path: Path) -> pd.DataFrame:
    frame = pd.read_csv(path, encoding="cp949")
    expected = {"거래일자", "1호기 송전량", "2호기 송전량"}
    if set(frame.columns) != expected:
        raise ValueError(f"Unexpected schema: {list(frame.columns)}")
    frame["date"] = pd.to_datetime(frame["거래일자"], errors="raise")
    frame["target"] = frame["1호기 송전량"] + frame["2호기 송전량"]
    frame = frame.sort_values("date").reset_index(drop=True)
    if frame["date"].duplicated().any() or frame[list(expected)].isna().any().any():
        raise ValueError("Duplicate dates or missing values detected")
    return frame[["date", "target"]]


def make_features(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    for lag in (1, 2, 3, 7, 14, 28):
        out[f"lag_{lag}"] = out["target"].shift(lag)
    history = out["target"].shift(1)
    for window in (7, 14, 28):
        out[f"mean_{window}"] = history.rolling(window).mean()
        out[f"std_{window}"] = history.rolling(window).std()
    out["dow_sin"] = np.sin(2 * np.pi * out["date"].dt.dayofweek / 7)
    out["dow_cos"] = np.cos(2 * np.pi * out["date"].dt.dayofweek / 7)
    out["doy_sin"] = np.sin(2 * np.pi * out["date"].dt.dayofyear / 366)
    out["doy_cos"] = np.cos(2 * np.pi * out["date"].dt.dayofyear / 366)
    return out.dropna().reset_index(drop=True)


def validate_model(frame: pd.DataFrame) -> dict[str, float | int]:
    featured = make_features(frame)
    split = len(featured) - 73
    train, test = featured.iloc[:split], featured.iloc[split:]
    model = make_pipeline(StandardScaler(), Ridge(alpha=10.0))
    model.fit(train[FEATURES], train["target"])
    prediction = model.predict(test[FEATURES])
    ridge_mae = mean_absolute_error(test["target"], prediction)
    lag7_mae = mean_absolute_error(test["target"], test["lag_7"])
    return {
        "train_rows": int(len(train)),
        "test_rows": int(len(test)),
        "ridge_mae_source_units": round(float(ridge_mae), 2),
        "lag7_mae_source_units": round(float(lag7_mae), 2),
        "mae_improvement_pct": round(float((lag7_mae - ridge_mae) / lag7_mae * 100), 1),
    }


def demo_forecast(frame: pd.DataFrame, horizon: int = 7) -> list[dict[str, object]]:
    history = frame.copy()
    featured = make_features(history)
    model = make_pipeline(StandardScaler(), Ridge(alpha=10.0))
    model.fit(featured[FEATURES], featured["target"])
    residual = featured["target"] - model.predict(featured[FEATURES])
    half_width = float(np.quantile(np.abs(residual), 0.8))
    rows: list[dict[str, object]] = []
    for _ in range(horizon):
        next_date = history["date"].iloc[-1] + pd.Timedelta(days=1)
        provisional = pd.concat(
            [history, pd.DataFrame({"date": [next_date], "target": [np.nan]})],
            ignore_index=True,
        )
        x = make_features_for_last(provisional)
        point = max(0.0, float(model.predict(x[FEATURES])[0]))
        history.loc[len(history)] = [next_date, point]
        rows.append(
            {
                "date": next_date.date().isoformat(),
                "predicted_transmission_source_units": round(point, 2),
                "p80_low": round(max(0.0, point - half_width), 2),
                "p80_high": round(point + half_width, 2),
                "status": "DEMO_ONLY_REQUIRES_HYDROLOGY_AND_GRID_CONSTRAINTS",
            }
        )
    return rows


def make_features_for_last(frame: pd.DataFrame) -> pd.DataFrame:
    last = len(frame) - 1
    date = frame.loc[last, "date"]
    values: dict[str, list[float]] = {}
    for lag in (1, 2, 3, 7, 14, 28):
        values[f"lag_{lag}"] = [frame.loc[last - lag, "target"]]
    for window in (7, 14, 28):
        history = frame.loc[last - window : last - 1, "target"]
        values[f"mean_{window}"] = [history.mean()]
        values[f"std_{window}"] = [history.std()]
    values.update(
        {
            "dow_sin": [np.sin(2 * np.pi * date.dayofweek / 7)],
            "dow_cos": [np.cos(2 * np.pi * date.dayofweek / 7)],
            "doy_sin": [np.sin(2 * np.pi * date.dayofyear / 366)],
            "doy_cos": [np.cos(2 * np.pi * date.dayofyear / 366)],
        }
    )
    return pd.DataFrame(values)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("csv", type=Path, help="Path to KHNP dataset 15149830.csv")
    args = parser.parse_args()
    frame = load_daily(args.csv)
    output = {
        "disclaimer": "Technical demo only; not an operating recommendation.",
        "data_quality": {
            "rows": len(frame),
            "start": frame["date"].min().date().isoformat(),
            "end": frame["date"].max().date().isoformat(),
            "missing_calendar_days": int(
                len(pd.date_range(frame["date"].min(), frame["date"].max())) - len(frame)
            ),
        },
        "validation": validate_model(frame),
        "forecast": demo_forecast(frame),
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
