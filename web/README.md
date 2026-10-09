# FlexPump AI — Static Dashboard MVP

Next.js/React/TypeScript/Tailwind/shadcn/ui/Recharts 시연 화면입니다. 발전소 선택·filter·상세 chart·결정 버튼의 UI 흐름을 확인합니다.

모든 값은 정적 demo fixture입니다. KHNP collector와 일별 Ridge 예측에 연결되어 있지 않습니다. 고장 확률·센서·신뢰도·정비 시점은 실측 또는 검증된 모델 출력이 아니며 버튼은 local state만 변경합니다.

Node.js 20.9+:

```bash
npm ci
npm run dev
```

http://localhost:3000에서 확인합니다.

```bash
npm run lint
npx tsc --noEmit
npm run build
```

데이터 수집·품질 규칙·예측 실험·한계는 상위 README를 참고하세요.
