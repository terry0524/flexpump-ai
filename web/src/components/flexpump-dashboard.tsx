"use client";

import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Gauge,
  Info,
  Menu,
  Radio,
  ShieldCheck,
  SlidersHorizontal,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { conditionSeries, evidence, forecastSeries, plants, type Plant, type RiskLevel } from "@/lib/dashboard-data";

const riskStyles: Record<RiskLevel, string> = {
  위험: "border-red-200 bg-red-50 text-red-700",
  주의: "border-amber-200 bg-amber-50 text-amber-800",
  정상: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const conditionConfig = {
  vibration: { label: "진동 RMS", color: "#dc2626" },
  baseline: { label: "정상 기준", color: "#94a3b8" },
} satisfies ChartConfig;

const forecastConfig = {
  high: { label: "상한", color: "#bfdbfe" },
  expected: { label: "고장 가능성", color: "#2563eb" },
  low: { label: "하한", color: "#dbeafe" },
} satisfies ChartConfig;

function RiskBadge({ risk }: { risk: RiskLevel }) {
  return (
    <Badge variant="outline" className={`gap-1 font-semibold ${riskStyles[risk]}`}>
      {risk === "위험" ? <AlertTriangle className="size-3" /> : <CheckCircle2 className="size-3" />}
      {risk}
    </Badge>
  );
}

function SourceBadge({ children }: { children: ReactNode }) {
  return (
    <Badge variant="outline" className="border-slate-200 bg-white font-normal text-slate-600">
      <Database className="mr-1 size-3" />
      {children}
    </Badge>
  );
}

function KpiCard({ label, value, meta, tone = "neutral", icon: Icon }: {
  label: string;
  value: string;
  meta: string;
  tone?: "neutral" | "danger" | "warning" | "good";
  icon: ComponentType<{ className?: string }>;
}) {
  const toneClass = {
    neutral: "bg-slate-100 text-slate-700",
    danger: "bg-red-50 text-red-700",
    warning: "bg-amber-50 text-amber-800",
    good: "bg-emerald-50 text-emerald-700",
  }[tone];

  return (
    <Card className="gap-0 border-slate-200 py-0 shadow-none">
      <CardContent className="flex items-start justify-between p-4">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{meta}</p>
        </div>
        <div className={`rounded-md p-2 ${toneClass}`}><Icon className="size-4" /></div>
      </CardContent>
    </Card>
  );
}

function PlantTable({ rows, selected, onSelect }: { rows: Plant[]; selected: Plant; onSelect: (plant: Plant) => void }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead className="min-w-40">발전소 / 설비</TableHead>
            <TableHead>운전</TableHead>
            <TableHead>위험도</TableHead>
            <TableHead className="text-right">고장 가능성</TableHead>
            <TableHead className="text-right">상부 수위</TableHead>
            <TableHead>이상징후</TableHead>
            <TableHead>다음 정비</TableHead>
            <TableHead className="text-right">신뢰도</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((plant) => (
            <TableRow
              key={plant.id}
              data-selected={selected.id === plant.id}
              className="cursor-pointer data-[selected=true]:bg-blue-50/70"
              onClick={() => onSelect(plant)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(plant);
                }
              }}
              tabIndex={0}
              aria-label={`${plant.name} 상세 진단 열기`}
            >
              <TableCell><p className="font-semibold text-slate-900">{plant.name}</p><p className="text-xs text-slate-500">{plant.id} · {plant.unit}</p></TableCell>
              <TableCell><span className="inline-flex items-center gap-1.5 text-sm"><span className={`size-2 rounded-full ${plant.status === "점검" ? "bg-slate-400" : "bg-blue-500"}`} />{plant.status}</span></TableCell>
              <TableCell><RiskBadge risk={plant.risk} /></TableCell>
              <TableCell className="text-right font-mono font-semibold">{plant.failureProbability}%</TableCell>
              <TableCell className="text-right font-mono text-slate-700">{plant.upperLevel}%</TableCell>
              <TableCell><p className="text-sm font-medium">{plant.anomaly}</p><p className="text-xs text-slate-500">{plant.signal}</p></TableCell>
              <TableCell className="text-sm">{plant.nextMaintenance}</TableCell>
              <TableCell className="text-right"><span className="font-mono text-sm font-medium">{plant.confidence}%</span><p className="text-[11px] text-slate-400">{plant.updatedAt}</p></TableCell>
              <TableCell><ChevronRight className="size-4 text-slate-400" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function conditionValues(plant: Plant) {
  const severity = plant.risk === "위험" ? 1 : plant.risk === "주의" ? 0.62 : 0.25;
  return {
    vibration: (3.1 + 2.5 * severity).toFixed(1),
    temperature: (57.2 + 10.9 * severity).toFixed(1),
    efficiency: (-1.1 - 3.1 * severity).toFixed(1),
    severity,
  };
}

function ConditionPanel({ plant }: { plant: Plant }) {
  const metrics = conditionValues(plant);
  const series = conditionSeries.map((point) => ({
    ...point,
    vibration: Number((point.baseline + (point.vibration - point.baseline) * metrics.severity).toFixed(1)),
  }));
  const emphasis = plant.risk === "위험"
    ? "border-red-200 bg-red-50 text-red-800"
    : plant.risk === "주의"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className={`rounded-lg border p-3 ${emphasis}`}><p className="text-xs">축 진동 RMS</p><p className="mt-1 font-mono text-xl font-semibold">{metrics.vibration} <span className="text-xs">mm/s</span></p><p className="mt-1 flex items-center text-xs"><ArrowUpRight className="size-3" /> 기준 3.1 대비 · {plant.anomaly}</p></div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-xs text-amber-800">베어링 온도</p><p className="mt-1 font-mono text-xl font-semibold text-amber-900">{metrics.temperature} <span className="text-xs">°C</span></p><p className="mt-1 flex items-center text-xs text-amber-800"><ArrowUpRight className="size-3" /> 최근 신호 {plant.signal}</p></div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-600">펌프 효율 편차</p><p className="mt-1 font-mono text-xl font-semibold">{metrics.efficiency}%</p><p className="mt-1 flex items-center text-xs text-slate-600"><ArrowDownRight className="size-3" /> 7일 평균 대비</p></div>
      </div>
      <ChartContainer config={conditionConfig} className="h-[300px] w-full">
        <LineChart data={series} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={10} />
          <YAxis tickLine={false} axisLine={false} domain={[0, 7]} width={30} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ReferenceLine y={4.5} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "주의 4.5", fill: "#b45309", fontSize: 11 }} />
          <Line type="monotone" dataKey="baseline" stroke="var(--color-baseline)" strokeDasharray="4 4" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="vibration" stroke="var(--color-vibration)" dot={{ r: 3, fill: "#fff" }} strokeWidth={2.5} />
        </LineChart>
      </ChartContainer>
    </>
  );
}

function ForecastPanel({ plant }: { plant: Plant }) {
  const forecast = forecastSeries.map((point) => {
    const expected = Math.max(3, Math.min(95, point.expected - 72 + plant.failureProbability));
    return { ...point, expected, low: Math.max(1, expected - 11), high: Math.min(99, expected + 10) };
  });
  const peak = Math.max(...forecast.map((point) => point.expected));
  return (
    <>
      <div className="mb-4 flex items-start justify-between rounded-lg border border-blue-200 bg-blue-50 p-4"><div><p className="text-sm font-semibold text-blue-950">24시간 내 고장 가능성 최고 {peak}%</p><p className="mt-1 text-xs text-blue-800">현재 추정 {plant.failureProbability}% · 데이터 신뢰도 {plant.confidence}%</p></div><Clock3 className="size-5 text-blue-700" /></div>
      <ChartContainer config={forecastConfig} className="h-[300px] w-full">
        <AreaChart data={forecast} margin={{ right: 12, top: 8 }}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="time" tickFormatter={(value) => `${value}시`} tickLine={false} axisLine={false} tickMargin={10} />
          <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} width={42} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area type="monotone" dataKey="high" stroke="none" fill="var(--color-high)" fillOpacity={0.5} />
          <Area type="monotone" dataKey="low" stroke="none" fill="#fff" fillOpacity={0.9} />
          <Line type="monotone" dataKey="expected" stroke="var(--color-expected)" dot={{ r: 3 }} strokeWidth={2.5} />
        </AreaChart>
      </ChartContainer>
    </>
  );
}

function EvidencePanel({ plant }: { plant: Plant }) {
  const metrics = conditionValues(plant);
  const dynamicEvidence = evidence.map((item, index) => ({
    ...item,
    value: index === 0 ? `${metrics.vibration} mm/s` : index === 1 ? `${metrics.temperature}°C` : index === 2 ? `${metrics.efficiency}%` : item.value,
    status: plant.risk === "정상" && index < 3 ? "정상 범위" : item.status,
  }));
  return <div className="space-y-4">{dynamicEvidence.map((item) => <div key={item.label} className="grid gap-2 rounded-lg border p-4 sm:grid-cols-[180px_1fr_90px] sm:items-center"><div><p className="text-sm font-semibold">{item.label}</p><p className="text-xs text-slate-500">{item.value} · {item.change}</p></div><div><Progress value={item.contribution} className="h-2" /><p className="mt-1 text-[11px] text-slate-500">예측 기여도 {item.contribution}%</p></div><Badge variant="outline" className="justify-center">{item.status}</Badge></div>)}</div>;
}

export function FlexPumpDashboard() {
  const [selected, setSelected] = useState(plants[0]);
  const [riskFilter, setRiskFilter] = useState("전체");
  const [decision, setDecision] = useState<"채택" | "보류" | "기각" | null>(null);
  const filteredPlants = useMemo(
    () => riskFilter === "전체" ? plants : plants.filter((plant) => plant.risk === riskFilter),
    [riskFilter],
  );
  const recommendation = selected.risk === "위험"
    ? { title: `${selected.nextMaintenance} 이전 긴급점검`, priority: "우선순위 1", action: "부하를 70% 이하로 낮춘 뒤 축 진동 센서와 1번 베어링을 확인하세요. 진동이 5.8 mm/s를 넘으면 운전 보류를 권장합니다.", duration: "약 45분", reevaluate: "오늘 20:00", style: "border-red-200 bg-red-50 text-red-950", badge: "bg-red-600" }
    : selected.risk === "주의"
      ? { title: `${selected.nextMaintenance} 이전 집중점검`, priority: "우선순위 2", action: `${selected.anomaly} 신호를 교대조별로 확인하고 다음 계획정비에서 센서와 베어링 상태를 점검하세요.`, duration: "약 30분", reevaluate: "12시간 후", style: "border-amber-200 bg-amber-50 text-amber-950", badge: "bg-amber-600" }
      : { title: `${selected.nextMaintenance} 계획정비 유지`, priority: "우선순위 3", action: "현재 신호는 정상 범위입니다. 자동 조치 없이 기존 점검 주기를 유지하고 데이터 품질만 확인하세요.", duration: "정기점검 내", reevaluate: "24시간 후", style: "border-emerald-200 bg-emerald-50 text-emerald-950", badge: "bg-emerald-600" };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto flex h-16 max-w-[1680px] items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-md bg-blue-600"><Zap className="size-5" /></div><div><p className="text-sm font-semibold tracking-wide">FlexPump AI</p><p className="text-[11px] text-slate-400">양수발전 설비 의사결정 지원</p></div></div>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="주요 메뉴">{["통합 상황판", "설비 진단", "정비 계획", "데이터 품질"].map((item, index) => <Button key={item} variant="ghost" className={index === 0 ? "bg-white/10 text-white hover:bg-white/15 hover:text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}>{item}</Button>)}</nav>
          <div className="flex items-center gap-3"><div className="hidden items-center gap-2 text-xs text-slate-300 sm:flex"><Radio className="size-3.5 text-emerald-400" />정적 시연 · API 미연결</div><Sheet><SheetTrigger render={<Button variant="ghost" size="icon" className="text-white lg:hidden" aria-label="메뉴 열기" />}><Menu /></SheetTrigger><SheetContent side="right"><SheetHeader><SheetTitle>FlexPump AI</SheetTitle><SheetDescription>운영 화면 메뉴</SheetDescription></SheetHeader><div className="grid gap-2 px-4">{["통합 상황판", "설비 진단", "정비 계획", "데이터 품질"].map((item) => <Button key={item} variant="ghost" className="justify-start">{item}</Button>)}</div></SheetContent></Sheet></div>
        </div>
      </header>

      <main className="mx-auto max-w-[1680px] space-y-5 px-4 py-5 lg:px-8 lg:py-7">
        <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div><div className="flex items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight">통합 설비 상황판</h1><Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">MVP 시연</Badge></div><p className="mt-1 text-sm text-slate-500">정적 데이터로 발전소 선택·상세 chart·결정 화면 흐름을 확인합니다.</p></div>
          <div className="flex flex-wrap gap-2"><SourceBadge>정적 fixture</SourceBadge><SourceBadge>collector / Ridge 출력 미연결</SourceBadge><Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800"><Info className="mr-1 size-3" />모든 값은 시연용 데이터</Badge></div>
        </section>

        <Alert className="border-red-200 bg-red-50 text-red-950"><AlertTriangle className="text-red-600" /><AlertTitle>시연 시나리오: 예천양수 1호기 고위험 표시</AlertTitle><AlertDescription className="flex flex-col justify-between gap-2 text-red-800 sm:flex-row sm:items-center"><span>센서·고장 확률·신뢰도·정비 시점은 정적 demo 값입니다. 실제 관측 또는 검증된 예측이 아닙니다.</span><Button size="sm" variant="outline" className="border-red-300 bg-white text-red-700" onClick={() => setSelected(plants[0])}>진단 열기 <ChevronRight /></Button></AlertDescription></Alert>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="정상 운전 설비" value="6 / 7" meta="1개 설비 정기점검 중" tone="good" icon={ShieldCheck} />
          <KpiCard label="고위험 이상징후" value="1건" meta="지난 24시간 +1" tone="danger" icon={AlertTriangle} />
          <KpiCard label="24시간 대응 후보" value="3건" meta="점검 1 · 관찰 2" tone="warning" icon={Wrench} />
          <KpiCard label="평균 예측 신뢰도" value="88.1%" meta="검증 성과가 아닌 시연값" icon={Gauge} />
        </section>

        <Card className="gap-0 border-slate-200 py-0 shadow-none">
          <CardHeader className="flex flex-col gap-3 border-b px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div><CardTitle className="text-base">설비별 위험 비교</CardTitle><CardDescription>위험 설비를 선택하면 하단 진단과 권장 대응이 갱신됩니다.</CardDescription></div><div className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-slate-400" /><Select value={riskFilter} onValueChange={(value) => value && setRiskFilter(value)}><SelectTrigger className="w-36 bg-white" aria-label="위험도 필터"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="전체">위험도 전체</SelectItem><SelectItem value="위험">위험만</SelectItem><SelectItem value="주의">주의만</SelectItem><SelectItem value="정상">정상만</SelectItem></SelectContent></Select></div></CardHeader>
          <CardContent className="p-0"><PlantTable rows={filteredPlants} selected={selected} onSelect={(plant) => { setSelected(plant); setDecision(null); }} /></CardContent>
        </Card>

        <section className="grid gap-5 2xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.75fr)]">
          <Card className="gap-0 border-slate-200 py-0 shadow-none">
            <CardHeader className="border-b px-5 py-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><CardTitle className="text-base">{selected.name} · {selected.unit}</CardTitle><RiskBadge risk={selected.risk} /></div><CardDescription>{selected.id} · 최신 갱신 {selected.updatedAt} · 정적 fixture · 예측 모델 미연결</CardDescription></div><div className="flex gap-2"><SourceBadge>시연 데이터</SourceBadge><SourceBadge>검증된 모델 출력 아님</SourceBadge></div></div></CardHeader>
            <CardContent className="p-5"><Tabs defaultValue="condition"><TabsList className="mb-5"><TabsTrigger value="condition">이상징후 추이</TabsTrigger><TabsTrigger value="forecast">고장 가능성 전망</TabsTrigger><TabsTrigger value="evidence">예측 근거</TabsTrigger></TabsList><TabsContent value="condition"><ConditionPanel plant={selected} /></TabsContent><TabsContent value="forecast"><ForecastPanel plant={selected} /></TabsContent><TabsContent value="evidence"><EvidencePanel plant={selected} /></TabsContent></Tabs></CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="gap-0 border-slate-200 py-0 shadow-none"><CardHeader className="border-b px-5 py-4"><div className="flex items-center justify-between"><div><CardTitle className="text-base">권장 대응</CardTitle><CardDescription>버튼은 화면 상태만 변경하며 설비를 제어하지 않습니다.</CardDescription></div><Bot className="size-5 text-blue-600" /></div></CardHeader><CardContent className="space-y-4 p-5"><div className={`rounded-lg border p-4 ${recommendation.style}`}><div className="flex items-center justify-between gap-3"><p className="font-semibold">{recommendation.title}</p><Badge className={recommendation.badge}>{recommendation.priority}</Badge></div><p className="mt-2 text-sm leading-6">{recommendation.action}</p></div><div className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-slate-500">예상 점검시간</span><strong>{recommendation.duration}</strong></div><div className="flex justify-between"><span className="text-slate-500">다음 재평가</span><strong>{recommendation.reevaluate}</strong></div><div className="flex justify-between"><span className="text-slate-500">추천 신뢰도</span><strong>{selected.confidence}%</strong></div></div><Separator /><div><p className="mb-2 text-xs font-medium text-slate-500">운영자 결정</p><div className="grid grid-cols-3 gap-2"><Button onClick={() => setDecision("채택")} variant={decision === "채택" ? "default" : "outline"}><CheckCircle2 />채택</Button><Button onClick={() => setDecision("보류")} variant={decision === "보류" ? "secondary" : "outline"}><Clock3 />보류</Button><Button onClick={() => setDecision("기각")} variant={decision === "기각" ? "destructive" : "outline"}><XCircle />기각</Button></div>{decision && <p role="status" className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-xs">결정이 <strong>{decision}</strong>으로 선택됐습니다. 시연용 화면 상태입니다.</p>}</div></CardContent></Card>

            <Card className="gap-0 border-slate-200 py-0 shadow-none"><CardHeader className="border-b px-5 py-4"><CardTitle className="text-base">데이터 연결 범위</CardTitle><CardDescription>화면은 정적 fixture만 사용합니다.</CardDescription></CardHeader><CardContent className="space-y-4 p-5">{[["화면 입력", "정적 시연 fixture"], ["KHNP collector", "별도 Python 구현 · 화면 미연결"], ["Ridge 일별 실험", "별도 CSV 입력 · 화면 미연결"], ["KMA / KPX collector", "미구현"]].map(([name, scope]) => <div key={name} className="flex justify-between gap-3 text-xs"><span className="font-medium">{name}</span><span className="text-slate-500">{scope}</span></div>)}<p className="flex gap-2 rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-600"><Info className="mt-0.5 size-3.5 shrink-0" />모든 센서·확률·정비 시점은 시연값입니다. 실제 관측이나 검증된 모델 출력이 아닙니다.</p></CardContent></Card>
          </div>
        </section>

        <footer className="flex flex-col justify-between gap-2 border-t py-4 text-xs text-slate-500 sm:flex-row"><span>FlexPump AI · 공공데이터 기반 의사결정 지원 시제품</span><span>자동제어·보호계전·안전판단 기능 없음 · 최종 판단은 운영자 책임</span></footer>
      </main>
    </div>
  );
}
