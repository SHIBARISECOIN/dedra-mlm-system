# DEEDRA 자금 흐름 전체 로직 명세서

> 본 문서는 DEEDRA 플랫폼에서 **자금이 움직이는 모든 로직**(입금·투자·정산·보너스·출금·롤백·알림·직급·이벤트)을 한 단계씩 분리하고, 각 단계에 **수치 예시**를 포함하여 설명한다.
> 작성일: 2026-04-30 / 대상 코드: `src/index.tsx`, `src/services/settlement.ts`, `public/static/admin.html`, `public/static/app.v5.js`

---

## 0. 핵심 용어

| 용어 | 설명 | 예시 |
|---|---|---|
| `usdtBalance` | 회원의 입금 USDT 잔액 (출금/투자 가능) | 1,000 USDT |
| `bonusBalance` | 정산·보너스로 누적된 USDT 잔액 (출금 가능) | 250 USDT |
| `totalInvest` | 회원의 활성 투자 원금 합계 | 5,000 USDT |
| `totalInvested` | 누적 투자액(역사적 누적, 차감되지 않음) | 12,000 USDT |
| `totalEarnings` | 누적 ROI+보너스 수익 | 1,840 USDT |
| `networkSales` | 산하 전체 매출(자기 자신 포함되지 않음) | 584,902 USDT |
| `otherLegSales` | 최대 라인을 제외한 소실적 합계 | 1,500 USDT |
| `principal` | 한 건의 투자 원금 | 1,000 USDT |
| `dailyROI` | 상품의 일일 수익률(%) | 1.5 % |
| `maxPayoutRatio` | 누적 수익 한도 배수 | 3 (= 원금 ×3) |
| `direct1 / direct2` | 1세대·2세대 직접추천 보너스 비율(%) | 10 / 5 |
| `rankGap` | 직급 차이 1단계당 롤업 보너스(%) | 10 |
| `override` | 동급/상위 매칭 보상(%) | 10 |
| `KST` | 한국 표준시(UTC+9) — 정산 기준 시간대 | 2026-04-30 00:00 |

---

## 1. 입금 흐름 (Deposit)

### 1-1. 회원이 회사 지갑으로 USDT 송금 (Solana / TRON / BSC / XRP / BTC)

- 회사 지갑은 `settings/companyWallets` 문서에서 첫 번째 활성 주소를 사용.
- 예: Solana 회사 지갑 주소 `TL...rbT9tVUw4`.

### 1-2. 자동 입금 감지 (cron 5분 주기)

- 엔드포인트: `POST /api/solana/check-deposits`, `POST /api/cron/check-major-chain-deposits`
- Solana RPC `https://solana-rpc.publicnode.com` 에 회사 지갑 USDT SPL 토큰 어카운트의 최근 서명 20건 조회.
- 신규 txid 발견 → 회원의 `wallets/{uid}` 의 `solanaWallet` 또는 `tronWallet` 매칭.

### 1-3. 입금 트랜잭션 기록

- `transactions` 컬렉션에 다음 문서 생성:
```
{
  type:'deposit', userId:'btc100', amount:1000, currency:'USDT',
  network:'Solana', txHash:'3rsEuQFeRvEVqJFi...', status:'approved',
  createdAt:'2026-04-30T00:12:33Z'
}
```

### 1-4. 잔액 반영

- `wallets/{uid}.usdtBalance += 1000` (예: 0 → 1,000)
- `users/{uid}.realDepositor = true` (롤업 차단 해제)

### 1-5. 국가별 보너스 (countryBonus)

- `settings/countryBonus` 의 `KR:5, VN:3, TH:2` 같은 비율을 입금액에 적용.
- 예: 입금 1,000 USDT × 한국 5 % = **50 USDT** 보너스 → `bonusBalance += 50`.

### 1-6. 베어마켓 이벤트 (bearMarketEvent)

- `settings/bearMarketEvent.active = true` 이고 24시간 가격 -10 % 이상 하락 시 추가 보너스.
- 예: bearBonusPct 7 % → 1,000 USDT × 7 % = **70 USDT** 보너스.

### 1-7. 입금 합계
회원이 1,000 USDT 입금 시 한국+베어 = `usdtBalance 1,000 + bonusBalance 120` (50+70).

---

## 2. 투자 흐름 (Invest)

### 2-1. 엔드포인트 `POST /api/user/invest`

- 입력: `productId`, `amount`
- 검증:
  - 최소/최대 한도 확인 (예: minAmt 100, maxAmt 50,000)
  - `usdtBalance ≥ amount + 0.1` (소수점 버퍼)

### 2-2. 상품 메타 로드

| 필드 | 예시 |
|---|---|
| `dailyROI` | 1.5 % |
| `durationDays` | 100 |
| `expectedReturn` | 원금 × dailyROI × durationDays = 1,000 × 1.5 % × 100 = **1,500 USDT** |

### 2-3. 투자 문서 생성 (`investments`)

```
{
  id:'inv_...', userId:'btc100', productId:'D100',
  amount:1000, dailyROI:0.015, durationDays:100,
  expectedReturn:1500, paidRoi:0, status:'active',
  startDate:'2026-04-30', endDate:'2026-08-08',
  autoCompound:true
}
```

### 2-4. 지갑 차감 + 누적 합산

- `usdtBalance -= 1000` (예: 1,000 → 0)
- `totalInvest += 1000`, `totalInvested += 1000`

### 2-5. 추천인 매출 즉시 반영 (bumpUplineNetworkSales)

- `users/{uid}.referredBy` 를 따라 최대 30단계 상위까지 `networkSales += 1000` 비동기 실행 (`c.executionCtx.waitUntil`).
- 예: btc100(1,000 투자) → btc001 networkSales += 1,000 → 그 위 상위 networkSales += 1,000 …

### 2-6. 1+1 / 프로모 락
- 프로모 상품(`promoLockedPrincipal`)은 매출 계산 시 차감.
- 예: 1,000 USDT 중 300 USDT 프로모 락 + 200 USDT autoCompound 락 → 매출 인정 = **500 USDT**.

---

## 3. 정산 흐름 (Settlement) — 매일 KST 00:00

### 3-1. 정산일 결정 (`resolveSettlementDate`)

- 입력 없으면 KST 오늘.
- 미래 / 잘못된 형식 / 2020-01-01 이전이면 400 에러.
- 예: `"2026-04-30"` 정상 / `"2030-01-01"` 거부.

### 3-2. 중복 방지 락 (`settlements/2026-04-30`)

- 문서 없으면 `status:'processing'` 으로 잠금.
- 이미 `done` → "already settled" 반환.

### 3-3. 유지보수 모드 ON

- `settings/system.maintenanceMode = true` (사용자 지갑 변경 차단).

### 3-4. 데이터 로드

| 컬렉션 | 용도 |
|---|---|
| `settings/main` | maxPayoutRatio, autoSettlement |
| `settings/rates` | direct1, direct2, rankGap, override, rankGapMode |
| `settings/abusing` | globalNoDepositRollupBlock 등 |
| `users` | rank, referredBy, autoCompound, blockFlags |
| `wallets` | usdtBalance, bonusBalance |
| `products` | dailyROI, durationDays, maxAmt |
| `investments(active)` | 정산 대상 |
| `transactions(approved)` | 실입금자 식별 |
| `deedra price` | 기본 0.5 USDT |

### 3-5. 회원 맵 + 깊이 계산

- `memberMap[uid] = {id, parent, rank, rank_level, autoCompound, isBlockedFromRollup}`
- 트리 깊이 캐시 → 롤업 시 무한루프 방지.

### 3-6. ROI 계산 (투자 1건당)

- `dayROI = principal × dailyROI × 1`
- 예: 1,000 USDT × 1.5 % = **15 USDT/day**
- 만기 도래(`endDate < today`) → `status:'expired'`, 정산 제외.
- 만기 7일 전 → `notifications` 큐에 "만기 임박" 추가.

### 3-7. 자동 복리 (autoCompound)

- `autoCompound:true` & `principal+ROI ≤ maxAmt` → ROI를 원금에 합산.
- 예: 원금 1,000 + ROI 15 → `amount = 1,015`, `autoCompoundTotalInvest += 15`
- 상한 초과분은 `bonusBalance` 로 이동.

### 3-8. 직접추천 보너스 (Direct 1·2)

- 1세대(부모) 10 %, 2세대(조부모) 5 %.
- 예: 손자 ROI 100 USDT → 부모 +10 USDT, 조부모 +5 USDT.

### 3-9. 직급 차이 롤업 (Rank Gap)

- 부모와 자식의 `rank_level` 차이 × 10 %.
- 예: 차이 2단계 → ROI 100 × 20 % = **20 USDT** 롤업.
- 모드 `'gap'` (단계당) / `'full'` (최고 직급 한 번) 선택.

### 3-10. 동급·상위 매칭 (Override)

- 트리에서 처음 만나는 동급 또는 상위 회원에게 전체 지급액의 10 %.
- 예: 누적 보너스 130 USDT → **13 USDT** 매칭.

### 3-11. 블랙홀(롤업 차단)

- `globalNoDepositRollupBlock=true` & 회원이 실입금 없음 → 보너스 흐름 차단, 다음 상위로 패스.
- 개별 `users/{uid}.customAbuseRules` 로 예외 가능.

### 3-12. 최대 수익 캡 (maxPayoutRatio)

- 누적 수익 ≤ 원금 × 3 (기본).
- 예: 1,000 USDT 투자, 누적 수익 2,990 → 잔여 한도 10 USDT만 지급, 초과 ROI는 차감.

### 3-13. Ledger 기록 (`bonuses` 컬렉션)

```
{ userId:'A', type:'roi', amountUsdt:15, settlementDate:'2026-04-30' }
{ userId:'B', type:'direct1', amountUsdt:10, fromUser:'A' }
{ userId:'C', type:'direct2', amountUsdt:5, fromUser:'A' }
{ userId:'D', type:'rank_gap', amountUsdt:20, level:2 }
{ userId:'E', type:'override', amountUsdt:13 }
```

### 3-14. 지갑 일괄 업데이트 (배치 20건)

- `bonusBalance`, `totalEarnings` 합산.
- 예: A 회원 = ROI 15 + 매칭 13 = `bonusBalance += 28`.

### 3-15. 투자 문서 갱신

- `paidRoi += 15`, `lastSettledAt = '2026-04-30T00:00:00Z'`
- 동일 날짜 재정산 방지.

### 3-16. settlements 마감

```
{ date:'2026-04-30', status:'done',
  totalPaid:12540.83, processedCount:412,
  skippedCount:8, durationMs:18723,
  source:'cron' }
```

### 3-17. 정산 후 작업

- `notifications` 발송 (회원별 "오늘 ROI X USDT 입금").
- 예약 브로드캐스트 처리 (`processScheduledBroadcasts`).
- `autoUpgradeAllRanks` 자동 호출 → 직급 승급.

### 3-18. 유지보수 모드 OFF

- `settings/system.maintenanceMode = false`.

### 3-19. 텔레그램 알림

- `tgSettings.recipients` 로 "정산 완료, 총 지급 $12,540.83, 회원 412명" 전송.

---

## 4. 출금 흐름 (Withdraw)

### 4-1. 엔드포인트 `POST /api/user/withdraw`

- 인증: Firebase ID 토큰
- 입력: `pin`, `amount`(≥ 50 USDT), `address`
- 동시성 락: `withdrawLocks` Set 으로 한 회원의 중복 요청 차단.

### 4-2. 검증 절차

| 항목 | 동작 |
|---|---|
| 주소 형식 | 네트워크별 정규식 + checksum |
| `withdrawSuspended` | true 면 거부 |
| 실입금자 여부 | `globalNoDepositWithdrawBlock=true` 시 차단 |
| 미결 출금 존재 | 거부 ("이미 진행 중") |
| `bonusBalance ≥ amount` | 부족 시 거부 |
| PIN | base64 인코딩 후 비교 |

### 4-3. 수수료 계산

- 기본 5 %, `settings/rates.withdrawalFeeRate` 또는 `settings/system` 우선.
- VIP 등급별 할인 (예: VIP3 → 1 % 할인).
- 예: 출금 500 USDT × 5 % = **25 USDT 수수료** → 회원 수령 475 USDT.

### 4-4. DEEDRA 환산 (현재 시세)

- 예: USDT 475 / 0.5 USDT_per_DDRA = **950 DDRA**.
- `burnedWeeklyTickets` 계산: 출금 1 USDT당 1 티켓 (예: 500 티켓 소각).

### 4-5. 트랜잭션 문서 생성

```
{
  type:'withdraw', userId:'btc100', amount:500, feeRate:0.05,
  feeAmount:25, netUsdt:475, ddraAmount:950, status:'pending',
  address:'TL...', createdAt:'2026-04-30T03:11:00Z'
}
```

### 4-6. 잔액 차감

- `bonusBalance -= 500`, `totalWithdraw += 500`, `weeklyTickets -= 500`.

### 4-7. 위클리 잭팟 적립 (Weekly Jackpot)

- `events/weekly_jackpot.feeAccumRate`(기본 100 %) 만큼 수수료를 잭팟에 적립.
- 예: 수수료 25 USDT × 100 % = **25 USDT 잭팟 적립**.

### 4-8. 관리자 승인 → 송금 실행

- 관리자 페이지 "출금 승인" → Phantom 등 회사 지갑에서 회원 주소로 송금.
- 송금 직전 최신 시세 재조회 + 슬리피지 시 자동 재시도.

### 4-9. 상태 업데이트

- `status:'completed'`, `txHash`, `completedAt` 기록.
- 실패 시 `status:'failed'` + bonusBalance 환원.

### 4-10. 출금 락 해제

- `withdrawLocks.delete(uid)` → 다음 출금 가능.

---

## 5. 롤백 / 재정산 (Rollback & Resettle)

### 5-1. 단일 일자 롤백 — `POST /api/admin/rollback-settlement`

1. `settlements/{date}` 의 `bonuses` 항목 역산.
2. 각 회원 지갑에서 보너스 차감 (`bonusBalance -= entry.amount`).
3. 투자 `paidRoi`, `lastSettledAt` 원복.
4. `settlements/{date}.status = 'rolled_back'`.

### 5-2. 다중 일자 롤백 + 재정산 — `rollback-and-resettle-multi`

- 예: 2026-03-27 ~ 03-30 4일치 잘못 정산됨.
- 순서: **최신 → 과거 역순 롤백** → **과거 → 최신 순 재정산**.
- 실패 한 건이라도 발생 시 전체 보고서 반환, 진행 중단.

### 5-3. 정산 락 강제 해제

- `settlements/{date}.status='processing'` 이 30분 이상 지속 → 관리자가 문서 삭제 → 재실행.

---

## 6. 직급 자동 승급 (autoUpgradeAllRanks)

### 6-1. 직급 요건 표

| 단계 | reqSales | reqLeg(소실적) | reqRef |
|---|---|---|---|
| G0→G1 | 5,000 | 0 | 3 |
| G1→G2 | 20,000 | 10,000 | 3 |
| G2→G3 | 50,000 | 25,000 | 3 |
| G3→G4 | 150,000 | 75,000 | 3 |
| G4→G5 | 500,000 | 250,000 | 3 |
| G5→G6 | 2,000,000 | 1,000,000 | 3 |
| G6→G7 | 5,000,000 | 2,500,000 | 3 |
| G7→G8 | 10,000,000 | 5,000,000 | 3 |
| G8→G9 | 30,000,000 | 15,000,000 | 3 |
| G9→G10 | 100,000,000 | 50,000,000 | 3 |

### 6-2. 매출 재계산 (`computeNetworkSales` 재귀)

```
nodeStats[uid] = { selfInvest, networkSales, otherLegSales }
networkSales = Σ(자식.selfInvest + 자식.networkSales)
otherLegSales = networkSales - max(라인별 합계)
```

- 예: btc100 자식 라인 = btc001(582,902) → networkSales = 582,902, otherLegSales = 0(라인이 1개뿐).

### 6-3. 다단계 승급

- 한 번 호출로 G0 → G3 까지 연속 승급 가능 (각 단계 요건 모두 충족 시).
- `previousRank`, `rankUpgradedAt` 기록 + `notifications` 발송.

### 6-4. 트리거

| 시점 | 호출 위치 |
|---|---|
| 정산 직후 | settlement.ts post-settlement |
| 신규 투자 직후 | `/api/user/invest` 후속 |
| 관리자 수동 | `POST /api/admin/recompute-and-upgrade` (보라색 버튼) |
| 외부 cron 5분 | `POST /api/cron/run-all` |

---

## 7. 자동 정산 스케줄

### 7-1. 설정

- `settings/rates.autoSettlement = true`
- `autoSettlementHour = 0`, `autoSettlementMinute = 0` (KST)

### 7-2. 외부 cron-job.org

```
URL : https://ddra.io/api/cron/run-all
Method : POST
Header : x-cron-secret: <CRON_SECRET>
Interval : 5 minutes
```

### 7-3. `/api/cron/run-all` 동작

1. Solana 자동입금 검사
2. XRP/BTC 자동입금 검사
3. 매출 재계산 + 자동 승급 (10분 주기)
4. 시간이 autoSettlementHour/Minute 와 5분 이내 일치 시 → `runSettle` 실행

---

## 8. 위클리 잭팟 (Weekly Jackpot)

### 8-1. 적립

- 출금 수수료의 일정 비율(기본 100 %)이 `events/weekly_jackpot.pool` 에 누적.
- 예: 한 주간 출금 수수료 합 1,000 USDT → 잭팟 풀 1,000 USDT.

### 8-2. 티켓

- 회원이 출금 1 USDT 당 1 티켓 소각, 입금/투자 시 티켓 적립.
- 예: 1,000 USDT 투자 → 100 티켓 적립.

### 8-3. 추첨

- 매주 토요일 KST 03:00 (`scheduled`).
- 티켓 가중 랜덤으로 1명 선정 → 잭팟 풀 100 % 지급 → `bonusBalance += pool`.
- 알림 + 텔레그램 공지.

---

## 9. 시드 / 추천인 / 매출 보정

### 9-1. 추천인 트리

- 가입 시 입력한 referralCode → `users/{uid}.referredBy = 추천인UID`.
- `referredBy` 가 UID 가 아닌 코드/유저명으로 저장된 레거시 데이터는 마이그레이션 필요.

### 9-2. 산하 매출(networkSales)

- 신규 투자 시 즉시 가산 (Section 2-5).
- cron 10분 주기 재계산 (`computeNetworkSales`).
- 관리자 수동 재계산 (보라색 버튼).

### 9-3. 소실적(otherLegSales)

- `networkSales − max(line)` 정의.
- 단일 라인만 존재 시 0.
- G6 이상 승급 요건이므로 다중 라인 필요.

---

## 10. 관리자 자금 조정 API

| 엔드포인트 | 기능 | 예시 |
|---|---|---|
| `POST /api/admin/wallet-adjust` | 회원 지갑 수동 ± | bonusBalance += 100 (이벤트 보상) |
| `POST /api/admin/sync-sales` | 전체 매출 재계산 | updatedCount 412 |
| `POST /api/admin/recompute-and-upgrade` | 매출 재계산 + 승급 | upgraded 12 |
| `POST /api/admin/rollback-settlement` | 단일일 롤백 | 2026-03-30 |
| `POST /api/admin/rollback-and-resettle-multi` | 다중일 재정산 | 03-27~03-30 |
| `POST /api/admin/unlock-settlement` | 정산 락 해제 | 30분 이상 락 |
| `POST /api/admin/withdrawals/approve` | 출금 승인 | tx 송금 실행 |
| `GET /api/admin/withdrawals/recovery-candidates` | 미완료 출금 목록 | 회복 후보 |
| `GET/POST /api/admin/countryBonus` | 국가별 보너스 율 | KR:5, VN:3 |
| `GET/POST /api/admin/bearMarketEvent` | 베어마켓 이벤트 | active:true, pct:7 |

---

## 11. 데이터 무결성 / 라운딩

- `roundMoney(x) = Math.round(x*1e8)/1e8` (소수점 8자리)
- `roundSettlementAmount` — Ledger 저장 시 동일 라운딩.
- 모든 Firestore 쓰기는 **20건 단위 batch** 로 commit → 원자성 보장.

---

## 12. 가상 시나리오 — 한 회원의 1일 자금 이동

**btc100 (G5, KR)** — 시작 잔액: usdtBalance 0, bonusBalance 0, totalInvest 1,000.

1. **00:00 KST** 정산 실행
   - ROI: 1,000 × 1.5 % = **15 USDT** → autoCompound true → amount 1,015 USDT
   - 매칭(상위 G5): 130 × 10 % = 13 → btc100 +13 USDT bonusBalance
   - bonusBalance 0 → **13 USDT**
2. **02:00** 산하 회원 btc1234 가 1,000 USDT 입금
   - btc100 networkSales += 1,000 → 583,902 USDT
3. **02:30** btc1234 가 1,000 USDT 투자
   - btc100 direct1 보너스 = 1,000 × dailyROI(1.5 %) × 10 % = **0.15 USDT/day** (다음 정산일 적용)
4. **10:00** btc100 출금 신청 100 USDT
   - 수수료 5 % = 5 USDT, 회원 수령 95 USDT
   - bonusBalance 13 → -100 (잔액 부족 → 거부) ❌
   - bonusBalance 가 100 이상이 되어야 출금 가능.
5. **15:00** 자동입금 검사 → btc100 추가 입금 200 USDT 감지
   - usdtBalance 0 → 200, KR 보너스 5 % = 10 USDT → bonusBalance 13 → 23
6. **다음날 00:00** 정산
   - btc1234 ROI 15 USDT → btc100 direct1 = 1.5 USDT
   - 직급차 1단계 롤업 = 15 × 10 % = 1.5 USDT
   - bonusBalance 23 → **26 USDT**

---

## 13. 장애 대응 체크리스트

| 증상 | 점검 위치 | 조치 |
|---|---|---|
| 매출이 0으로 보임 | `users.networkSales`, `referredBy` 형식 | 보라색 버튼 실행, 마이그레이션 |
| 자동 승급 안 됨 | `autoUpgradeAllRanks` 호출 로그 | cron 5분 등록 확인, 수동 호출 |
| 정산 중복 | `settlements/{date}.status` | unlock-settlement |
| 출금 멈춤 | `withdrawLocks` Set, transactions.pending | recovery-candidates 조회 |
| 자동입금 누락 | RPC 403, signatures 비어있음 | 다른 RPC로 전환, 수동 트랜잭션 등록 |
| 직급 모니터 0명 | `rankEligible` 플래그, `realDepositor` | 입금 이력 확인, abuse 규칙 점검 |

---

## 14. 결론

DEEDRA 의 자금 흐름은 **6대 흐름**(입금 → 투자 → 정산 → 보너스 → 출금 → 롤백)과 **3대 보조 시스템**(직급 자동 승급, 위클리 잭팟, 이벤트 보너스)으로 구성된다. 모든 흐름은 Firestore 의 `users` / `wallets` / `investments` / `transactions` / `bonuses` / `settlements` / `notifications` 컬렉션을 중심으로 배치 쓰기와 락 메커니즘을 통해 원자성을 유지한다. 외부 cron(`/api/cron/run-all`) + 관리자 수동 버튼 두 가지 트리거가 자동화의 핵심 백본이며, 정산·승급의 일관성은 `autoUpgradeAllRanks` + `computeNetworkSales` + `runSettle` 3단 파이프라인이 보장한다.

---

## 15. 2026-04-30 패치 개요 (P0 + P1 + P2)

### 15-1. P0 우선순위 (긴급 안정화)

| 코드 | 항목 | 적용 위치 | 효과 |
|---|---|---|---|
| **B-1** | `adjustWallet` 단일 진입점 | `src/services/wallet.ts` (신규) | 모든 잔액 변동이 동일 함수를 거침. 자동 ledger 기록·8자리 라운딩·음수차단 보장. |
| **B-2** | RANK_REQ DB 이전 | `loadRankRequirements()` | `settings/rankPromotion.criteria` 우선, 폴백은 하드코딩. 관리자가 코드 배포 없이 직급 기준 변경 가능. |
| **B-3** | 8자리 라운딩 | `src/index.tsx:6566-6573` | 출금 `ddrAmt`/`feeAmount`/`netDdra`/`netUsdt`/`feeUsdt` 모두 `Math.round(x*1e8)/1e8`. 부동소수 누적오차 제거. |
| **B-4** | 배치 크기 20 표준화 | `fsBatchCommit` 내부 + 모든 외부 chunk loop | 종래 500 단위 → 20 단위. 한 commit 의 영향 범위 축소, 부분 실패 복구성 향상. |
| **B-5** | 롤백 락 | `rollbackLocks/{date}` 컬렉션 | 단일·다중 일자 롤백 모두 진입 시 락 생성, `finally` 에서 해제. 동시 롤백 충돌 방지(409 반환). |

### 15-2. P1 우선순위 (안정성/추적성)

#### B-6 — TXID 3체인 RPC 폴백
- `verifyMultiChainDeposit(txid, amount, companyWalletsDoc)` 내부에서 `tryOrder = [추정네트워크, 'BSC', 'TRON', 'Solana']` 순회.
- **BSC**: 3-RPC 폴백 (`bsc-dataseed.binance.org`, `bsc-dataseed1.defibit.io`, `rpc.ankr.com/bsc`) — 각 6초 timeout.
- **TRON**: TronGrid API — 6초 timeout.
- **Solana**: 4-RPC 폴백 (`publicnode`, `mainnet-beta`, `onfinality`, `ankr`) — 각 6초 timeout.
- 사용자 입력 오류(`0x` 누락, hex/base58 혼동) 자동 보정.
- 모든 폴백 실패 시 `❌ 온체인 검증 실패 (BSC→TRON→Solana 모두 미발견)` 종합 메시지.

#### B-7 — 투자 직후 매출 즉시 가산 (`bumpUplineNetworkSales`)
- 위치: `src/index.tsx:11103`
- `/api/user/invest` 응답 직전 `c.executionCtx.waitUntil` 으로 백그라운드 실행 (응답 지연 0).
- 최대 30 depth 까지 추천인 트리 상향 가산.
- 부정확한 `otherLegSales` 는 다음 정산 사이클의 B-9 로직이 자동 보정.

```
btc100 (1,000 USDT 투자)
  ↓ bumpUplineNetworkSales(uid, 1000, adminToken)
  ↓ for depth=0..30:
  ↓   referredBy 추적 → users/{upline}.networkSales += 1000
  ↓ done
```

#### B-8 — `txValidation` 항상 저장
- 위치: `/api/admin/notify-deposit-request` 3단계.
- 종전: `docId` 가 있을 때만 `transactions/{docId}` patch.
- 변경: `docId` 없으면 `txid` 로 `transactions` 컬렉션 자동 검색 → 매칭 시 patch.
- 매칭 실패 시: `verificationLogs/` 컬렉션에 별도 보관 (관리자 추적용).
- `verifiedAt` 타임스탬프 항상 기록.

```
[notify-deposit-request]
  ├─ 1단계: 텔레그램 1차 알림 (검증 전 즉시)
  ├─ 2단계: verifyMultiChainDeposit 12초 timebox
  ├─ 3단계: docId or txid 매칭 → fsPatch
  │         매칭 실패 → fsCreate('verificationLogs', ...)
  └─ 4단계: 텔레그램 2차 알림 (검증 결과 포함)
```

#### B-9 — 정산 직후 sync-sales 자동 트리거
- 위치: `src/services/settlement.ts` `runPostSettlementTasks()` 내, `autoUpgradeAllRanks` 호출 직전.
- DFS `computeNetworkSales` 로 전 회원 `networkSales / otherLegSales` 정확 재계산.
- 변경분만 batch=20 단위 patch (불필요한 쓰기 최소화, B-4 표준 준수).
- 메모리상 `allUsers` 도 동기 갱신하여 후속 `autoUpgradeAllRanks` 가 최신 매출로 승급 판정.
- `settlements/{date}.postSettlement.salesSync` 에 결과 기록 (`done`/`error`/`salesSyncCount`).

```
runPostSettlementTasks()
  ├─ 1) notifications batch commit
  ├─ 2) processScheduledBroadcasts
  ├─ 3) [B-9] sync-sales (networkSales/otherLegSales 재집계)   ← 신규
  └─ 4) autoUpgradeAllRanks (최신 매출로 승급 판정)
```

### 15-3. P2 (회귀 테스트)

#### B-10 — vitest 회귀 테스트 (총 37건 통과)

**`src/__tests__/wallet.test.ts` (14건)**
- 8자리 라운딩 (`Math.round(x*1e8)/1e8`)
- 음수 잔액 차단 (USDT / bonus 각각)
- `allowNegative=true` 관리자 조정
- `totalEarnings` 누적 규칙 (양의 deltaBonus 만 누적, 출금 시 변화 없음)
- bonuses 컬렉션 자동 ledger 기록
- `skipLedger=true` 옵션 (롤백 등)
- uid/NaN 검증
- `WalletBatch` 누적 + 일괄 commit
- BTC-100 1일 통합 시나리오 (입금→보너스→투자→ROI→매칭→출금→과다출금 거부)
- 부동소수 누적오차 8자리 절단

**`src/__tests__/settlement.test.ts` (23건)**
- §3-6 일일 ROI: `principal × dailyROI × min(daysPassed,1)` (소급정산 금지)
- §3-7 자동복리: 상한 미달/도달/초과 3가지 분기
- §3-8 직접추천 보너스: direct1/direct2
- §3-9 직급 차이 롤업: gap/full 모드
- §3-12 maxPayoutRatio 캡: 잔여한도 음수/양수/정확
- BTC-100 정산 통합 시나리오 (D100 상품, dailyROI 1.5%, G5)
- §11 라운딩 정합성
- §0 HARD RULE #4 배치 크기 20 분할

**실행**:
```bash
cd /home/user/webapp && npm test
# Test Files  2 passed (2)
#      Tests  37 passed (37)
```

### 15-4. 패치 후 시스템 보장사항 매핑

| HARD RULE | 강제 위치 | 회귀 테스트 |
|---|---|---|
| #1 음수 잔액 금지 | `adjustWallet` allowNegative=false 기본 | wallet.test.ts L74-95 |
| #3 8자리 라운딩 | `adjustWallet` round8(), 출금/투자 모든 산식 | wallet.test.ts L67, settlement.test.ts L130-141 |
| #4 배치 20건 | `fsBatchCommit` 내부 + 외부 loop 정리 | settlement.test.ts L143-160 |
| #5 진행중 상태 락 | settlements / rollbackLocks 컬렉션 | (e2e) |
| #9 단일 진입점 | `adjustWallet` (src/services/wallet.ts) | wallet.test.ts 전체 |

### 15-5. 운영 가이드

#### 정산 후 확인 방법
1. `settlements/{date}.postSettlement.salesSync` 확인 (`done` 정상 / `error` 시 에러 메시지 노출).
2. `salesSyncCount > 0` 이면 매출 변화가 발생한 회원 수.
3. `rankUpgrade: 'done'` 이면 직급 승급 통과.

#### 입금 검증 추적
1. `transactions/{docId}.txValidation = 'valid' | 'pending' | 'invalid'`.
2. `verifiedAt` 타임스탬프로 검증 시각 확인.
3. `docId` 없는 케이스는 `verificationLogs/` 에서 `txid` 로 검색.

#### 롤백 충돌 해결
1. 409 반환 시 `rollbackLocks/{date}` 문서 확인.
2. 30분 이상 잔존 시 관리자가 수동 삭제.
3. 동일 일자 동시 롤백 시도 차단.

---

**문서 갱신일**: 2026-04-30 / **패치 버전**: P0(B-1~B-5) + P1(B-6~B-9) + P2(B-10)
