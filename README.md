# FlexPump AI

KHNP 공공 API 관측값을 수집·정규화하고 데이터 품질을 표시하는 Python 프로토타입입니다. 별도의 일별 송전량 예측 실험과 정적 dashboard MVP를 포함합니다.

## Problem

양수발전 운영 데이터를 활용하기 전에 측정 시각·결측·비정상 값·서로 다른 원본 지표를 확인해야 합니다. 관측값을 공통 record로 변환하고 품질 검토 근거를 남기는 것에서 시작했습니다.

## Data Sources

| 입력 | 구현 범위 |
|---|---|
| KHNP pumpedAll | 7개 발전소의 수문 관측값 수집 |
| KHNP pumpedpwr | 발전 관측값 수집 |
| KHNP scrap | 거래일·발전원별 24시간 필드의 결측 profile |
| [예천양수 일별 송전량 dataset 15149830](https://www.data.go.kr/data/15149830/fileData.do) | 2024년 366일, 1·2호기 합계 예측 실험 |
| data/sample/synthetic_daily.csv | 생성한 synthetic 실행 fixture. 실제 발전소 관측값이 아님 |

실제 일별 CSV와 live 응답은 포함하지 않습니다. 공식 페이지의 2024년 CSV를 직접 취득해 `data/raw/15149830.csv`에 두세요. Loader는 CP949와 `거래일자`, `1호기 송전량`, `2호기 송전량`의 정확한 열 구성을 기대합니다. 데이터 버전/schema가 달라지면 입력을 먼저 확인하세요. 원문 단위를 임의 환산하지 않습니다. KMA·KPX collector는 구현되어 있지 않습니다.

## Architecture

```text
KHNP XML APIs → Python collector → 공통 관측 record + 품질 flag → local JSON
별도 일별 CSV → schema/중복/결측 검사 → lag/rolling/calendar
             → 시간 순 holdout → Ridge와 lag-7 비교 → demo forecast
정적 TypeScript fixture → Next.js dashboard MVP
```

세 경로는 독립적입니다. Live 품질 flag가 예측 입력 제외에 자동 연결되지 않으며 dashboard는 collector/model 출력을 읽지 않습니다.

## Data Quality Pipeline

`src/khnp_live_api.py`는 KST 측정·수집 시각, 발전소 ID, canonical metric, 원본 지표·값, source ID, SHA-256 hash를 기록합니다. 단위는 `unit=None`, `unit_status=UNVERIFIED`로 남깁니다.

| Flag | 실제 규칙 |
|---|---|
| MISSING | 값 또는 측정 시각 파싱 실패 |
| STALE | 측정 시각이 수집 시각보다 20분 초과 오래됨 |
| OUTLIER | 상·하부 댐 수위 0 또는 유입량 절대값 ≥ 100,000 |
| OK | 위 규칙에 해당하지 않음. 물리적 정확성 보장을 의미하지 않음 |

위 순서로 하나의 flag를 부여합니다. Flag는 검토 표시이며 자동 quarantine/filter가 아닙니다. `SCHEMA_CHANGED` flag는 없습니다. 미매핑 metric은 `unknown`으로 남고 발전량 부호 기반 운전 상태는 검증 전 가설입니다.

일별 CSV는 열 구성·중복 날짜·결측을 검사합니다. 송전량 API profile은 최신 거래일과 이전 거래일의 시간 필드 결측을 분리합니다.

## Prediction

`src/flexpump_mvp.py`: lag 1/2/3/7/14/28, 하루 이동시킨 rolling mean/std, 날짜 주기 feature → StandardScaler + Ridge(alpha=10).

- 마지막 73일을 시간 순 holdout으로 평가하고 lag-7 baseline과 MAE를 비교합니다.
- Holdout은 날짜별 실제 과거 관측값을 사용합니다. 73일 전체를 한 시점에서 재귀 예측한 평가가 아닙니다.
- 7일 재귀 demo는 `DEMO_ONLY_REQUIRES_HYDROLOGY_AND_GRID_CONSTRAINTS` 표시를 포함합니다.
- p80_low/high는 학습 잔차 quantile로 만든 demo band이며 검증된 80% 예측구간이 아닙니다.
- Synthetic 결과는 실행 확인용이며 실제 송전량 예측 성과로 사용하지 않습니다.

## Dashboard

`web/`: Next.js/React/TypeScript/Tailwind/shadcn/ui/Recharts. 발전소 선택·위험도 filter·chart·채택/보류/기각 화면 흐름을 구현했습니다.

모든 화면 값은 `web/src/lib/dashboard-data.ts`의 정적 fixture입니다. 고장 가능성·센서값·신뢰도·정비 시점은 시연값이며 KHNP 실측 또는 Ridge 출력이 아닙니다. 버튼은 local UI state만 변경합니다.

## Validation

```bash
python -m unittest discover -s tests -v
```

API normalization/품질 규칙과 synthetic CSV 실행 테스트는 인증키 없이 실행됩니다. 실제 2024 CSV를 취득한 경우 원본 366일·Ridge/baseline·demo 표시 integration test도 실행되며, 파일이 없으면 해당 3개는 skip됩니다. 테스트는 live API를 호출하지 않습니다.

Dashboard 검사는 `npm run lint`, `npx tsc --noEmit`, `npm run build`입니다. API 인증·물리적 단위·실제 발전소 운영 성능 검증과 구분합니다.

## Limitations

KMA/KPX 수집, SCHEMA_CHANGED, 품질 flag 기반 자동 예측 제외, live dashboard는 미구현입니다. 설비 고장 예측·안전한 운전/정비 판단·운영 최적화·calibrated uncertainty·production scheduler/database도 없습니다. 공모전 제출 문서·인증정보·실제 수집 snapshot은 공개 패키지에서 제외했습니다.

## How to Run

Python 3.10+, Node.js 20.9+:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
python src/flexpump_mvp.py data/sample/synthetic_daily.csv
```

실제 CSV 평가: `python src/flexpump_mvp.py data/raw/15149830.csv`.

공공데이터포털에서 유효한 KHNP key를 발급받으세요. `.env.example`을 복사해 local key를 넣고 환경변수로 읽습니다. 코드가 `.env`를 자동으로 읽지는 않습니다.

```bash
cp .env.example .env
set -a
source .env
set +a
python src/khnp_live_api.py
```

결과는 ignore된 `data/live/`에 저장됩니다. Key·응답·원본 CSV를 commit하지 마세요.

```bash
cd web
npm ci
npm run dev
```

http://localhost:3000에서 정적 시연 화면을 확인합니다.
