# 📋 DEEDRA 프로젝트 인수인계서

> **작성일:** 2026-03-12  
> **작성자:** AI 개발자 (GenSpark Sandbox)  
> **목적:** 신규 개발자가 즉시 업무를 이어받을 수 있도록 모든 개발 현황을 문서화

---

## 목차

1. [서비스 개요](#1-서비스-개요)
2. [접속 URL 및 계정 정보](#2-접속-url-및-계정-정보)
3. [기술 스택 & 인프라](#3-기술-스택--인프라)
4. [Firebase 설정 정보](#4-firebase-설정-정보)
5. [프로젝트 파일 구조](#5-프로젝트-파일-구조)
6. [개발 환경 재구축 방법](#6-개발-환경-재구축-방법)
7. [Firestore 데이터 구조](#7-firestore-데이터-구조)
8. [회원 앱 기능 현황](#8-회원-앱-기능-현황)
9. [관리자 패널 기능 현황](#9-관리자-패널-기능-현황)
10. [게임 시스템 현황](#10-게임-시스템-현황)
11. [비즈니스 로직 (MLM 구조)](#11-비즈니스-로직-mlm-구조)
12. [완료된 개발 목록](#12-완료된-개발-목록)
13. [미완성 / 반쪽 구현된 기능](#13-미완성--반쪽-구현된-기능)
14. [다음 개발자가 해야 할 작업](#14-다음-개발자가-해야-할-작업)
15. [알려진 버그 및 이슈](#15-알려진-버그-및-이슈)
16. [Git 커밋 이력](#16-git-커밋-이력)

---

## 1. 서비스 개요

**DEEDRA**는 MLM(다단계 마케팅) 기반의 가상자산 투자 관리 플랫폼입니다.

### 핵심 비즈니스 모델
- 회원이 USDT를 투자하면 일일 ROI(수익)를 DDRA 토큰으로 지급
- 추천인 네트워크를 통해 유니레벨 보너스 지급 (최대 10단계)
- 직급(G0~G10) 시스템 — 추천인 수에 따라 자동/수동 승진
- 수익(DDRA)을 즉시 카지노 게임에 사용하거나 USDT로 출금 가능
- 관리자가 전체 시스템(상품, 회원, 입출금, 보너스 정산)을 통합 관리

### 서비스 타깃
- 한국, 베트남, 태국 시장 (4개 언어: 한국어·영어·베트남어·태국어)

---

## 2. 접속 URL 및 계정 정보

### ⚠️ 중요: 샌드박스 URL 변경 주의
> 샌드박스는 세션마다 URL이 바뀝니다.  
> 새 개발 환경에서 서비스 재시작 후 반드시 `GetServiceUrl(port=3000)`으로 새 URL을 확인하세요.

### 현재 (마지막으로 확인된) URL
| 구분 | URL |
|------|-----|
| 🏠 **회원 앱 (메인)** | `https://3000-i8bw3zs5vns5mywogllhz-ad490db5.sandbox.novita.ai` |
| 🔐 **관리자 페이지** | `https://3000-i8bw3zs5vns5mywogllhz-ad490db5.sandbox.novita.ai/admin` |
| 🔐 **관리자 (직접 경로)** | `https://3000-i8bw3zs5vns5mywogllhz-ad490db5.sandbox.novita.ai/static/admin.html` |
| 🛠️ **테스트 계정 생성** | `https://3000-i8bw3zs5vns5mywogllhz-ad490db5.sandbox.novita.ai/setup` |

### 관리자 로그인 정보
| 항목 | 값 |
|------|-----|
| **이메일** | `admin@deedra.com` |
| **비밀번호** | `Admin1234!` |
| **Firebase UID** | `9tQWZINrZ9g0hdo1anNwFSASIf62` |
| **역할(role)** | `admin` |

### 자동 로그인 테스트 URL
```
/static/admin.html?autotest=1
```
→ 위 URL 접속 시 `admin@deedra.com / Admin1234!` 로 자동 로그인됩니다.

---

## 3. 기술 스택 & 인프라

| 구분 | 기술 |
|------|------|
| **백엔드 프레임워크** | [Hono](https://hono.dev/) v4.12.7 (Cloudflare Workers 런타임) |
| **번들러** | Vite v6.3.5 |
| **배포 플랫폼** | Cloudflare Pages (Workers) |
| **데이터베이스** | Firebase Firestore (NoSQL) |
| **인증** | Firebase Authentication (Email/Password) |
| **로그인 방식** | Hono 백엔드 프록시 → Firebase REST API (sandbox 도메인 우회) |
| **프론트엔드** | Vanilla JavaScript (CDN 방식, 프레임워크 없음) |
| **CSS** | 커스텀 CSS (Tailwind 미사용, 자체 CSS 변수 기반 다크모드) |
| **아이콘** | Font Awesome 6.4.0 (CDN) |
| **폰트** | Google Fonts - Noto Sans KR / Noto Sans Thai |
| **프로세스 관리** | PM2 |
| **개발 서버** | Wrangler Pages Dev |

### 서비스 시작 명령어 (새 개발 환경에서)
```bash
cd /home/user/webapp

# 1. 빌드
npm run build

# 2. PM2로 시작
pm2 start ecosystem.config.cjs

# 3. 확인
curl http://localhost:3000
pm2 logs --nostream
```

---

## 4. Firebase 설정 정보

### Firebase 프로젝트 정보
| 항목 | 값 |
|------|-----|
| **프로젝트 ID** | `dedra-mlm` |
| **API Key** | `AIzaSyCijC0Lfvx0WJFWQc4kukND7yOlA-nABr8` |
| **Auth Domain** | `dedra-mlm.firebaseapp.com` |
| **Storage Bucket** | `dedra-mlm.firebasestorage.app` |
| **Messaging Sender ID** | `990762022325` |
| **App ID** | `1:990762022325:web:1b238ef6eca4ffb4b795fc` |

### Firebase 콘솔 접속
- https://console.firebase.google.com/project/dedra-mlm

### 인증 방식 (중요!)
일반 Firebase SDK의 `signInWithEmailAndPassword()` 는 **sandbox 도메인에서 작동 불가** (authDomain 도메인 제한).  
→ 해결: `/api/auth/login`, `/api/auth/register` Hono 프록시를 통해 Firebase REST API 직접 호출.  
→ 관련 코드: `src/index.tsx` 의 `/api/auth/*` 라우트  
→ 프론트: `public/static/firebase.js` 의 `proxySignIn()` 함수

---

## 5. 프로젝트 파일 구조

```
/home/user/webapp/
├── src/
│   ├── index.tsx          ← Hono 서버 메인 (라우팅, 정적파일, Auth 프록시)
│   └── renderer.tsx       ← (사용 안 함, 초기 템플릿 잔재)
│
├── public/
│   ├── favicon.ico
│   ├── setup.html         ← 테스트 계정 생성 도우미 페이지
│   └── static/
│       ├── admin.html     ← 관리자 패널 (8,832줄, 단일 파일 SPA)
│       ├── app.js         ← 회원 앱 전체 로직 (3,643줄)
│       ├── firebase.js    ← Firebase SDK 초기화 + 프록시 로그인
│       ├── i18n.js        ← 다국어 번역 데이터 (현재 app.js 내부에 통합됨)
│       ├── style.css      ← 전체 스타일 (2,501줄, 다크모드 포함)
│       ├── logo-banner.png← DEEDRA 로고 이미지
│       ├── favicon.ico
│       └── js/
│           ├── api.js     ← Firestore 직접 접근 유틸 (DedraAPI 클래스)
│           └── api.js.bak2← 이전 버전 백업
│
├── dist/                  ← Vite 빌드 결과 (배포 대상, git 제외)
├── .wrangler/             ← Wrangler 로컬 상태 (git 제외)
│
├── ecosystem.config.cjs   ← PM2 설정 (포트 3000, wrangler pages dev)
├── wrangler.jsonc         ← Cloudflare Workers 설정
├── package.json           ← 의존성 (hono, firebase-admin, vite, wrangler)
├── tsconfig.json          ← TypeScript 설정
├── vite.config.ts         ← Vite 빌드 설정
├── .gitignore
├── README.md              ← (기본 템플릿 내용만 있음, 실질적 정보 없음)
└── HANDOVER.md            ← 이 문서
```

### 핵심 파일 역할 요약
| 파일 | 역할 | 라인 수 |
|------|------|---------|
| `src/index.tsx` | Hono 서버: 라우팅, 정적 파일 서빙, Auth 프록시, HTML 템플릿 | ~280줄 |
| `public/static/app.js` | 회원 앱 전체 JS 로직 (SPA, 게임, 지갑, 네트워크 등) | 3,643줄 |
| `public/static/style.css` | 전체 스타일 (다크모드, 게임 UI, 반응형) | 2,501줄 |
| `public/static/admin.html` | 관리자 패널 전체 (HTML+CSS+JS 단일 파일) | 8,832줄 |
| `public/static/firebase.js` | Firebase 초기화 및 로그인 프록시 | ~100줄 |

---

## 6. 개발 환경 재구축 방법

### 새 샌드박스에서 시작하기

```bash
# 1. 프로젝트 디렉토리 이동
cd /home/user/webapp

# 2. 의존성 설치 (이미 node_modules 있으면 스킵)
npm install

# 3. 빌드
npm run build

# 4. 포트 정리 후 PM2 시작
fuser -k 3000/tcp 2>/dev/null || true
pm2 start ecosystem.config.cjs

# 5. 정상 동작 확인
curl http://localhost:3000
pm2 logs deedra-app --nostream

# 6. 공개 URL 확인 (GenSpark 도구 사용)
# GetServiceUrl(port=3000) 호출
```

### 빌드 후 재시작
```bash
cd /home/user/webapp
npm run build
pm2 restart deedra-app
```

### PM2 기본 명령어
```bash
pm2 list                        # 프로세스 목록
pm2 logs deedra-app --nostream  # 로그 확인
pm2 restart deedra-app          # 재시작
pm2 delete deedra-app           # 삭제
```

---

## 7. Firestore 데이터 구조

### 컬렉션 목록

#### 📁 `users` (회원 정보)
```json
{
  "uid": "Firebase UID",
  "email": "user@example.com",
  "name": "홍길동",
  "role": "user",               // "user" | "admin"
  "referralCode": "DD1A2B3C",   // DD + UID 앞 6자리
  "referrerId": "추천인 UID",
  "referrerCode": "추천인 코드",
  "rank": "G0",                 // G0~G10
  "usdtBalance": 1000.00,       // USDT 원금 (잠금)
  "dedraBalance": 0.0,          // DDRA 보유량 (레거시)
  "bonusBalance": 50.00,        // 출금 가능 DDRA (USDT 기준 저장)
  "directReferrals": 3,         // 직접 추천인 수
  "totalDownline": 15,          // 전체 하위 수
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp",
  "withdrawPin": "암호화된 PIN"  // 출금 PIN (설정 시)
}
```

#### 📁 `products` (투자 상품)
```json
{
  "name": "Gold Plan",
  "roi": 1.5,            // 일일 ROI (%)
  "days": 30,            // 투자 기간 (일)
  "minAmount": 100,      // 최소 투자 금액 (USDT)
  "maxAmount": 10000,    // 최대 투자 금액 (USDT)
  "isActive": true,
  "createdAt": "Timestamp"
}
```

#### 📁 `investments` (투자 기록)
```json
{
  "userId": "Firebase UID",
  "productId": "상품 ID",
  "productName": "Gold Plan",
  "amount": 500.00,       // 투자 USDT
  "roi": 1.5,             // 일일 ROI (%)
  "days": 30,
  "startDate": "Timestamp",
  "endDate": "Timestamp",
  "status": "active",     // "active" | "completed" | "cancelled"
  "earnedAmount": 10.00,  // 누적 수익 (USDT)
  "createdAt": "Timestamp"
}
```

#### 📁 `transactions` (거래 내역)
```json
{
  "userId": "Firebase UID",
  "type": "deposit",        // "deposit" | "withdrawal" | "bonus" | "invest" | "game"
  "amount": 100.00,         // USDT 금액
  "ddraAmount": 200.00,     // DDRA 금액 (출금 시)
  "status": "pending",      // "pending" | "approved" | "rejected"
  "memo": "메모",
  "txHash": "트랜잭션 해시", // 입금 시
  "walletAddress": "지갑 주소", // 출금 시
  "createdAt": "Timestamp"
}
```

#### 📁 `bonuses` (보너스 지급 내역)
```json
{
  "userId": "수신자 UID",
  "fromUserId": "발생 원인 UID",
  "type": "roi",          // "roi" | "direct" | "unilevel" | "rank"
  "amount": 5.00,         // USDT 금액
  "ddraAmount": 10.00,    // DDRA 환산
  "level": 1,             // 유니레벨 단계 (unilevel 보너스)
  "date": "YYYY-MM-DD",   // 정산일
  "createdAt": "Timestamp"
}
```

#### 📁 `announcements` (공지사항)
```json
{
  "title": "공지 제목",
  "content": "HTML 내용",
  "isActive": true,
  "isPinned": false,
  "category": "general",   // "general" | "event" | "maintenance"
  "createdAt": "Timestamp"
}
```

#### 📁 `tickets` (1:1 문의)
```json
{
  "userId": "Firebase UID",
  "title": "문의 제목",
  "content": "문의 내용",
  "status": "open",        // "open" | "closed"
  "answer": "답변 내용",
  "createdAt": "Timestamp"
}
```

#### 📁 `settings` (시스템 설정) — 단일 문서
- `doc(db, 'settings', 'dedra_rate')` : DDRA 시세, 입출금 수수료율, 유니레벨 비율
- `doc(db, 'settings', 'rank_promo')` : 직급 승진 조건 (G1~G10 추천인 수)

#### 📁 `wallets` (회사 지갑 — admin에서만 접근)
```json
{
  "network": "TRC20",
  "address": "회사 USDT 수신 지갑 주소"
}
```

---

## 8. 회원 앱 기능 현황

### 앱 구조
회원 앱은 **5탭 SPA** 구조입니다.

```
[홈] [투자] [네트워크] [플레이] [더보기]
```

### 각 탭 기능 상세

#### 🏠 홈 (Home)
| 기능 | 상태 | 비고 |
|------|------|------|
| 총 자산 표시 (USDT 원금 + DDRA 수익) | ✅ 완료 | |
| 원금(잠금) / 출금가능DDRA 분할 표시 | ✅ 완료 | |
| 입금 버튼 | ✅ 완료 | 회사 지갑 주소 표시 + 트랜잭션 해시 입력 |
| 출금 버튼 | ✅ 완료 | DDRA→USDT 환산, 지갑주소 입력, PIN 인증 |
| DDRA 시세 표시 | ✅ 완료 | settings/dedra_rate 에서 로드 |
| D-Day 진행 중 투자 카드 | ✅ 완료 | 프로그레스 바 포함 |
| 공지사항 목록 (최신 3개) | ✅ 완료 | |
| 최근 거래내역 (최신 3개) | ✅ 완료 | |

#### 📈 투자 (Invest)
| 기능 | 상태 | 비고 |
|------|------|------|
| 투자 현황 요약 (활성건수, 총투자금, 예상수익) | ✅ 완료 | |
| 투자 수익 시뮬레이터 | ✅ 완료 | 상품 선택 + 금액 입력 → 수익 계산 |
| 투자 상품 목록 | ✅ 완료 | Firestore products 컬렉션 |
| 투자 신청 모달 | ✅ 완료 | USDT 차감 + investments 기록 |
| 내 투자 현황 목록 | ✅ 완료 | 진행률, 예상수익 표시 |

#### 🌐 네트워크 (Network)
| 기능 | 상태 | 비고 |
|------|------|------|
| 네트워크 통계 (직접추천, 전체하위, 획득보너스) | ✅ 완료 | |
| 내 추천 코드 복사/공유 | ✅ 완료 | |
| 직급 현황 + 다음 직급 프로그레스 | ✅ 완료 | |
| 조직도 (트리 구조) | ✅ 완료 | Pan/Zoom 지원 |
| 직접 추천인 목록 | ✅ 완료 | |

#### 🎮 플레이 (Play)
| 기능 | 상태 | 비고 |
|------|------|------|
| 게임 잔액 표시 (DDRA) | ✅ 완료 | bonusBalance 에서 자동 계산 |
| 홀짝 게임 | ✅ 완료 | 코인 3D 애니메이션, Web Audio 사운드 |
| 주사위 게임 | ✅ 완료 | 3D 주사위 도트 애니메이션, 6배 |
| 슬롯머신 | ✅ 완료 | 릴 애니메이션, 잭팟 시스템 (최대 50배) |
| 룰렛 | ✅ 완료 | Canvas 고화질 렌더링, 유럽식 룰렛 |
| 바카라 | ✅ 완료 | 6덱 슈, 미니 바카라 규칙, 카드 애니메이션 |
| 포커 | ✅ 완료 | 텍사스 홀덤, 족보 판정, 최대 100배 |
| 게임 결과 Firestore 기록 | ✅ 완료 | gamelogs 컬렉션 기록 |
| Web Audio API 사운드 | ✅ 완료 | coin/dice/slot/roulette/card/win/lose/jackpot |

#### 📋 더보기 (More)
| 기능 | 상태 | 비고 |
|------|------|------|
| 거래내역 (전체/입금/출금/보너스/게임) | ✅ 완료 | 탭 필터링, 스크롤 |
| 프로필 카드 | ✅ 완료 | 이름, 이메일, 등급 |
| 프로필 편집 | ✅ 완료 | 이름, 전화번호 수정 |
| 비밀번호 변경 | ✅ 완료 | |
| 출금 PIN 설정 | ✅ 완료 | |
| 1:1 문의 | ✅ 완료 | 등록 + 목록 조회 |
| 공지사항 | ❌ 제거됨 | 홈탭으로 통합 |
| 알림 | ⚠️ 스텁 | "새 알림이 없습니다" 토스트만 표시 |
| 공지사항 상세 보기 | ⚠️ 스텁 | 함수 정의만 있고 내용 미구현 |
| 로그아웃 | ✅ 완료 | |

### 다국어 지원 현황
| 언어 | 상태 |
|------|------|
| 🇰🇷 한국어 (ko) | ✅ 완료 |
| 🇺🇸 영어 (en) | ✅ 완료 |
| 🇻🇳 베트남어 (vi) | ✅ 완료 |
| 🇹🇭 태국어 (th) | ✅ 완료 |
> 시스템 언어 자동 감지 + 수동 변경 가능

---

## 9. 관리자 패널 기능 현황

> 관리자 패널은 `public/static/admin.html` 단일 파일 (8,832줄)에 HTML+CSS+JS가 모두 포함된 SPA.

### 사이드바 메뉴 구조

#### 📊 메인
| 메뉴 | 상태 | 비고 |
|------|------|------|
| 대시보드 | ✅ 완료 | 회원수, 총입금, 총보너스 통계 카드 |
| 통계 차트 | ✅ 완료 | 입출금 추이, 회원 증가 그래프 |

#### 👥 회원·조직
| 메뉴 | 상태 | 비고 |
|------|------|------|
| 회원 관리 | ✅ 완료 | 목록, 검색, 상세 조회, 자산 수동 조정, 등급 변경, 계정 활성/비활성 |
| 조직 구조도 | ✅ 완료 | 전체 트리 시각화 |
| 직급 모니터 | ✅ 완료 | G1~G10 직급별 회원 현황 |
| 센터 관리 | ✅ 완료 | 센터 등록/삭제 |

#### 💰 입출금·자산
| 메뉴 | 상태 | 비고 |
|------|------|------|
| 입금 관리 | ✅ 완료 | 대기/완료/반려 목록, 승인/반려 처리 |
| 출금 관리 | ✅ 완료 | 대기/완료/반려 목록, 승인/반려 처리 |
| 보너스 지급 | ✅ 완료 | 일일 ROI 정산 실행, 보너스 내역 조회 |

#### 🛍️ 상품·운용
| 메뉴 | 상태 | 비고 |
|------|------|------|
| 상품 관리 | ✅ 완료 | 투자 상품 생성/수정/삭제/활성화 |
| 이율 관리 | ✅ 완료 | ROI%, 수수료%, 유니레벨 비율, 직급승진 조건 설정 |
| 투자 관리 | ✅ 완료 | 대시보드(활성/만기임박), 전체 투자 목록 |

#### 📢 소통·지원
| 메뉴 | 상태 | 비고 |
|------|------|------|
| 공지사항 | ✅ 완료 | 생성/수정/삭제, 핀 고정, 활성화 토글 |
| 뉴스 | ✅ 완료 | 리치 텍스트 에디터 포함, 카테고리/썸네일 |
| 푸시 발송 | ✅ 완료 | 즉시/예약/자동 발송 탭, 발송 이력 |
| 1:1 문의 | ✅ 완료 | 목록 조회, 답변 작성 |

#### 🔧 시스템·로그
| 메뉴 | 상태 | 비고 |
|------|------|------|
| 게임 로그 | ✅ 완료 | 게임별 승/패 기록 조회 |
| 감사 로그 | ✅ 완료 | 관리자 작업 기록 |
| 시스템 설정 | ✅ 완료 | 입출금 최소금액, 수수료, 유니레벨 비율 |

---

## 10. 게임 시스템 현황

### 게임 잔액 시스템
- 게임에 사용하는 잔액은 **별도 충전 없이** `users.bonusBalance` (출금 가능 수익) 그대로 사용
- USDT 원금은 게임에 사용 불가, **수익(DDRA)만** 게임 가능
- 게임 승패에 따라 `walletData.bonusBalance` 실시간 증감
- 게임 결과는 `gamelogs` 컬렉션에 기록 (`logGame()` 함수)

### 게임별 상세

| 게임 | 아이콘 | 배율 | RTP | 구현 완성도 |
|------|--------|------|-----|------------|
| 홀짝 | 🪙 | ×2 | 96% | ✅ 완성 |
| 주사위 | 🎲 | ×6 | 94% | ✅ 완성 |
| 슬롯머신 | 🎰 | 최대 ×50 | 92% | ✅ 완성 |
| 바카라 | 🃏 | ×1.95 (뱅커 커미션) | 98.9% | ✅ 완성 |
| 룰렛 | 🎡 | 최대 ×35 | 97.3% | ✅ 완성 |
| 포커 | ♠️ | 최대 ×100 | 99% | ✅ 완성 |

### 사운드 시스템 (Web Audio API)
파일 없이 브라우저의 `AudioContext` API로 직접 합성음 생성.
```javascript
SFX.play('coin')        // 홀짝 코인
SFX.play('dice_roll')   // 주사위 굴리기
SFX.play('slot_spin')   // 슬롯 스핀
SFX.play('roulette_spin')// 룰렛 회전
SFX.play('card_deal')   // 카드 딜
SFX.play('win')         // 일반 승리
SFX.play('lose')        // 패배
SFX.play('jackpot')     // 잭팟
```

### 슬롯 심볼 & 페이테이블
```
심볼: ['🍋','🍇','🍎','🍊','⭐','7️⃣','💎']
잭팟(💎×3): ×50  |  777: ×20  |  ⭐⭐⭐: ×10  |  3개 같은 심볼: ×5
```

---

## 11. 비즈니스 로직 (MLM 구조)

### 직급 시스템 (G0~G10)
```
G0  (일반회원)  : 직접 추천 0명
G1  (브론즈)    : 직접 추천 1명
G2  (골드)      : 직접 추천 3명   ← 기본값 (관리자에서 변경 가능)
G3  (플래티넘)  : 직접 추천 7명
G4  (다이아몬드): 직접 추천 15명
G5  (마스터)    : 직접 추천 30명
G6  (그랜드마스터): 직접 추천 60명
G7  (레전드)    : 직접 추천 120명
G8  (미식)      : 직접 추천 240명
G9  (엘리트)    : 직접 추천 500명
G10 (파운더)    : 직접 추천 1,000명
```
> ⚠️ 실제 숫자는 관리자 패널 `settings/rank_promo` 에서 설정한 값 우선

### 보너스 종류
1. **ROI 보너스** — 매일 관리자가 수동 실행, `투자금 × 일일ROI%` 지급
2. **직접 추천 보너스** — 직접 추천한 회원이 투자 시 발생
3. **유니레벨 보너스** — 하위 N단계 투자 시 발생 (비율은 settings에서 설정)
4. **직급 달성 보너스** — 직급 승진 시 일회성 보너스

### 투자 플로우
```
회원 → 투자 신청 → USDT 잔액 차감 → investments 기록 생성
                                        ↓
관리자 매일 일일 정산 실행 → bonuses 컬렉션 기록 → users.bonusBalance 증가
                                        ↓
회원 출금 신청 → transactions(withdrawal, pending) → 관리자 승인 → bonusBalance 차감
```

---

## 12. 완료된 개발 목록

| 번호 | 기능 | 커밋 해시 |
|------|------|----------|
| 1 | Hono + Cloudflare Pages 기본 세팅 | `2b44d88` |
| 2 | DEEDRA 회원 앱 Phase 1 (5탭 SPA) | `141357a` |
| 3 | DDRA 로고 배너 이미지 적용 | `3c786cc` |
| 4 | UI v2.0 전면 리디자인 | `5d75197` |
| 5 | 게임 그래픽 개선 v2.1 | `9a5f512` |
| 6 | 룰렛 게임 (Canvas) | `5da66e7` |
| 7 | 4개 언어 다국어 지원 (ko/en/vi/th) | `5383140` |
| 8 | 관리자 패널 (/admin 라우트) | `b9d349d` |
| 9 | Firebase Auth 프록시 로그인 (sandbox 우회) | `9dae597` |
| 10 | 자동직급승진/투자USDT차감/VIP출금수수료할인 | `bec5320` |
| 11 | 이율관리 (ROI%, 유니레벨 비율, 자동정산) | `38f4ff4` |
| 12 | 센터피 + 직급달성보너스 + 이율관리 UI | `32c22e4` |
| 13 | USDT/DDRA 통화 체계 전면 개편 (원금잠금, bonusBalance) | `a0ce034` |
| 14 | 직관적 DDRA 시스템 (충전/환전 제거, 수익=게임잔액) | `8798f7d` |
| 15 | 바카라 + 텍사스 홀덤 포커 게임 | `9291cb3` |
| 16 | logGame 중복 선언 버그 수정 | `712f830` |
| 17 | More 탭 UI 개편 (지갑/공지사항 제거, 거래내역 상단) | `4e4811f` |
| 18 | 게임 UI 전면 개편 (고화질 카지노 V2 + Web Audio 사운드) | `8d71de2` |

---

## 13. 미완성 / 반쪽 구현된 기능

### ⚠️ 반쪽 구현 (UI만 있고 로직 없음)

#### 1. 알림 센터 (`showNotifications`)
- **위치**: `app.js` 3545줄
- **현황**: 헤더 벨 아이콘 클릭 시 "새 알림이 없습니다" 토스트만 표시
- **해야 할 것**: 실제 알림 목록 모달 UI + Firestore `notifications` 컬렉션 설계 및 구현

#### 2. 공지사항 상세 보기 (`showAnnouncementDetail`)
- **위치**: `app.js` 1596줄
- **현황**: 함수 정의만 있고 내부 로직 없음 (`// 추후 상세 구현`)
- **해야 할 것**: 공지사항 클릭 시 상세 내용 모달 표시

#### 3. 비밀번호 찾기 (`handleForgotPassword`)
- **현황**: Firebase `sendPasswordResetEmail` 호출하는 로직 구현되어 있으나 sandbox에서 이메일 발송 테스트 불가
- **해야 할 것**: 프로덕션 환경에서 테스트 필요

### ❌ 아직 없는 기능 (설계/기획 단계)

#### 1. 실시간 알림/푸시 (회원 앱)
- 관리자 푸시 발송 기능은 admin에 있으나, 회원 앱에서 실제 수신하는 로직 없음
- Firebase Cloud Messaging(FCM) 연동 필요

#### 2. 출금 PIN 검증 강화
- PIN 설정 기능은 있으나, 실제 출금 시 PIN 입력 요구 로직 미흡

#### 3. KYC (신원 인증)
- 설계 없음. 추후 필요 시 추가

#### 4. 회원 자동 등급 승진 (실시간)
- 현재: 관리자 수동 변경 or 투자/정산 트리거 시 일부 체크
- 정확한 실시간 자동 승진 로직 검토 필요

#### 5. 모바일 앱 (네이티브)
- 현재는 웹앱 (PWA 수준)
- React Native / Flutter 네이티브 앱 미개발

---

## 14. 다음 개발자가 해야 할 작업

### 🔴 우선순위 높음 (즉시 처리)

1. **실시간 알림 시스템 구현**
   - Firebase Firestore `notifications` 컬렉션 설계
   - 회원 앱 알림 센터 모달 구현
   - 관리자 푸시 → 회원 수신 연결

2. **공지사항 상세 보기 구현**
   - `showAnnouncementDetail(id)` 함수 내용 채우기
   - 상세 모달 HTML 추가

3. **Cloudflare Pages 프로덕션 배포**
   - 현재 샌드박스에서만 테스트 중
   - `npx wrangler pages deploy dist --project-name deedra` 로 배포
   - 커스텀 도메인 연결

### 🟡 우선순위 중간

4. **게임 잔액 실시간 Firestore 동기화**
   - 현재 게임 승패 결과가 `walletData.bonusBalance` (메모리)만 업데이트
   - 페이지 새로고침 시 Firestore에서 다시 로드하므로 큰 문제는 없으나,
   - 게임 중 페이지 이탈 시 데이터 불일치 가능성 존재
   - 각 게임 결과에서 `updateDoc(userDoc, { bonusBalance: ... })` 즉시 반영 권장

5. **출금 처리 자동화 또는 API 연동**
   - 현재 관리자 수동 승인 방식
   - 추후 자동 USDT 전송 API (예: Binance API, TronScan API) 연동 고려

6. **투자 만기 자동 처리**
   - 현재 만기된 투자 자동 처리 로직 없음
   - Cloud Functions 또는 관리자 수동 처리

7. **보안 강화**
   - Firebase API Key가 프론트엔드에 노출됨 (Firestore Security Rules로 보호)
   - Firestore Security Rules 재검토 및 강화 필요
   - 관리자 패널 접근 제한 (IP 화이트리스트 등)

### 🟢 우선순위 낮음

8. **프론트엔드 리팩토링**
   - `app.js` 3,643줄 → 모듈화 (현재 단일 파일)
   - `admin.html` 8,832줄 → 분리 검토

9. **다국어 번역 검수**
   - 베트남어/태국어 번역이 기계 번역 수준
   - 네이티브 스피커 검수 필요

10. **성능 최적화**
    - 이미지 최적화 (logo-banner.png 용량 확인)
    - 불필요한 Firestore 쿼리 최적화

---

## 15. 알려진 버그 및 이슈

### 🐛 현재 알려진 버그

| 버그 | 영향 | 해결 방법 |
|------|------|----------|
| Firestore Compound Query Index 오류 | 거래내역 `createdAt` 정렬 시 인덱스 필요 | JS에서 클라이언트 정렬로 우회 처리됨 |
| Firebase Auth sandbox 도메인 제한 | 직접 SDK 로그인 불가 | Hono 백엔드 프록시로 우회 처리됨 |
| PM2 재시작 시 포트 충돌 | 서버 시작 실패 | `fuser -k 3000/tcp` 후 재시작 |

### ⚠️ 주의 사항

- `firebase-admin` 패키지가 `package.json`에 있으나, **Cloudflare Workers에서는 작동 불가**  
  (Node.js 전용 패키지). 현재는 admin SDK를 실제로 사용하지 않고 프론트에서 직접 Firestore 접근.  
  → 추후 정리 필요

- `public/static/js/api.js` 파일이 있으나 **현재 사용되지 않음** (레거시).  
  실제 Firestore 접근은 `firebase.js` 의 `window.FB` 객체를 통해 이루어짐.

---

## 16. Git 커밋 이력

```
8d71de2  feat: 게임 UI 전면 개편 - 고화질 카지노 V2, Web Audio 사운드, 거래내역 버그 수정
4e4811f  refactor: More 탭 UI 개편 - 지갑/공지사항 제거, 거래내역 상단 배치
712f830  fix: logGame 중복 선언 제거 - 슬롯/룰렛/바카라/포커 작동 불가 버그 수정
9291cb3  feat: 바카라(미니 바카라 규칙) + 텍사스 홀덤 포커 게임 추가
8798f7d  refactor: 직관적 DDRA 시스템 - 수익=출금가능DDRA=게임가능DDRA 통합
a0ce034  feat: USDT/DDRA 통화 체계 전면 개편
32c22e4  feat: 센터피(CenterFee) + 직급달성보너스 + 이율관리 UI 추가
9a62387  fix: 이율관리 스위치 설정값 복원 버그 수정
38f4ff4  feat: Policy B(2세대고정보너스) + 자동정산스케줄러 + 이율관리UI 개선
bec5320  feat: 미완성 기능 구현 - 자동직급승진/투자USDT차감/VIP출금수수료할인
f343a26  docs: 인수인계서 초안 작성
10167d2  fix: admin login + loadRateHistory + favicon 404
9dae597  fix: 로그인 완전 해결 - EmailAuthProvider + signInWithCredential
0efb9f7  fix: Firebase 로그인 에러 메시지 정상화
cd220ae  fix: Firebase 로그인 도메인 제한 우회 - 백엔드 프록시
4e521dc  feat: 일일 ROI 정산 시스템 완전 재설계
614fe5f  feat: 유니레벨 보너스 지급 패턴 설정 시스템 구현 (v3.0)
cfd06af  feat: 이율관리 탭에 직급 승진 조건 설정 기능 추가
2796047  fix: module 스크립트 함수 window 전역 노출 - onclick 오류 수정
5999ff6  feat: 센터 추가 모달 고급 디자인 리뉴얼
a60d997  fix: setup 페이지 JS 문법 오류 수정
5947597  feat: admin.html 자체 로그인 오버레이 추가
716cd3e  fix: DedraAPI 구현 (api.js 생성)
b9d349d  feat: admin.html 복원 및 /admin 라우트 추가
5383140  feat: 4개 언어 다국어 지원 추가 (ko/en/vi/th)
5da66e7  feat: 룰렛 게임 추가 (Canvas 고화질)
9a5f512  feat: 게임 그래픽 전면 개선 v2.1
5d75197  feat: UI 설계안 v2.0 전면 리디자인
3c786cc  feat: DDRA 배너 로고 이미지 적용
141357a  feat: DEEDRA 회원용 앱 Phase 1 완성
2b44d88  Initial commit - Hono Cloudflare Pages setup
```

---

## 부록: 주요 함수 색인 (app.js)

| 함수명 | 줄 번호 | 설명 |
|--------|---------|------|
| `SFX.play()` | 7 | Web Audio 사운드 재생 |
| `TRANSLATIONS` | 102 | 4개 언어 번역 데이터 |
| `onAuthReady()` | 1129 | Firebase Auth 상태 감지 |
| `initApp()` | 1138 | 앱 초기화 (로그인 후 호출) |
| `loadWalletData()` | 1208 | 지갑 데이터 로드 |
| `loadDeedraPrice()` | 1217 | DDRA 시세 로드 |
| `updateWalletUI()` | 1438 | 지갑 UI 갱신 |
| `updateHomeUI()` | 1457 | 홈 UI 갱신 |
| `showDepositModal()` | 1770 | 입금 모달 |
| `submitDeposit()` | 1792 | 입금 신청 처리 |
| `showWithdrawModal()` | 1822 | 출금 모달 |
| `submitWithdraw()` | 1856 | 출금 신청 처리 |
| `loadTxHistory()` | 1675 | 거래내역 로드 (탭 필터) |
| `loadInvestPage()` | 1951 | 투자 탭 초기화 |
| `loadProducts()` | 1957 | 투자 상품 목록 |
| `submitInvest()` | 2156 | 투자 신청 처리 |
| `loadNetworkPage()` | 2217 | 네트워크 탭 초기화 |
| `buildOrgTree()` | 2357 | 조직도 트리 생성 |
| `updateGameUI()` | 2493 | 게임 잔액 UI 갱신 |
| `startGame()` | 2505 | 게임 시작 (타입별) |
| `playOddEven()` | 2597 | 홀짝 게임 실행 |
| `playDice()` | 2646 | 주사위 게임 실행 |
| `playSpin()` | 2698 | 슬롯 스핀 실행 |
| `playRoulette()` | 2930 | 룰렛 실행 |
| `playBaccarat()` | 3120 | 바카라 실행 |
| `dealPoker()` | 3316 | 포커 카드 딜 |
| `logGame()` | 3037 | 게임 결과 Firestore 기록 |
| `showToast()` | 3632 | 토스트 알림 표시 |

---

*이 문서는 2026-03-12 기준으로 작성되었으며, 개발 진행에 따라 최신화가 필요합니다.*
