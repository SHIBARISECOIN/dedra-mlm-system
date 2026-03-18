# 🔁 DEEDRA 프로젝트 인수인계서

> 작성일: 2026-03-14  
> 작성자: AI 개발 어시스턴트 (GenSpark)  
> 목적: 다음 개발자가 즉시 이어받아 개발 가능하도록 모든 정보 정리

---

## 1. 서비스 기본 정보

| 항목 | 내용 |
|------|------|
| 서비스명 | **DEEDRA (DDRA)** – MLM 기반 암호화폐 투자 플랫폼 |
| 회원 대시보드 URL | https://deedra.pages.dev |
| 관리자 페이지 URL | https://deedra.pages.dev/admin |
| 최신 배포 URL | https://81e3caf8.deedra.pages.dev |
| Cloudflare 프로젝트명 | `deedra` |
| 플랫폼 | Cloudflare Pages + Hono (Edge Worker) |

---

## 2. 기술 스택

| 항목 | 내용 |
|------|------|
| 백엔드 프레임워크 | **Hono** (TypeScript, Cloudflare Workers) |
| 프론트엔드 | 바닐라 JS + HTML (CDN 방식, 빌드 없음) |
| 데이터베이스 | **Firebase Firestore** (NoSQL) |
| 인증 | **Firebase Authentication** (이메일/비밀번호) |
| 푸시 알림 | **Firebase Cloud Messaging (FCM)** |
| 빌드 도구 | **Vite** + `@hono/vite-cloudflare-pages` |
| 배포 | **Cloudflare Pages** (wrangler CLI) |
| 패키지 매니저 | npm |
| 언어 | TypeScript (서버), JavaScript (클라이언트) |

---

## 3. Firebase 설정 정보

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyCijC0Lfvx0WJFWQc4kukND7yOlA-nABr8",
  authDomain: "dedra-mlm.firebaseapp.com",
  projectId: "dedra-mlm",
  storageBucket: "dedra-mlm.firebasestorage.app",
  messagingSenderId: "990762022325",
  appId: "1:990762022325:web:1b238ef6eca4ffb4b795fc"
};
```

- Firebase 콘솔: https://console.firebase.google.com/project/dedra-mlm
- Firestore 규칙: 현재 서버(Hono)에서 Admin SDK로 직접 처리
- FCM VAPID Key: firebase.js 내 `vapidKey` 변수 참조

---

## 4. 파일 구조

```
webapp/
├── src/
│   ├── index.tsx          ★ 메인 서버 (Hono 라우터 + 전체 HTML 템플릿)
│   └── renderer.tsx       - Hono 렌더러 설정
│
├── public/static/
│   ├── app.js             ★ 회원 대시보드 전체 클라이언트 로직 (~7000줄)
│   ├── style.css          ★ 전체 CSS (~3700줄)
│   ├── firebase.js        ★ Firebase SDK 초기화 + FCM
│   ├── i18n.js            ★ 다국어 번역 (한국어/영어/베트남어/태국어)
│   ├── admin.html         ★ 관리자 전용 SPA (~13500줄)
│   ├── handover.html      - (빈 파일, 미사용)
│   ├── favicon.ico        - 파비콘
│   ├── logo-banner.png    - 로고 배너 이미지
│   ├── js/
│   │   ├── api.js         ★ DedraAPI 클래스 - Firestore CRUD 전체 (~3400줄)
│   │   ├── api.js.bak2    - 이전 백업
│   │   └── solana-wallet.js  ★ Solana 지갑 연동 (입금 확인)
│   └── img/               - 이미지 파일들
│
├── dist/                  - 빌드 결과물 (배포용, git 추적 안함)
├── wrangler.jsonc         - Cloudflare 배포 설정
├── package.json           - 의존성
├── vite.config.ts         - Vite 빌드 설정
└── tsconfig.json          - TypeScript 설정
```

---

## 5. 서버 API 라우트 목록 (src/index.tsx)

### 인증
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/auth/login` | 이메일 로그인 |
| POST | `/api/auth/register` | 회원가입 |
| POST | `/api/auth/login-by-username` | 아이디(username)로 로그인 |

### 가격 정보
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/price/dexscreener` | DEX Screener에서 DDRA 가격 조회 |
| GET | `/api/price/jupiter` | Jupiter에서 SOL 가격 조회 |
| GET | `/api/price/token` | 토큰 가격 조회 |
| GET | `/api/price/forex` | 실시간 환율 조회 |

### 관리자
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/admin/member-edit-logs` | 회원 수정 이력 |
| POST | `/api/admin/reset-member-password` | 비밀번호 초기화 |
| POST | `/api/admin/migrate-username` | username 마이그레이션 |
| POST | `/api/admin/bulk-reset-password` | 일괄 비밀번호 초기화 |
| POST | `/api/admin/import-members` | 회원 일괄 가져오기 |
| POST | `/api/admin/set-ddra-token` | DDRA 토큰 설정 |
| POST | `/api/admin/run-settlement` | 수동 정산 실행 |

### 보조계정 (Sub-Admin)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/subadmin/login` | 보조계정 로그인 |
| POST | `/api/subadmin/refresh-token` | 토큰 갱신 |
| POST | `/api/subadmin/query` | Firestore 프록시 쿼리 |
| GET | `/api/subadmin/dashboard-stats` | 대시보드 통계 |

### 블록체인 입금 확인
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/solana/check-deposits` | Solana 입금 확인 |
| GET | `/api/solana/tx/:signature` | Solana 트랜잭션 조회 |
| POST | `/api/tron/check-deposits` | TRON 입금 확인 |

### 자동화 크론
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET/POST | `/api/cron/settle` | 일일 ROI 정산 실행 |
| GET/POST | `/api/cron/process-scheduled` | 예약 발송 처리 |

### FCM 푸시
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/fcm/register` | FCM 토큰 등록 |
| POST | `/api/fcm/send` | 푸시 알림 발송 |
| POST | `/api/fcm/process-notifications` | 알림 일괄 처리 |

### 기타
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/translate/announcement` | 공지사항 자동 번역 |
| GET | `/admin` | 관리자 페이지 |
| GET | `/` | 회원 대시보드 |

---

## 6. Firestore 컬렉션 구조

| 컬렉션 | 설명 | 주요 필드 |
|--------|------|-----------|
| `users` | 회원 정보 | uid, email, name, username, rank, role, status, referralCode, referredBy, createdAt |
| `wallets` | 지갑 정보 | userId, usdtBalance, dedraBalance, bonusBalance, totalDeposit, totalWithdrawal |
| `transactions` | 입출금 내역 | type(deposit/withdrawal), status, amount, userId, createdAt |
| `investments` | 투자(FREEZE) 내역 | userId, productId, amount, status, startDate, endDate, dailyRoi, lastSettledAt |
| `products` | 투자 상품 | name, type(investment), minAmount, maxAmount, roiPercent/dailyRoi, durationDays |
| `gamelogs` | 게임 로그 | userId, userEmail, game, bet, win(bool), ddraChange, usdtChange, createdAt |
| `announcements` | 공지사항 | title, content, isActive, isPinned, category, createdAt |
| `news` | 뉴스 | title, content, source, url, createdAt |
| `tickets` | 1:1 문의 | userId, subject, content, status, adminReply, createdAt |
| `auditLogs` | 감사 로그 | adminId, action, category, target, detail, timestamp |
| `bonusHistory` | 보너스 지급 이력 | userId, amount, type, reason, createdAt |
| `fcmTokens` | FCM 토큰 | userId, token, platform, createdAt |
| `scheduledBroadcasts` | 예약 발송 | title, content, scheduledAt, status |
| `autoRules` | 자동 알림 규칙 | triggerKey, title, message, isActive |
| `centers` | 센터 정보 | name, managerId, members |
| `settings/gameOdds` | 게임 확률 설정 | oddeven, dice, slot, roulette, baccarat, poker |
| `settings/rankPromotion` | 직급 승진 조건 | criteria(G1~G7별 조건, criteriaJson으로 직렬화) |
| `settings/bonusPaymentConfig` | 보너스 지급 설정 | unilevel rates, rankGap rates 등 |
| `settings/rates` | 이율 설정 | 각 보너스 비율 |

---

## 7. 관리자 페이지 메뉴 구성 (admin.html)

| 메뉴 | data-page | 설명 | 완성도 |
|------|-----------|------|--------|
| 📊 대시보드 | dashboard | 주요 통계 요약 | ✅ 완성 |
| 📈 통계 차트 | statistics | Chart.js 기반 그래프 | ✅ 완성 |
| 👥 회원 관리 | members | 회원 목록/수정/정지/직급 변경 | ✅ 완성 |
| 🌐 조직 구조도 | orgtree | 추천인 트리 시각화 | ✅ 완성 |
| 🏆 직급 모니터 | rankmonitor | 직급별 현황 + 자동 승급 | ✅ 완성 |
| 🏢 센터 관리 | centers | 센터 등록/수정/삭제 | ✅ 완성 |
| 💰 입금 관리 | deposits | 입금 승인/거부 | ✅ 완성 |
| 💸 출금 관리 | withdrawals | 출금 승인/거부 | ✅ 완성 |
| 🎁 보너스 지급 | bonus | 수동 보너스 지급 | ✅ 완성 |
| 🛍️ 상품 관리 | products | FREEZE 상품 등록/수정 | ✅ 완성 |
| 📐 이율 관리 | rates | 마케팅 보너스 비율 설정 | ✅ 완성 |
| 💼 투자 관리 | investments | 전체 투자 현황 | ✅ 완성 |
| 📢 공지사항 | notices | 공지 등록/수정/삭제/번역 | ✅ 완성 |
| 📰 뉴스 | news | 뉴스 등록/수정/삭제 | ✅ 완성 |
| 📣 푸시 발송 | broadcast | 즉시/예약/자동 푸시 발송 | ✅ 완성 |
| 💬 1:1 문의 | tickets | 문의 답변/종결 | ✅ 완성 |
| 🎮 게임 로그 | gamelogs | 게임 베팅 기록 + 회사 수익 | ✅ 완성 |
| 📋 감사 로그 | auditlog | 관리자 활동 이력 | ✅ 완성 |
| 👥 보조계정 관리 | subadmins | 보조 관리자 등록/권한 설정 | ✅ 완성 |
| ⚙️ 시스템 설정 | settings | 각종 시스템 설정 | ✅ 완성 |
| 🔍 ID 분석 리포트 | idreport | 회원 ID 분석 | ✅ 완성 |

---

## 8. 회원 대시보드 기능 목록 (app.js)

| 기능 | 설명 | 완성도 |
|------|------|--------|
| 로그인/회원가입 | 이메일 또는 username, 추천코드 입력 | ✅ 완성 |
| 홈 화면 | 자산 카드, 공지사항, 뉴스, 네트워크수익 미리보기 | ✅ 완성 |
| 지갑 (USDT/DDRA) | 잔액 표시, 환율 변환 | ✅ 완성 |
| 입금 | Solana/TRON 지갑 주소 표시, 입금 신청 | ✅ 완성 |
| 출금 | PIN 인증, 출금 신청 | ✅ 완성 |
| FREEZE (투자) | 상품 목록, 투자 신청, 내 투자 현황, 누적수익 | ✅ 완성 |
| 카지노 게임 | 홀짝, 주사위, 슬롯, 룰렛, 바카라, 포커 | ✅ 완성 |
| 게임 사운드 | Web Audio API 기반 효과음 | ✅ 완성 |
| 네트워크 수익 | 1대/2대/3대 하부 수익 조회 | ✅ 완성 |
| 내 정보 (프로필) | 이름, 직급, 추천코드, PIN 설정 | ✅ 완성 |
| 다국어 | 한국어/영어/베트남어/태국어 | ✅ 완성 |
| FCM 푸시 알림 | 앱 알림 수신 | ✅ 완성 |
| 자동 ROI 정산 | 일일 수익 자동 지급 체크 | ✅ 완성 |
| 뉴스 피드 | `loadNewsFeed()` 버튼은 있으나 **함수 미구현** | ⚠️ 미완성 |
| 다크/라이트 테마 | 테마 전환 | ✅ 완성 |

---

## 9. ⚠️ 미완성 / 추가 개발 필요 항목

### 즉시 수정 필요
1. **뉴스 피드 `loadNewsFeed()` 함수 없음**
   - `app.js` 어디에도 `loadNewsFeed` 함수가 정의되어 있지 않음
   - 새로고침 버튼 클릭 시 오류 발생
   - 해결: Firestore `news` 컬렉션 데이터를 `newsFeedList`에 렌더링하는 함수 구현

2. **뉴스 항목 표시 개수 제한**
   - 현재 홈 화면에서 뉴스 2개로 제한 (공지와 동일하게 맞춤)
   - 뉴스 전체보기 버튼/모달 없음

### 기능 개선 권장
3. **DDRA 가격 고정값 사용 중**  
   - `src/index.tsx` 3468줄: `dedraRate = 0.5` 하드코딩  
   - Firestore `settings/rates`에서 동적으로 읽도록 개선 권장

4. **Solana/TRON 입금 자동 감지**
   - 현재 수동 확인 방식 (`/api/solana/check-deposits`)
   - Cron 자동화 연결 필요 (Cloudflare Workers Cron Trigger 미설정)

5. **일일 ROI 자동 정산 Cron**
   - `/api/cron/settle` 라우트 구현 완료
   - Cloudflare `wrangler.jsonc`에 Cron Trigger 미설정 → 수동 호출만 가능
   - 추가: `wrangler.jsonc`에 `"triggers": { "crons": ["0 0 * * *"] }` 설정 필요

6. **이메일 인증 미구현**
   - 회원가입 시 이메일 인증 없음

7. **KYC(본인인증) 없음**

---

## 10. 개발 환경 세팅 방법

### 필수 설치
```bash
node >= 18
npm >= 9
```

### 로컬 시작
```bash
git clone [레포주소]
cd webapp
npm install
npm run build
npx wrangler pages dev dist --ip 0.0.0.0 --port 3000
```

### 배포
```bash
export CLOUDFLARE_API_TOKEN=dncJEzysbCbTguj0hZAPr1ZOXUlZVJFqovc2Cv7F
npm run build
npx wrangler pages deploy dist --project-name deedra
```

---

## 11. 마케팅/보너스 구조

| 보너스 종류 | 설명 |
|-------------|------|
| **유니레벨 보너스** | 하부 투자자 ROI의 일정 % (최대 5단계) |
| **직급 갭 보너스** | 직급 차이에 따른 추가 보너스 (패스스루 포함) |
| **직접 2세대 보너스** | 직접 추천 2단계 특별 보너스 |
| **센터피** | 센터 소속 투자자 수익의 일정 % |
| **균형 매출 조건** | 직급 승진 시 최대 라인 제외 나머지 매출 합계 조건 |

직급 체계: G0 → G1 → G2 → G3 → G4 → G5 → G6 → G7

---

## 12. 주요 이슈 해결 이력

| 이슈 | 해결 방법 | 커밋 |
|------|-----------|------|
| 균형매출 조건 초기화 버그 | Firestore 중첩 Map → JSON 직렬화(`criteriaJson`) 저장 | `08cc8bc` |
| 게임 로그 필드명 불일치 | `game/bet/win` ↔ `gameType/betAmount/winAmount` 정규화 매핑 | `8e377ec` |
| onSnapshot 미정의 오류 | firebase.js에 `onSnapshot` import 추가 | `14c32fd` |
| 보조계정 Firebase Auth 오류 | JWT 프록시 모드로 전환 | `7659b67` |
| 일일 정산 중복 지급 | Firestore 분산락 + `lastSettledAt` 체크 | `a88a505` |

---

## 13. 관리자 계정 정보

> ⚠️ 보안상 직접 기입하지 않음  
> Firebase Console → Authentication → Users에서 `role: 'admin'`인 계정 확인  
> Firestore → `users` 컬렉션 → `role == 'admin'` 필터링

---

## 14. 개발 시 주의사항

1. **`app.js`는 바닐라 JS** – 빌드 없이 직접 수정하면 즉시 반영 (빌드 후 배포 필요)
2. **`src/index.tsx`에 HTML 전체가 인라인** – `HTML()` 함수 안에 전체 회원 대시보드 HTML 포함
3. **Firestore 직접 접근** – 클라이언트에서 Firebase SDK로 직접 읽기/쓰기 (서버 없이)
4. **`window.FB`** – firebase.js가 초기화 후 `window.FB`에 모든 Firebase 함수를 노출
5. **다국어 키** – `i18n.js`에서 `t('key')` 함수로 번역, 4개 언어(ko/en/vi/th)
6. **DDRA 토큰** – Solana 블록체인 기반, `solana-wallet.js`에서 지갑 연동
7. **빌드 후 반드시 배포** – `npm run build` → `npx wrangler pages deploy dist`

---

## 15. Git 커밋 히스토리 요약 (최근 20개)

```
7f69efb fix: 공지/뉴스 50:50 비율 - 뉴스도 공지와 동일한 1행 compact 스타일
196f0d8 fix: 공지/뉴스 기존 스타일 그대로 위아래 50:50 배치 (색깔 제거)
8e377ec fix: 게임 로그 필드명 정규화 + 회원ID 표시 + 회사수익 요약 + 공지/뉴스 수직배치
d695488 feat: 공지사항/뉴스 반반 가로 배치
a0e0e52 feat: 카지노 베팅 숫자입력 방식 + 그래픽/사운드 고급화 + 균형매출 JSON 직렬화 저장
08cc8bc fix: 균형매출 criteriaJson 직렬화 저장으로 초기화 버그 완전 수정 + 투자 목록 누적수익 왼쪽 표시
14c32fd fix: onSnapshot 추가, EARN_PROD_COLORS 정의, loadProducts 원래 디자인 복원
59fd29f fix: 내 FREEZE 현황 원래 디자인 복원 + 누적 수익만 추가
7569d6f fix: 균형 매출 버그 수정 + 홈 EARN 원래 디자인 복원
d998f28 feat: 홈 화면 EARN 섹션 재설계
8d7b546 feat: 네트워크 수익 패널 전면 재설계
a88a505 fix: 정산 중복 방지 강화
7659b67 fix: sub-admin proxy mode complete
cd0c555 feat: 이율 관리 - 마케팅 규칙 자동 설명 패널 추가
0f3c8fb feat: 직급 승진 조건에 균형 매출(Balanced Volume) 추가
10ca0b9 fix: 패스스루 로직 수정
7e3614b fix: admin.html Unexpected reserved word
03a2c4a feat: 판권 매칭 방식 C 추가
9c1f683 fix: USDT 잔액 수정 입력 버그
b40ad5c fix: 총자산·출금 계산 로직 수정
```

---

*이 문서는 2026-03-14 기준으로 작성되었습니다.*
