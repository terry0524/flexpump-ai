// All values below are static demonstration fixtures, not KHNP observations or model outputs.
export type RiskLevel = "위험" | "주의" | "정상";
export type PlantStatus = "발전" | "양수" | "대기" | "점검";

export type Plant = {
  id: string;
  name: string;
  unit: string;
  status: PlantStatus;
  risk: RiskLevel;
  failureProbability: number;
  upperLevel: number;
  lowerLevel: number;
  confidence: number;
  nextMaintenance: string;
  updatedAt: string;
  anomaly: string;
  signal: string;
};

export const plants: Plant[] = [
  { id: "YC-01", name: "예천양수", unit: "1호기 펌프", status: "발전", risk: "위험", failureProbability: 72, upperLevel: 91.4, lowerLevel: 43.2, confidence: 88, nextMaintenance: "8월 4일 02:00", updatedAt: "1분 전", anomaly: "축 진동 상승", signal: "+18% / 6시간" },
  { id: "YY-02", name: "양양양수", unit: "2호기 펌프", status: "양수", risk: "주의", failureProbability: 41, upperLevel: 76.8, lowerLevel: 52.7, confidence: 84, nextMaintenance: "8월 11일", updatedAt: "2분 전", anomaly: "베어링 온도 편차", signal: "+6.2°C" },
  { id: "CJ-01", name: "청평양수", unit: "1호기 펌프", status: "대기", risk: "주의", failureProbability: 34, upperLevel: 68.1, lowerLevel: 61.9, confidence: 91, nextMaintenance: "8월 18일", updatedAt: "1분 전", anomaly: "효율 저하 패턴", signal: "-3.8% / 7일" },
  { id: "MJ-02", name: "무주양수", unit: "2호기 펌프", status: "발전", risk: "정상", failureProbability: 16, upperLevel: 82.5, lowerLevel: 39.6, confidence: 93, nextMaintenance: "9월 2일", updatedAt: "3분 전", anomaly: "특이사항 없음", signal: "기준 범위" },
  { id: "SC-01", name: "산청양수", unit: "1호기 펌프", status: "대기", risk: "정상", failureProbability: 12, upperLevel: 73.2, lowerLevel: 47.1, confidence: 90, nextMaintenance: "9월 9일", updatedAt: "2분 전", anomaly: "특이사항 없음", signal: "기준 범위" },
  { id: "SS-02", name: "삼랑진양수", unit: "2호기 펌프", status: "점검", risk: "정상", failureProbability: 9, upperLevel: 55.7, lowerLevel: 72.4, confidence: 79, nextMaintenance: "정기점검 중", updatedAt: "8분 전", anomaly: "운전 데이터 없음", signal: "점검 모드" },
  { id: "CS-01", name: "청송양수", unit: "1호기 펌프", status: "양수", risk: "정상", failureProbability: 11, upperLevel: 64.9, lowerLevel: 57.6, confidence: 92, nextMaintenance: "9월 15일", updatedAt: "1분 전", anomaly: "특이사항 없음", signal: "기준 범위" },
];

export const conditionSeries = [
  { time: "00:00", vibration: 2.8, baseline: 3.1 },
  { time: "03:00", vibration: 3.0, baseline: 3.1 },
  { time: "06:00", vibration: 3.2, baseline: 3.1 },
  { time: "09:00", vibration: 3.7, baseline: 3.1 },
  { time: "12:00", vibration: 4.2, baseline: 3.1 },
  { time: "15:00", vibration: 4.9, baseline: 3.1 },
  { time: "18:00", vibration: 5.6, baseline: 3.1 },
  { time: "21:00", vibration: 5.2, baseline: 3.1 },
  { time: "24:00", vibration: 4.8, baseline: 3.1 },
];

export const forecastSeries = [
  { time: "02", expected: 72, low: 61, high: 82 },
  { time: "05", expected: 74, low: 63, high: 84 },
  { time: "08", expected: 77, low: 65, high: 87 },
  { time: "11", expected: 79, low: 66, high: 89 },
  { time: "14", expected: 83, low: 69, high: 92 },
  { time: "17", expected: 86, low: 72, high: 95 },
  { time: "20", expected: 81, low: 68, high: 91 },
  { time: "23", expected: 76, low: 64, high: 87 },
];

export const evidence = [
  { label: "축 진동 RMS", value: "5.6 mm/s", change: "+18%", contribution: 41, status: "임계 초과" },
  { label: "베어링 온도", value: "68.1°C", change: "+7.4°C", contribution: 27, status: "상승 추세" },
  { label: "효율 편차", value: "-4.2%", change: "7일 평균", contribution: 19, status: "주의" },
  { label: "운전시간", value: "1,284 h", change: "+46 h", contribution: 13, status: "정상" },
];
