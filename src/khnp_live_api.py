"""KHNP public API collector with explicit data-quality guardrails.

The service key is read only from ``DATA_GO_KR_SERVICE_KEY`` and is never
written to output. Source units remain unverified until KHNP confirms them.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import ssl
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET
from zoneinfo import ZoneInfo


KST = ZoneInfo("Asia/Seoul")
PLANTS = {
    "CP": ("3310", "청평"), "SR": ("3320", "삼랑진"),
    "MJ": ("3330", "무주"), "SC": ("3340", "산청"),
    "YY": ("3350", "양양"), "CS": ("3360", "청송"),
    "YC": ("3370", "예천"),
}
ENDPOINTS = {
    "hydrology": "https://apis.data.go.kr/B552041/pumpedAll/getpumpedAll",
    "power": "https://apis.data.go.kr/B552041/pumpedpwr/getpumpedpwr",
    "transmission": "https://apis.data.go.kr/B552041/scrap/getscrap",
}


def tls_context() -> ssl.SSLContext:
    cert_file = Path(os.environ.get("SSL_CERT_FILE", "/etc/ssl/cert.pem"))
    return ssl.create_default_context(cafile=str(cert_file)) if cert_file.exists() else ssl.create_default_context()


def fetch_items(url: str, service_key: str, **params: str) -> tuple[bytes, list[dict[str, str]]]:
    query = urlencode({"serviceKey": service_key, **params})
    request = Request(f"{url}?{query}", headers={"User-Agent": "FlexPumpAI/0.1"})
    with urlopen(request, timeout=20, context=tls_context()) as response:
        payload = response.read()
    root = ET.fromstring(payload)
    code = root.findtext(".//resultCode")
    message = root.findtext(".//resultMsg")
    if code != "00":
        raise RuntimeError(f"KHNP API error {code}: {message}")
    items = [{child.tag: child.text or "" for child in node} for node in root.findall(".//item")]
    return payload, items


def parse_number(raw: str) -> float | None:
    try:
        return float(raw.replace(",", "").strip())
    except (AttributeError, ValueError):
        return None


def parse_observed_at(raw: str) -> datetime | None:
    try:
        return datetime.strptime(raw.strip(), "%Y-%m-%d %H:%M").replace(tzinfo=KST)
    except (AttributeError, ValueError):
        return None


def canonical_metric(description: str) -> str:
    rules = (
        ("상부댐수위", "upper_reservoir_level"),
        ("하부댐수위", "lower_reservoir_level"),
        ("강수량", "rainfall"),
        ("총방류량", "release_flow"),
        ("저수율", "storage_percent"),
        ("상부저수지 실시간 저수량", "upper_storage"),
        ("하부저수지 실시간 저수량", "lower_storage"),
        ("유입량", "inflow"),
        ("수문개도", "gate_opening"),
        ("실시간 양수량", "pumping_flow"),
        ("발전량", "power"),
    )
    return next((metric for text, metric in rules if text in description), "unknown")


def quality_for(metric: str, value: float | None, observed_at: datetime | None, fetched_at: datetime) -> tuple[str, str]:
    if value is None or observed_at is None:
        return "MISSING", "값 또는 측정시각을 파싱할 수 없음"
    if (fetched_at - observed_at).total_seconds() > 20 * 60:
        return "STALE", "실시간 데이터가 수집시각보다 20분 이상 오래됨"
    if metric in {"upper_reservoir_level", "lower_reservoir_level"} and value == 0:
        return "OUTLIER", "댐 수위 0: 실제 영점인지 계측 결측인지 확인 필요"
    if metric == "inflow" and abs(value) >= 100_000:
        return "OUTLIER", "유입량 절대값이 매우 큼: 단위와 부호 확인 전 모델 제외"
    return "OK", ""


def normalize_item(item: dict[str, str], plant_code: str, plant_name: str, source_id: str, fetched_at: datetime) -> dict[str, Any]:
    description = item.get("expl", "")
    metric = canonical_metric(description)
    value = parse_number(item.get("value", ""))
    observed_at = parse_observed_at(item.get("time", ""))
    quality_flag, quality_reason = quality_for(metric, value, observed_at, fetched_at)
    row: dict[str, Any] = {
        "observed_at": observed_at.isoformat() if observed_at else None,
        "plant_id": plant_code,
        "plant_name": plant_name,
        "metric": metric,
        "value": value,
        "unit": None,
        "unit_status": "UNVERIFIED",
        "source_id": source_id,
        "source_metric": item.get("name"),
        "source_description": description,
        "fetched_at": fetched_at.isoformat(),
        "quality_flag": quality_flag,
        "quality_reason": quality_reason,
        "raw_payload_hash": hashlib.sha256(json.dumps(item, ensure_ascii=False, sort_keys=True).encode()).hexdigest(),
    }
    if metric == "power" and value is not None:
        row["operating_state_inferred"] = "GENERATION" if value > 1 else "PUMPING" if value < -1 else "STANDBY"
        row["operating_state_basis"] = "발전량 부호 기반 가설; 장기 시계열로 검증 필요"
    return row


def transmission_profile(items: list[dict[str, str]]) -> dict[str, Any]:
    dates = sorted({item.get("tradeDt", "") for item in items if item.get("tradeDt")})
    missing_hours = 0
    non_numeric = 0
    segment_counts: dict[tuple[str, str], dict[str, int]] = {}
    for item in items:
        segment = (item.get("tradeDt", "UNKNOWN"), item.get("resourceType", "UNKNOWN"))
        counts = segment_counts.setdefault(segment, {"rows": 0, "missing_hour_fields": 0, "present_hour_fields": 0})
        counts["rows"] += 1
        for hour in range(1, 25):
            raw = item.get(f"qt_{hour}h")
            if raw in (None, ""):
                missing_hours += 1
                counts["missing_hour_fields"] += 1
            elif parse_number(raw) is None:
                non_numeric += 1
            else:
                counts["present_hour_fields"] += 1
    latest_date = dates[-1] if dates else None
    missing_latest_date = sum(
        counts["missing_hour_fields"] for (date, _), counts in segment_counts.items() if date == latest_date
    )
    missing_prior_dates = missing_hours - missing_latest_date
    return {
        "rows": len(items),
        "trade_date_min": dates[0] if dates else None,
        "trade_date_max": dates[-1] if dates else None,
        "distinct_trade_dates": len(dates),
        "resource_type_counts": dict(sorted(Counter(x.get("resourceType", "UNKNOWN") for x in items).items())),
        "missing_hour_fields": missing_hours,
        "missing_hour_fields_latest_date": missing_latest_date,
        "missing_hour_fields_prior_dates": missing_prior_dates,
        "latest_date_completion_note": (
            "최신 거래일 시간대가 게시 시점상 미완결일 수 있음; 다음 수집에서 보완 여부 확인"
            if missing_latest_date else "최신 거래일 24시간 필드가 모두 채워짐"
        ),
        "non_numeric_hour_values": non_numeric,
        "unit_status": "UNVERIFIED",
        "segments": [
            {"trade_date": date, "resource_type": resource_type, **counts}
            for (date, resource_type), counts in sorted(segment_counts.items())
        ],
    }


def collect(service_key: str, include_transmission: bool = True) -> dict[str, Any]:
    fetched_at = datetime.now(KST).replace(microsecond=0)
    raw_xml: dict[str, str] = {}
    observations: list[dict[str, Any]] = []
    coverage: list[dict[str, Any]] = []
    for short_code, (numeric_code, plant_name) in PLANTS.items():
        raw_hydro, hydro_items = fetch_items(ENDPOINTS["hydrology"], service_key, genName=short_code)
        raw_power, power_items = fetch_items(ENDPOINTS["power"], service_key, genName=numeric_code)
        raw_xml[f"hydrology_{short_code}"] = raw_hydro.decode("utf-8", errors="replace")
        raw_xml[f"power_{numeric_code}"] = raw_power.decode("utf-8", errors="replace")
        hydro_rows = [normalize_item(x, numeric_code, plant_name, "KHNP_PUMPED_ALL", fetched_at) for x in hydro_items]
        power_rows = [normalize_item(x, numeric_code, plant_name, "KHNP_PUMPED_PWR", fetched_at) for x in power_items]
        observations.extend(hydro_rows + power_rows)
        coverage.append({
            "plant_id": numeric_code,
            "plant_name": plant_name,
            "hydrology_metrics": len(hydro_rows),
            "power_metrics": len(power_rows),
            "quality_counts": dict(Counter(x["quality_flag"] for x in hydro_rows + power_rows)),
        })
    transmission_items: list[dict[str, str]] = []
    if include_transmission:
        raw, transmission_items = fetch_items(ENDPOINTS["transmission"], service_key)
        raw_xml["transmission"] = raw.decode("utf-8", errors="replace")
    return {
        "fetched_at": fetched_at.isoformat(),
        "disclaimer": "Public-data snapshot only; not an equipment-control or safety decision.",
        "observations": observations,
        "plant_coverage": coverage,
        "transmission_profile": transmission_profile(transmission_items) if include_transmission else None,
        "transmission_items": transmission_items,
        "raw_xml": raw_xml,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    parser.add_argument("--without-transmission", action="store_true")
    args = parser.parse_args()
    service_key = os.environ.get("DATA_GO_KR_SERVICE_KEY")
    if not service_key:
        raise SystemExit("Set DATA_GO_KR_SERVICE_KEY before running the collector.")
    result = collect(service_key, include_transmission=not args.without_transmission)
    output = args.output or Path("data/live") / f"khnp_{datetime.now(KST):%Y%m%d_%H%M%S}.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
