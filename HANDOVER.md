# 🔄 DEEDRA 프로젝트 개발 인수인계서

> **작성일**: 2026-03-13  
> **이전 개발 환경**: GenSpark AI Developer Sandbox  
> **인수인계 목적**: 동일한 상태에서 다음 개발자가 즉시 이어받아 개발 가능하도록 전체 현황 정리

---

## 📌 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [접속 URL 및 계정 정보](#2-접속-url-및-계정-정보)
3. [기술 스택](#3-기술-스택)
4. [서버·인프라 구성](#4-서버인프라-구성)
5. [Firebase 설정](#5-firebase-설정)
6. [파일 구조 및 역할](#6-파일-구조-및-역할)
7. [Firestore 데이터 구조](#7-firestore-데이터-구조)
8. [완료된 기능 목록](#8-완료된-기능-목록)
9. [미완성·개선 필요 항목](#9-미완성개선-필요-항목)
10. [보너스 정산 로직 상세](#10-보너스-정산-로직-상세)
11. [개발 환경 세팅 방법](#11-개발-환경-세팅-방법)
12. [배포 방법](#12-배포-방법)
13. [알려진 버그·주의사항](#13-알려진-버그주의사항)
14. [다음 개발자 우선 작업 권고사항](#14-다음-개발자-우선-작업-권고사항)

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **서비스명** | DEEDRA (디드라) |
| **종류** | MLM 기반 가상자산 투자 관리 플랫폼 (SPA) |
| **핵심 플로우** | USDT 입금 → FREEZE(투자) → 일일 ROI(DDRA 코인 지급) → 카지노 게임 또는 USDT 출금 |
| **MLM 구조** | 추천인 코드 기반 최대 10레벨 유니레벨 보너스 |
| **지원 언어** | 한국어(ko), English(en), Tiếng Việt(vi), ภาษาไทย(th) |
| **타겟 지역** | 한국, 베트남, 태국 |
| **코인 구조** | 입금: USDT(TRC20) / 보상: DDRA(자체 코인, 현재 $0.5 고정) |

---

## 2. 접속 URL 및 계정 정보

### 🌐 서비스 URL

| 구분 | URL |
|------|-----|
| **🏠 회원 앱 (메인)** | https://deedra.pages.dev |
| **🔐 관리자 패널** | https://deedra.pages.dev/admin |
| **🛠️ 초기 데이터 세팅** | https://deedra.pages.dev/setup |

### 🔑 관리자 계정

| 항목 | 값 |
|------|-----|
| 이메일 | `admin@deedra.com` |
| 비밀번호 | `Admin1234!` |
| Firebase 역할 | `role: "admin"` |

> ⚠️ **보안 주의**: 실서비스 전환 시 반드시 비밀번호 변경 필요

### ☁️ Cloudflare 계정

| 항목 | 값 |
|------|-----|
| 계정 소유자 이메일 | `Zenesisgp500@gmail.com` |
| Account ID | `e35626e04599222b1df7a710e862cf91` |
| Pages 프로젝트명 | `deedra` |
| 배포 도메인 | `deedra.pages.dev` |

---

## 3. 기술 스택

| 레이어 | 기술 | 버전 | 비고 |
|--------|------|------|------|
| **Edge 서버** | Hono | v4.12.7 | Cloudflare Workers 환경 |
| **프론트엔드** | Vanilla JS | - | 프레임워크 없음, 순수 JS |
| **UI** | Custom CSS | - | `public/static/style.css` |
| **데이터베이스** | Firebase Firestore | SDK v10.8.0 | NoSQL |
| **인증** | Firebase Auth | SDK v10.8.0 | Email/Password |
| **배포 플랫폼** | Cloudflare Pages | - | 엣지 배포 |
| **빌드 도구** | Vite | v6.3.5 | SSR 번들 |
| **패키지 매니저** | npm | - | |
| **차트** | Chart.js | v4.4.0 | CDN 로드 |
| **아이콘** | FontAwesome | v6.4.0 | CDN 로드 |
| **솔라나 지갑** | Phantom / TokenPocket | - | `solana-wallet.js` |

---

## 4. 서버·인프라 구성

```
[사용자 브라우저]
       │  HTTPS
       ▼
[Cloudflare Pages] ← 엣지 배포
   dist/_worker.js  (Hono 백엔드 - src/index.tsx 컴파일)
   dist/static/     (정적 에셋)
       │
       ├── /         → 회원 SPA (5탭)
       ├── /admin    → 관리자 패널
       ├── /setup    → 초기 데이터 세팅
       └── /api/*    → Hono 라우트 (Firebase Auth 프록시 등)
       │
       ▼
[Google Firebase]
   - Authentication (이메일/비밀번호)
   - Firestore (메인 DB)
   프로젝트 ID: dedra-mlm
```

### 중요: 데이터베이스는 서버 없음
- 모든 DB 쿼리는 **클라이언트(브라우저)에서 직접 Firestore 호출**
- 서버(Hono)는 주로 **Firebase Auth REST 프록시** 역할
- Firestore 보안 규칙으로 접근 제어 (`firestore.rules` 파일)

---

## 5. Firebase 설정

### Firebase 프로젝트 정보

```javascript
// public/static/firebase.js 에 하드코딩됨
const firebaseConfig = {
  apiKey: "AIzaSyCijC0Lfvx0WJFWQc4kukND7yOlA-nABr8",
  authDomain: "dedra-mlm.firebaseapp.com",
  projectId: "dedra-mlm",
  storageBucket: "dedra-mlm.firebasestorage.app",
  messagingSenderId: "990762022325",
  appId: "1:990762022325:web:1b238ef6eca4ffb4b795fc"
};
```

> ⚠️ **주의**: Firebase 콘솔에서 `dedra-mlm` 프로젝트에 접근 권한이 필요합니다  
> Firebase 콘솔: https://console.firebase.google.com/project/dedra-mlm

### Firebase 인증 설정 특이사항
- `signInWithEmailAndPassword()` 대신 **`signInWithCredential()`** 사용
- 이유: Cloudflare Pages 도메인이 Firebase Auth 도메인 허용목록에 없을 경우 우회
- 실패 시 Hono 서버의 `/api/auth/login` 엔드포인트로 폴백 (REST API 방식)

### Firebase Admin SDK
- `firebase-adminsdk.json` 파일 존재 (서버사이드 용)
- 현재는 주로 클라이언트에서 직접 접근하므로 미사용 상태

---

## 6. 파일 구조 및 역할

```
/home/user/webapp/
│
├── src/
│   ├── index.tsx          ⭐ Hono 백엔드 + 회원 SPA HTML 렌더 (2,030줄)
│   └── renderer.tsx       Hono 렌더러 헬퍼
│
├── public/
│   ├── favicon.ico
│   ├── manifest.json      PWA 매니페스트
│   ├── setup.html         초기 데이터 세팅 페이지 (관리자 최초 설정용)
│   ├── sw.js              Service Worker (PWA 오프라인 지원)
│   └── static/
│       ├── admin.html     ⭐ 관리자 패널 전체 (10,992줄 - 단일 파일)
│       ├── app.js         ⭐ 회원 앱 JS 로직 (4,917줄)
│       ├── firebase.js    Firebase 초기화 + 인증 유틸
│       ├── i18n.js        다국어(ko/en/vi/th) 번역 사전 + 적용 함수
│       ├── style.css      회원 앱 전체 스타일 (2,661줄)
│       ├── logo-banner.png 로고 이미지
│       ├── img/
│       │   ├── usdt-coin.png  USDT 코인 이미지 (원형 크롭 표시)
│       │   └── ddra-coin.png  DDRA 코인 이미지 (원형 크롭 표시)
│       └── js/
│           ├── api.js         ⭐ DedraAPI 클래스 (2,513줄) - 모든 비즈니스 로직
│           ├── api.js.bak2    백업 파일 (삭제 가능)
│           └── solana-wallet.js  Phantom/TokenPocket 지갑 연동 (352줄)
│
├── dist/                  빌드 결과물 (git 추적 안 함)
│   ├── _worker.js         Hono 컴파일 번들 (~776KB)
│   ├── _routes.json       라우팅 설정
│   └── static/            정적 에셋 복사본
│
├── wrangler.jsonc         Cloudflare Pages/Workers 설정
├── vite.config.ts         Vite 빌드 설정
├── tsconfig.json          TypeScript 설정
├── package.json           의존성 목록
├── ecosystem.config.cjs   PM2 로컬 개발 서버 설정
├── firestore.rules        Firestore 보안 규칙
├── firebase-adminsdk.json Firebase Admin 서비스 계정 키
├── README.md              간단 README
└── HANDOVER.md            이 인수인계서
```

### 핵심 파일 설명

#### `src/index.tsx` — Hono 백엔드
- 회원 앱 HTML 전체를 Hono에서 `c.html(...)` 로 렌더
- 주요 API 라우트:
  - `POST /api/auth/login` — Firebase Auth REST API 프록시 (도메인 우회)
  - `GET /static/*` — 정적 파일 서빙
  - `GET /admin` → `admin.html` 서빙
  - `GET /setup` → `setup.html` 서빙

#### `public/static/app.js` — 회원 앱 JS
- Firebase 로드 후 실행되는 단일 JS 파일
- 탭 전환, 모든 Firebase CRUD, 게임 로직 포함
- **주의**: Firestore 복합 인덱스 에러 방지를 위해  
  `where + orderBy` 조합 금지 → **단일 `where`만 사용 + JS에서 정렬**

#### `public/static/js/api.js` — DedraAPI 클래스
- 관리자 패널에서 `window.DedraAPI` 로 사용
- 모든 관리 기능(입출금 승인, 보너스 정산, 회원 관리 등) 담당
- `class DedraAPI` 에 모든 메서드 집중

#### `public/static/admin.html` — 관리자 패널 (단일 파일)
- 10,992줄의 거대 단일 파일 (HTML + CSS + JS 모두 포함)
- 20개 페이지/섹션을 탭 방식으로 전환

---

## 7. Firestore 데이터 구조

### 컬렉션 목록 및 필드

#### `users` — 회원
```
{
  id: "Firebase UID",
  email: "user@example.com",
  name: "홍길동",
  role: "user" | "admin",
  rank: "G0" | "G1" | ... | "G10",  // 직급
  referralCode: "REF12345",          // 추천 코드 (고유)
  referredBy: "추천인 UID",
  referralCount: 0,                  // 직접 추천 인원
  pin: "1234",                       // 출금 PIN
  createdAt: Timestamp,
  lastLoginAt: Timestamp
}
```

#### `wallets` — 지갑 (userId = 문서 ID)
```
{
  userId: "Firebase UID",
  usdtBalance: 0.00,      // USDT 잔액 (입금 원금 - FREEZE 중)
  bonusBalance: 0.00,     // 보너스 잔액 (출금 가능 DDRA → USDT 환산)
  deedraBalance: 0.00,    // DDRA 코인 잔액
  totalEarnings: 0.00,    // 총 수령 누계
  totalDeposit: 0.00,
  totalWithdrawal: 0.00,
  updatedAt: Timestamp
}
```

#### `investments` — FREEZE(투자) 기록
```
{
  userId: "Firebase UID",
  productId: "상품 ID",
  productName: "FREEZE 30",
  amount: 1000.00,         // 투자 USDT
  roiPercent: 1.0,         // 일일 ROI %
  status: "active" | "completed" | "expired",
  startDate: Timestamp,
  endDate: Timestamp,
  durationDays: 30
}
```

#### `transactions` — 입출금 내역
```
{
  userId: "Firebase UID",
  type: "deposit" | "withdrawal" | "bonus_withdrawal",
  amount: 100.00,
  status: "pending" | "approved" | "rejected",
  txid: "트랜잭션 해시",
  fromAddress: "지갑 주소",
  toAddress: "지갑 주소",
  reason: "거절 사유",
  createdAt: Timestamp,
  approvedAt: Timestamp,
  approvedBy: "admin UID"
}
```

#### `bonuses` — 보너스 지급 내역
```
{
  userId: "수령자 UID",
  fromUserId: "보너스 유발 투자자 UID",
  type: "roi_income" | "direct_bonus" | "unilevel_bonus" | 
        "direct2gen_bonus" | "rank_gap_bonus" | "rank_gap_passthru" | "manual_bonus",
  amount: 21.6,
  rate: 0.10,              // 적용 요율
  level: 1,                // 유니레벨 단계
  baseIncome: 216.0,       // 기준 일일 D
  settlementDate: "YYYY-MM-DD",
  reason: "설명 텍스트",
  createdAt: Timestamp
}
```

#### `products` — 투자 상품
```
{
  name: "FREEZE 30",
  baseRate: 1.0,           // 일 ROI %
  minAmount: 100,
  maxAmount: 10000,
  durationDays: 30,
  isActive: true,
  paymentPattern: "daily" | "weekday" | "custom",
  createdAt: Timestamp
}
```

#### `settings` — 시스템 설정
```
// 문서 ID: "rates"
{
  dedraRate: 0.5,           // DDRA 시세 (USD)
  usdKrw: 1350,             // 원화 환율
  enableDirectBonus: true,
  directBonus1: 5,          // 1대 직접 추천 %
  directBonus2: 2,          // 2대 직접 추천 %
  enableUnilevel: true,
  unilevelRates: [10,7,5,4,3,2,2,1,1,1],  // Lv1~Lv10 %
  enableRankDiffBonus: false,
  rankDiffBonusRate: 0,
  enableDirectBonus2Gen: false,
  directBonus2GenRate1: 10,
  directBonus2GenRate2: 5,
  enableCenterFee: false,
  centerFeeRate: 5,
  enableRankGapBonus: false,
  rankGapPoolRate: 10,
  enableRankAchieveBonus: false,
  autoSettlement: false,
  autoSettlementHour: 0,
  autoSettlementMinute: 0
}

// 문서 ID: "system"
{
  siteName: "DEEDRA",
  depositAddress: "TRC20 USDT 입금 주소",
  maintenanceMode: false,
  minDeposit: 100,
  minWithdrawal: 50,
  withdrawalFeeRate: 0.05  // 5%
}
```

#### 기타 컬렉션
| 컬렉션 | 용도 |
|--------|------|
| `notifications` | 회원별 알림 (실시간 onSnapshot) |
| `announcements` | 공지사항 |
| `news` | 뉴스 |
| `tickets` | 1:1 문의 |
| `gamelogs` | 카지노 게임 기록 |
| `auditLogs` | 관리자 작업 로그 |
| `centers` | 센터(지사) 정보 |
| `broadcasts` | 예약/즉시 푸시 발송 내역 |
| `settlements` | 일일 ROI 정산 기록 |
| `rateHistory` | DDRA 시세 변경 이력 |
| `subAdmins` | 보조 관리자 계정 |

---

## 8. 완료된 기능 목록

### 회원 앱 (5탭 SPA)

#### 🏠 홈 탭
- ✅ 이메일/비밀번호 로그인 (Firebase Auth 프록시 방식)
- ✅ 회원가입 (추천인 코드 필수)
- ✅ 비밀번호 재설정 (이메일 발송)
- ✅ 총 자산 카드 (USDT 환산, 원화 표시)
  - ✅ USDT 코인 이미지 (원형, 총자산 우측)
  - ✅ DDRA 코인 이미지 (원형, 출금가능 DDRA 탭)
- ✅ USDT 원금(FREEZE 중) / 출금가능 DDRA 분할 표시
- ✅ USDT 입금 모달 (TRC20 지갑 주소 + QR코드)
- ✅ DDRA 출금 모달 (PIN 인증, 출금 신청)
- ✅ DDRA 현재 시세 표시
- ✅ EARN 상품 패널 (전체보기)
- ✅ D-Day 투자 카드 (가장 최근 활성 투자)
- ✅ 공지사항 목록 (상단 고정 포함)
- ✅ 최근 거래 내역 3건
- ✅ 실시간 알림 (onSnapshot)
- ✅ 다국어 전환 (ko/en/vi/th)

#### 💼 투자 탭
- ✅ 투자 상품 목록 (동적 로드)
- ✅ 수익 시뮬레이터 (투자금 입력 → 일일/월/총 수익 계산)
- ✅ FREEZE(투자) 신청 모달
- ✅ 활성 투자 목록 (남은 일수, 진행바)
- ✅ 만기 투자 자동 완료 처리 (`autoCompleteExpiredInvestments`)

#### 🌐 네트워크 탭
- ✅ 직접 추천 회원 목록
- ✅ 추천 코드 복사/공유
- ✅ 직급 현황 및 승급 조건 표시
- ✅ 총 네트워크 보너스 수령액
- ✅ 조직도 (1세대 트리뷰)

#### 🎮 플레이 탭 (카지노)
- ✅ 홀짝 게임
- ✅ 주사위 게임 (1~6 숫자 맞추기)
- ✅ 슬롯 머신 (5릴)
- ✅ 바카라
- ✅ 룰렛 (숫자/색상 베팅)
- ✅ 포커 (5카드 드로우)
- ✅ 게임 배당률 관리자 설정 연동
- ✅ 게임 잔액 = bonusBalance(DDRA)

#### ☰ 더보기 탭
- ✅ 거래 내역 (ROI/입금/출금/보너스 필터)
- ✅ 프로필 수정 (이름, PIN)
- ✅ 언어 설정
- ✅ 로그아웃

### 관리자 패널 (20개 섹션)

| 메뉴 | 완료 기능 |
|------|----------|
| **📊 대시보드** | 총 회원수, 입금/출금 합계, 활성 투자, 오늘 보너스, 월별 차트 |
| **📈 통계 차트** | 월별 입금/출금/보너스 추이 Chart.js |
| **👥 회원 관리** | 검색, 상세보기, 지갑 조정, 직급 변경, 정보 수정, 비밀번호 리셋 |
| **🌐 조직 구조도** | 트리 구조 시각화 (무한 뎁스) |
| **🏆 직급 모니터** | 직급별 인원 현황, 자동/수동 승급 |
| **🏢 센터 관리** | 센터 생성/삭제, 센터장 임명/해제 |
| **💰 입금 관리** | 대기/승인/거절 탭, 승인 시 자동 보너스 정산 |
| **💸 출금 관리** | 대기/처리/거절 탭, 출금 승인/거절 |
| **🎁 보너스 지급** | 수동 보너스, 일일 ROI 정산 (수동 실행) |
| **🛍️ 상품 관리** | FREEZE 상품 생성/수정/삭제, 이율 설정 |
| **📐 이율 관리** | 유니레벨/직접추천/센터피 등 전체 보너스 정책 설정 |
| **💼 투자 관리** | 활성/만료 투자 목록, 강제 완료 |
| **📢 공지사항** | 생성/수정/삭제, 상단 고정 |
| **📰 뉴스** | 생성/수정/삭제 |
| **📣 푸시 발송** | 즉시/예약 발송, 특정 회원/전체 발송 |
| **💬 1:1 문의** | 문의 목록, 답변, 완료 처리 |
| **🎮 게임 로그** | 게임별 결과 로그, 손익 집계 |
| **📋 감사 로그** | 관리자 작업 전체 이력 |
| **⚙️ 시스템 설정** | 사이트명, 입금 주소, 수수료, DDRA 시세, 직급 조건 |
| **🔍 ID 분석 리포트** | ⭐ 최신 기능 - 아래 상세 설명 |

### 🔍 ID 분석 리포트 (최신 완성 기능)
- ✅ 이메일/추천코드/UID/이름으로 회원 검색
- ✅ **섹션A**: 회원 기본 정보 (UID, 직급, 추천인, 가입일)
- ✅ **섹션B**: 지갑 잔액 현황
- ✅ **섹션C**: 활성 FREEZE 목록 및 데일리 ROI 합계
- ✅ **섹션D**: 상위 체인 보너스 자격 분석 (Lv1~Lv10)
- ✅ **섹션E**: 보너스 발생 시뮬레이션 (특정 날짜 기준)
- ✅ **섹션F**: 반대방향 분석 — 산하에서 수령한 보너스, TOP 기여자
- ✅ **섹션G**: 특정 날짜 수령 보너스 내역
- ✅ **섹션H**: 산하 네트워크 (1~3세대 인원)
- ✅ **섹션I**: 최근 N일(7/14/30/60/90일 선택) 보너스 추이 Chart.js 차트
- ✅ **엑셀 내보내기** (CSV+BOM, 엑셀에서 바로 열림)
- ✅ **PDF 내보내기** (인쇄 다이얼로그 → PDF 저장)
- ✅ **날짜 기준 시뮬레이션** (특정 날짜 입력 시 해당일 기준 분석)

### 기타 완료 기능
- ✅ Solana 지갑 연동 (Phantom / TokenPocket) — `solana-wallet.js`
- ✅ PWA 지원 (Service Worker, manifest.json)
- ✅ Firestore 보안 규칙 (`firestore.rules`)
- ✅ 자동 직급 승급 체크 (`_checkAndPromoteSingleUser`)
- ✅ 직급차 풀 보너스 (`_processRankGapBonus`)
- ✅ 센터 수수료 (`_processCenterFee`)
- ✅ 직접 추천 2세대 고정 보너스 (`_processDirectBonus2Gen`)

---

## 9. 미완성·개선 필요 항목

### 🔴 높은 우선순위

#### 1. 솔라나 지갑 연동 실제 연결 미완성
- `solana-wallet.js` 파일 존재하지만, 회원 앱 UI와 실제 연결 안 됨
- 입금 모달에서 "지갑으로 입금" 버튼 클릭 시 동작 미구현
- 온체인 USDT 전송 → Firestore 자동 기록 미구현

#### 2. 자동 정산 (autoSettlement) 미구현
- 설정에 `autoSettlement: true`, `autoSettlementHour` 필드 있으나
- 실제 스케줄러 없음 (Cloudflare Workers는 Cron Triggers 필요)
- 현재는 **관리자가 수동으로 "일일 ROI 정산" 버튼 클릭** 필요
- 해결책: Cloudflare Workers Cron Trigger 설정 (`wrangler.jsonc`에 `triggers` 추가)

#### 3. 실시간 입금 자동 감지 미구현
- TRC20 USDT 입금 시 현재는 **관리자가 수동 승인** 필요
- 자동화하려면 TronScan API 폴링 또는 웹훅 필요

### 🟡 중간 우선순위

#### 4. 회원 대시보드 개선 사항 (요청됨, 미반영)
- 거래 내역: "더보기" 버튼 대신 부드러운 스크롤 업 방식
- ROI·하선 수익 강조 표시
- 1~2세대 추천인 상세, 3세대 이상 집계 방식 개선
- 이메일 마스킹 일관성
- 레벨별 매출·일일액·합계 표시

#### 5. 관리자 알림 시스템 미완성
- 30초 폴링 방식 구현됨 (`startAdminNotifPolling`)
- 입금 대기 자동 알림, 출금 신청 알림 등 실시간성 부족
- 개선: Firestore onSnapshot 실시간 리스너로 전환 권장

#### 6. 다국어 번역 미완성
- ko(한국어) 기준으로 작성됨
- en/vi/th 번역 키 일부 누락 또는 자동번역 수준
- 전문 번역 검수 필요

#### 7. 모바일 최적화 미흡
- 회원 앱은 모바일 기준 설계됨
- 관리자 패널(`admin.html`)은 데스크탑 전용 레이아웃
- 태블릿/대형 폰에서 레이아웃 깨짐 있음

### 🟢 낮은 우선순위

#### 8. DDRA 실시간 시세 연동 미완성
- 현재 `dedraRate: 0.5` 고정값 수동 관리
- 설정에 `liveEnabled`, `source`, `pairAddress` 필드 있으나 미사용
- 외부 DEX API 연동 구현 필요

#### 9. 게임 하우스 엣지 정교화
- 현재 `Math.random()` 기반으로 랜덤 결과 생성
- 서버사이드 시드 기반 검증 가능한 공정성(Provably Fair) 미구현

#### 10. 보조 관리자(subAdmin) 기능
- `subAdmins` 컬렉션 존재, 보조계정 발급 UI 있음
- 실제 권한 분리 로직 미구현

---

## 10. 보너스 정산 로직 상세

### 정산 흐름 (api.js `runDailyROISettlement`)

```
관리자가 "일일 ROI 정산" 버튼 클릭
  └→ runDailyROISettlement(adminId, targetDateStr)
       ├→ 당일 중복 정산 방지 체크 (settlements 컬렉션)
       ├→ 모든 active 투자 로드
       ├→ 각 투자별:
       │    ├→ 투자 만기 체크
       │    ├→ 지급 패턴 체크 (daily/weekday/custom)
       │    ├→ dailyROI 금액 D 계산 = amount × (roiPercent/100)
       │    ├→ 회원 wallet.bonusBalance += D  (ROI 지급)
       │    ├→ bonuses 컬렉션에 roi_income 기록
       │    │
       │    ├→ _processUnilevelBonus(D) → 상위 10단계에 유니레벨 보너스
       │    ├→ _processDirectBonus2Gen(D) → 직접 2세대 고정 (설정 시)
       │    ├→ _processCenterFee(D) → 센터 수수료 (설정 시)
       │    └→ _processRankGapBonus(D) → 직급차 풀 보너스 (설정 시)
       │
       └→ settlements 컬렉션에 정산 기록 저장
```

### 직급 시스템

| 직급 | 코드 | 비고 |
|------|------|------|
| 일반 | G0 | 보너스 수령 자격 없음 |
| 1직급 | G1 | 보너스 수령 시작 |
| 2직급 | G2 | |
| 3직급 | G3 | |
| 4직급 | G4 | |
| 5직급 | G5 | |
| 6직급 | G6 | |
| 7직급 | G7 | |
| 8직급 | G8 | |
| 9직급 | G9 | |
| 10직급 | G10 | 최고 직급 |

> G0 회원은 보너스를 **수령할 자격이 없음** (유니레벨 체인에서 스킵하지 않고 그냥 $0 지급)

---

## 11. 개발 환경 세팅 방법

### 전제 조건
- Node.js 18+ 설치
- npm 설치
- Cloudflare 계정 (API 토큰 필요)
- Firebase 프로젝트 접근 권한 (`dedra-mlm`)

### 1단계: 코드 준비

```bash
# 방법 A: Git 저장소에서 클론 (GitHub 연동 시)
git clone https://github.com/[저장소주소].git
cd webapp

# 방법 B: 백업 파일에서 복구
tar -xzf deedra_backup.tar.gz -C /원하는경로/
cd /원하는경로/webapp
```

### 2단계: 의존성 설치

```bash
npm install
```

### 3단계: 로컬 개발 서버 실행

```bash
# 빌드
npm run build

# PM2로 wrangler dev 서버 실행 (포트 3000)
pm2 start ecosystem.config.cjs

# 확인
curl http://localhost:3000
pm2 logs webapp --nostream
```

또는 직접 실행:
```bash
npm run build && npx wrangler pages dev dist --ip 0.0.0.0 --port 3000
```

### 4단계: 접속 확인

| 화면 | URL |
|------|-----|
| 회원 앱 | http://localhost:3000 |
| 관리자 | http://localhost:3000/admin |
| 설정 | http://localhost:3000/setup |

---

## 12. 배포 방법

### Cloudflare Pages 배포

```bash
# 환경 변수 설정
export CLOUDFLARE_API_TOKEN=[토큰값]
# Account ID: e35626e04599222b1df7a710e862cf91

# 빌드
npm run build

# 배포
npx wrangler pages deploy dist --project-name deedra

# 확인
curl https://deedra.pages.dev
curl https://deedra.pages.dev/admin
```

### Firebase 보안 규칙 배포

```bash
# Firebase CLI 설치 (최초 1회)
npm install -g firebase-tools
firebase login

# 규칙 배포
firebase deploy --only firestore:rules --project dedra-mlm
```

### 빌드 결과물 구조

```
dist/
├── _worker.js      # Hono 워커 번들 (~776KB)
├── _routes.json    # 라우팅 규칙
└── static/         # public/static/ 복사본
    ├── admin.html
    ├── app.js
    ├── firebase.js
    ├── i18n.js
    ├── style.css
    ├── img/
    └── js/
```

---

## 13. 알려진 버그·주의사항

### ⚠️ 절대 하지 말 것

1. **Firestore 복합 쿼리 금지**
   ```javascript
   // ❌ 이렇게 하면 인덱스 에러 발생
   query(collection(db,'bonuses'), where('userId','==',uid), orderBy('createdAt','desc'))
   
   // ✅ 이렇게 해야 함 (단일 where + JS 정렬)
   const snap = await getDocs(query(collection(db,'bonuses'), where('userId','==',uid)));
   const sorted = snap.docs.map(d=>d.data()).sort((a,b)=>b.createdAt.seconds - a.createdAt.seconds);
   ```

2. **admin.html 수정 후 반드시 빌드**
   ```bash
   npm run build  # dist/ 갱신
   npx wrangler pages deploy dist --project-name deedra
   ```

3. **app.js와 src/index.tsx의 HTML은 동기화 필요**
   - `src/index.tsx`에 회원 앱 HTML이 있음
   - `public/static/app.js`에 해당 HTML의 JS 로직이 있음
   - HTML 구조 변경 시 양쪽 모두 확인 필요

### 알려진 버그

| 버그 | 영향 | 상태 |
|------|------|------|
| Firebase Auth 도메인 미등록 시 로그인 실패 | 로컬 개발 환경 | 우회 처리됨 (`signInWithCredential`) |
| 일부 구형 iOS Safari에서 `structuredClone` 오류 | 게임 로직 | 미수정 |
| 조직도 100명 이상 시 렌더 느림 | 관리자 조직도 | 미최적화 |
| 게임 오즈(배당률) 첫 로드 시 기본값 적용 지연 | 카지노 탭 | 미수정 |

---

## 14. 다음 개발자 우선 작업 권고사항

### 즉시 처리 권장 (1순위)

```
1. 자동 일일 정산 (Cron Trigger) 구현
   → wrangler.jsonc에 triggers.crons 추가
   → src/index.tsx에 /scheduled 핸들러 추가
   → 매일 자정(UTC) 실행

2. TRC20 입금 자동 감지 연동
   → TronScan API 폴링 또는 웹훅
   → 입금 감지 → transactions 자동 생성 → 승인 자동화

3. 솔라나 지갑 실제 연결
   → solana-wallet.js 완성 상태
   → src/index.tsx 입금 모달 UI와 연결 필요
```

### 단기 처리 권장 (2순위)

```
4. 관리자 알림 onSnapshot 전환
   → 현재 30초 폴링 → Firestore 실시간 리스너로 변경

5. 다국어 번역 검수
   → en/vi/th 키 누락분 채우기
   → i18n.js 파일 전문가 검수

6. 회원 대시보드 UI 개선
   → 거래내역 스크롤 방식 변경
   → 보너스 내역 시각화 강화
```

### 중장기 권장 (3순위)

```
7. DDRA 실시간 시세 연동
   → Raydium/Jupiter DEX API 연동
   → settings/rates 자동 업데이트

8. 게임 Provably Fair 구현
   → 서버 시드 기반 공정성 검증 시스템

9. 관리자 패널 모바일 대응
   → admin.html 반응형 CSS 추가

10. 코드 분리 리팩토링
    → admin.html (10,992줄) 분리 필요
    → app.js (4,917줄) 모듈화 권장
```

---

## 📎 부록: 빠른 참고

### 자주 쓰는 명령어

```bash
# 빌드
cd /home/user/webapp && npm run build

# 배포
npx wrangler pages deploy dist --project-name deedra

# 로컬 서버
pm2 start ecosystem.config.cjs
pm2 logs webapp --nostream
pm2 restart webapp

# 포트 정리
fuser -k 3000/tcp 2>/dev/null || true

# 깃 현황
git log --oneline -10
git status
```

### 환경 변수

```bash
# 배포 시 필요
CLOUDFLARE_API_TOKEN=[토큰]  # Deploy 탭에서 설정

# Firebase는 클라이언트 측 하드코딩 (firebase.js)
# 실서비스 전환 시 환경변수로 이동 권장
```

### 직급별 보너스 요율 (기본값)

| 레벨 | 유형 | 요율 |
|------|------|------|
| Lv1 | 직접 추천 1대 | 5% |
| Lv2 | 직접 추천 2대 | 2% |
| Lv1 | 유니레벨 | 10% |
| Lv2 | 유니레벨 | 7% |
| Lv3 | 유니레벨 | 5% |
| Lv4 | 유니레벨 | 4% |
| Lv5 | 유니레벨 | 3% |
| Lv6 | 유니레벨 | 2% |
| Lv7 | 유니레벨 | 2% |
| Lv8 | 유니레벨 | 1% |
| Lv9 | 유니레벨 | 1% |
| Lv10 | 유니레벨 | 1% |

> 모든 요율은 관리자 패널 → 이율 관리에서 변경 가능

---

*이 인수인계서는 2026-03-13 기준으로 작성되었습니다.*  
*프로젝트 최종 커밋: `8267248` — fix: exportBtns 이중 style 속성 수정 + v2 ID분석리포트 최종*
