# 📋 DEEDRA 프로젝트 인수인계서

> **작성일:** 2026-03-12  
> **이전 담당자:** AI 개발자 (GenSpark)  
> **목적:** 다음 작업자가 즉시 작업을 이어받을 수 있도록 모든 정보 전달

---

## 1. 서비스 개요

**DEEDRA**는 MLM(다단계 마케팅) 기반의 투자 관리 플랫폼입니다.

- 회원이 투자 상품에 투자하고 일일 ROI를 받는 구조
- 추천인 네트워크(유니레벨) 보너스 시스템
- 직급(G0~G10) 승진 시스템
- DDRA 토큰 가격 연동 지갑 시스템
- 관리자가 전체 시스템을 통합 관리하는 어드민 패널

---

## 2. 접속 URL (현재 샌드박스)

> ⚠️ 샌드박스 URL은 세션마다 바뀔 수 있습니다. 새 방에서 서비스 재시작 후 `GetServiceUrl`로 새 URL 확인 필요.

| 구분 | URL |
|------|-----|
| **회원 앱 (메인)** | https://3000-i522qss3zii32yvlb0rgs-2e1b9533.sandbox.novita.ai |
| **관리자 페이지** | https://3000-i522qss3zii32yvlb0rgs-2e1b9533.sandbox.novita.ai/static/admin |
| **테스트 계정 생성** | https://3000-i522qss3zii32yvlb0rgs-2e1b9533.sandbox.novita.ai/setup |

---

## 3. 계정 정보

### 관리자 계정
| 항목 | 값 |
|------|-----|
| **이메일** | admin@deedra.com |
| **비밀번호** | Admin1234! |
| **Firestore role** | admin |

### 테스트 회원 계정
| 항목 | 값 |
|------|-----|
| **이메일** | test1@deedra.com |
| **비밀번호** | Test1234! |
| **역할** | 일반 회원 (member) |

---

## 4. Firebase (백엔드 DB/인증) 정보

```
Firebase Project ID : dedra-mlm
Firebase API Key    : AIzaSyCijC0Lfvx0WJFWQc4kukND7yOlA-nABr8
Auth Domain         : dedra-mlm.firebaseapp.com
Storage Bucket      : dedra-mlm.appspot.com
Messaging Sender ID : (firebase.js 참조)
App ID              : (firebase.js 참조)
```

### Firebase Console 접근
- https://console.firebase.google.com/project/dedra-mlm
- Firestore Database, Authentication 메뉴에서 데이터/계정 관리

---

## 5. 프로젝트 구조

```
/home/user/webapp/
├── src/
│   └── index.tsx          # Hono 서버 메인 (라우트, Firebase Auth 프록시)
├── public/
│   ├── favicon.ico        # 파비콘 (루트용 복사본)
│   └── static/
│       ├── admin.html     # 어드민 페이지 (8410줄 단일 HTML)
│       ├── app.js         # 회원 앱 프론트엔드 (2972줄)
│       ├── firebase.js    # Firebase 초기화 + 로그인 프록시
│       ├── style.css      # 회원 앱 CSS
│       ├── i18n.js        # 다국어 (한/영/베트남/태국)
│       ├── logo-banner.png # 로고 이미지
│       └── js/
│           └── api.js     # DedraAPI 클래스 (어드민 Firestore 직접접근, 1421줄)
├── ecosystem.config.cjs   # PM2 설정
├── wrangler.jsonc         # Cloudflare Workers 설정
├── vite.config.ts         # Vite 빌드 설정
└── package.json
```

---

## 6. 서버 실행 방법

### 현재 샌드박스에서 서버 재시작
```bash
cd /home/user/webapp

# 빌드 (코드 변경 후 필수)
npm run build

# PM2로 서버 시작
pm2 start ecosystem.config.cjs

# 상태 확인
pm2 list
pm2 logs deedra-app --nostream

# 포트 3000 정리 후 재시작
fuser -k 3000/tcp 2>/dev/null || true
pm2 restart deedra-app
```

### 서버 정보
- **프레임워크:** Hono + Cloudflare Workers (wrangler pages dev)
- **포트:** 3000
- **PM2 앱명:** deedra-app
- **빌드 결과:** `/home/user/webapp/dist/_worker.js` (~594KB)

---

## 7. 핵심 기술 스택

| 구분 | 기술 |
|------|------|
| 백엔드 | Hono Framework + Cloudflare Workers |
| 프론트엔드 | Vanilla JS + Tailwind CSS (CDN) |
| 데이터베이스 | Firebase Firestore |
| 인증 | Firebase Authentication |
| 배포환경 | Wrangler Pages Dev (샌드박스), Cloudflare Pages (프로덕션) |
| 빌드 | Vite + @hono/vite-cloudflare-pages |
| 프로세스 | PM2 |

---

## 8. Firebase Firestore 컬렉션 구조

### 주요 컬렉션 목록
| 컬렉션 | 설명 |
|--------|------|
| `users` | 회원 정보 (uid, email, name, rank, role, status, referrerId 등) |
| `wallets` | 지갑 (userId, balance, bonusBalance, totalDeposit, totalWithdrawal) |
| `transactions` | 입출금 내역 (type: deposit/withdrawal, status: pending/approved/rejected) |
| `investments` | 투자 내역 (userId, productId, amount, status: active/completed/expired) |
| `products` | 투자 상품 (name, type: investment, dailyRoi, duration 등) |
| `bonuses` | 보너스 지급 내역 |
| `settlements` | 일일 ROI 정산 내역 |
| `announcements` | 공지사항 |
| `news` | 뉴스 |
| `tickets` | 1:1 문의 |
| `gameLogs` | 게임(룰렛) 로그 |
| `auditLogs` | 어드민 작업 감사 로그 |
| `centers` | 센터(지점) 정보 |
| `rateHistory` | 이율 변경 이력 |
| `notifications` | 알림 |
| **`settings/system`** | 시스템 설정 도큐먼트 |
| **`settings/companyWallets`** | 회사 입금 지갑 주소 |
| **`settings/rankPromotion`** | 직급 승진 조건 설정 |
| **`settings/bonusPaymentConfig`** | 유니레벨 보너스 지급 패턴 |
| **`settings/deedraPrice`** | DDRA 토큰 현재 가격 |

---

## 9. 로그인 해결 방법 (중요!)

### 문제
Firebase Auth SDK의 `signInWithEmailAndPassword()`는 iframe 도메인 체크를 하기 때문에
Firebase Console에 등록되지 않은 도메인(샌드박스 sandbox.novita.ai 등)에서 로그인이 차단됨.

### 해결 방법 (현재 적용됨)

#### 회원 앱 (firebase.js)
```javascript
// /api/auth/login 백엔드 프록시를 통해 Firebase REST API 직접 호출
async function loginWithEmail(authObj, email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  // mockUser 생성 후 window.FB._currentUser에 저장
  // window.onAuthReady(mockUser) 호출
}
```

#### 어드민 페이지 (admin.html)
```javascript
// EmailAuthProvider.credential + signInWithCredential 사용
const credential = EmailAuthProvider.credential(email, pass);
await signInWithCredential(auth, credential);
```

#### 백엔드 프록시 (src/index.tsx)
```javascript
app.post('/api/auth/login', async (c) => {
  // Firebase REST API: https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword
  // FIREBASE_API_KEY = 'AIzaSyCijC0Lfvx0WJFWQc4kukND7yOlA-nABr8'
});
```

---

## 10. 어드민 페이지 메뉴 구조

| 메뉴 ID | 이름 | 기능 |
|---------|------|------|
| `dashboard` | 대시보드 | 총 회원수, 총 입금, 총 출금, 활성 투자, 최근 거래 |
| `statistics` | 통계 차트 | 월별 통계, 직급 분포 차트 |
| `members` | 회원 관리 | 회원 목록, 상세보기, 정보수정, 지갑 조정, 직급 변경 |
| `orgtree` | 조직 구조도 | 추천 네트워크 트리 시각화 |
| `rankmonitor` | 직급 모니터 | 전체 회원 직급 현황 |
| `centers` | 센터 관리 | 지점 CRUD |
| `deposits` | 입금 관리 | 입금 신청 승인/거절 |
| `withdrawals` | 출금 관리 | 출금 신청 승인/거절 |
| `bonus` | 보너스 지급 | 보너스 수동 지급 |
| `products` | 상품 관리 | 투자 상품 CRUD |
| `rates` | 이율 관리 | ★ 핵심 설정 (하단 참조) |
| `investments` | 투자 관리 | 투자 목록 및 분석 |
| `notices` | 공지사항 | 공지 CRUD |
| `news` | 뉴스 | 뉴스 CRUD |
| `broadcast` | 푸시 발송 | 푸시 알림 발송 |
| `tickets` | 1:1 문의 | 문의 응답/종료 |
| `gamelogs` | 게임 로그 | 룰렛 게임 기록 |
| `auditlog` | 감사 로그 | 어드민 모든 작업 로그 |
| `settings` | 시스템 설정 | 사이트명, 유지보수모드 등 |

---

## 11. 이율 관리 탭 (rates) 상세 — 가장 복잡한 탭

### 포함 기능
1. **마케팅 로직 ON/OFF 스위치**
   - `enableDirectBonus`: 1대·2대 직접 추천 보너스
   - `enableUnilevel`: 유니레벨 보너스 (1~10단계)
   - `enableRankDiffBonus`: 직급 차이 보너스
   - `enableRankBonus`: 직급별 추가 보너스

2. **직접 추천 보너스율** (1대, 2대 각각 %)

3. **유니레벨 보너스율** (1~10단계 각각 %)

4. **직급 차이 보너스율** (%)

5. **직급별 추가 보너스율 그리드** (G0~G10 각 %)

6. **수수료 설정** (출금수수료 %, 입금수수료 %)

7. **VIP 할인율** (VIP 1~5 각 %)

8. **유니레벨 보너스 지급 패턴** (bonusPaymentCard)
   - 상품별 지급 주기: DAILY/WEEKLY/MONTHLY/CUSTOM_PATTERN
   - 전역 옵션: usePaymentPattern, useProductRate, useDynamicCalc

9. **직급 승진 조건 설정** (rankPromoCard)
   - 산하 계산 깊이 (networkDepth, 기본 3)
   - 승진 조건 모드: AND (모두 충족) / OR (하나라도 충족)
   - G1~G10 각 직급별: 최소 본인투자금, 최소 네트워크 매출, 최소 네트워크 회원수
   - **추가 옵션:** enableAutoPromotion, preventDowngrade, requireActiveInvestment, reCheckIntervalDays
   - **일괄 직급 재산정** 버튼

10. **일일 ROI 정산** (dailySettlementCard)
    - 날짜 선택 후 정산 실행
    - 정산 이력 조회

---

## 12. 직급 시스템 (G0~G10)

| 직급 | 레이블 | 기본 최소 네트워크 회원수 |
|------|--------|------------------------|
| G0 | Bronze | 0 (기본) |
| G1 | Silver | 3 |
| G2 | Gold | 10 |
| G3 | Platinum | 20 |
| G4 | Diamond | 40 |
| G5 | Master | 80 |
| G6 | Grand Master | 150 |
| G7 | Legend | 300 |
| G8 | Mythic | 600 |
| G9 | Elite | 1200 |
| G10 | Founder | 2000 |

### 직급 승진 로직 (api.js: runBatchRankPromotion)
1. 모든 비관리자 회원 조회
2. 각 회원의 산하 networkDepth 대까지 BFS로 다운라인 집계
3. 본인 활성투자금(selfInvest), 네트워크 매출(networkSales), 네트워크 회원수(networkMembers) 계산
4. promotionMode에 따라 조건 평가 (all: 모두, any: 하나라도)
5. preventDowngrade: true이면 현재 직급보다 낮아지지 않음
6. requireActiveInvestment: true이면 활성 투자 없을 시 강등 가능

---

## 13. 일일 ROI 정산 로직 (api.js: runDailyROISettlement)

1. 이미 해당 날짜 정산 실행 여부 체크 (중복 방지)
2. 모든 활성 투자(investments) 조회
3. 각 투자에 대해 일일 ROI 계산 (investment.amount × dailyRoi / 100)
4. 지급 패턴(bonusPaymentConfig) 확인 - 오늘 지급 날짜인지 체크
5. 투자자 지갑에 ROI 크레딧
6. 유니레벨 보너스 분배 (_processUnilevelBonus): 최대 10단계 상위 추천인에게 배분
7. 직급 차이 보너스 지급 (enableRankDiffBonus)
8. 정산 이력 저장 (settlements 컬렉션)

---

## 14. 회원 앱 주요 기능 (app.js)

| 기능 | 설명 |
|------|------|
| 회원가입/로그인 | Firebase Auth + /api/auth/login 프록시 |
| 지갑 | 잔액, DDRA 가격, 총 입금/출금 표시 |
| 투자 | 상품 목록 조회, 투자 신청 |
| 추천 | 추천 링크 생성, 추천인 목록 |
| 직급 | 현재 직급, 다음 직급 달성 조건 프로그레스바 |
| 조직도 | 산하 네트워크 트리 시각화 |
| 거래내역 | 입출금, 보너스 내역 |
| 알림 | 시스템 알림 |
| 게임 | 룰렛 게임 (Canvas) |
| 공지사항 | 관리자 공지 조회 |
| D-Day 카드 | 이벤트 카운트다운 |
| 다국어 | 한국어/영어/베트남어/태국어 (i18n.js) |

---

## 15. 미완성/미구현 작업 목록 (다음 작업자 인계사항)

### ❌ 미완성
1. **자동 승진 (enableAutoPromotion)** — API 로직 구현됨, UI에 설정 저장/로드 연결됨, 하지만 실제 **입금 승인 시 자동 트리거** 코드 미연결
   - `api.js`의 `approveDeposit()` 함수 안에 `if (settings.enableAutoPromotion)` 트리거 추가 필요

2. **주기적 자동 재검사 (reCheckIntervalDays)** — 설정 UI/저장은 있으나 실제 스케줄러 없음
   - Cloudflare Workers Cron Trigger 설정 필요 (wrangler.jsonc에 `[triggers.crons]` 추가)

3. **푸시 알림 실제 발송** — broadcast 탭 UI 있으나 실제 FCM 토큰 연동 미완성

4. **회원 앱 투자 신청 플로우** — 상품 목록은 조회되나 실제 투자 신청 버튼 누를 때 Firestore에 investments 도큐먼트 생성 로직 확인 필요

5. **VIP 할인율 적용** — 설정 UI 있으나 입금 시 실제 VIP 할인 적용 코드 미확인

### ⚠️ 확인 필요
1. **Firestore 보안 규칙** — 현재 `allow read, write: if request.auth != null;` 또는 더 열려 있는 상태로 추정. 프로덕션 배포 전 반드시 보안 규칙 강화 필요
2. **Firebase Console Authorized Domains** — 프로덕션 도메인 반드시 추가 필요
3. **DDRA 가격 업데이트 로직** — 관리자가 수동 입력하는 방식, 외부 시세 API 연동 미구현

### ✅ 완성된 기능
- 어드민 로그인 (signInWithCredential 방식)
- 회원 로그인 (백엔드 프록시 방식)
- 대시보드, 통계, 회원관리, 조직도, 직급모니터, 센터관리
- 입금/출금 승인·거절
- 보너스 수동 지급
- 상품 관리 CRUD
- 이율 설정 (유니레벨, 직접보너스, 직급차이보너스 등)
- 유니레벨 보너스 지급 패턴 설정
- 직급 승진 조건 설정 + 일괄 재산정
- 일일 ROI 정산 실행 + 이력 조회
- 공지사항/뉴스 CRUD
- 1:1 문의 응답/종료
- 게임 로그 조회
- 감사 로그
- 시스템 설정
- 다국어 지원 (4개국어)
- favicon 404 수정
- loadRateHistory 함수 누락 수정

---

## 16. Git 히스토리 요약

```
10167d2 fix: admin login - loadRateHistory 함수 추가, favicon 404, Illegal return 수정
9dae597 fix: 로그인 완전 해결 - EmailAuthProvider.credential + signInWithCredential
0efb9f7 fix: 로그인 에러 메시지 정상화
cd220ae fix: Firebase 로그인 도메인 제한 우회 - 백엔드 프록시 방식
4e521dc feat: 일일 ROI 정산 시스템 완전 재설계
614fe5f feat: 유니레벨 보너스 지급 패턴 설정 시스템 (v3.0)
cfd06af feat: 이율관리 탭에 직급 승진 조건 설정 기능 추가
2796047 fix: module 스크립트 함수 window 전역 노출 수정
5999ff6 feat: 센터 추가 모달 리뉴얼
5947597 feat: admin.html 자체 로그인 오버레이 추가
716cd3e fix: DedraAPI 구현 (api.js 생성)
b9d349d feat: admin.html 복원 및 /admin 라우트 추가
5383140 feat: 4개 언어 다국어 지원 추가
5da66e7 feat: 룰렛 게임 추가
9a5f512 feat: 게임 그래픽 전면 개선 v2.1
5d75197 feat: UI 설계안 v2.0 전면 리디자인
3c786cc feat: DDRA 배너 로고 이미지 적용
141357a feat: DEEDRA 회원용 앱 Phase 1 완성
```

---

## 17. 새 샌드박스에서 즉시 작업 시작하는 방법

새 세션/방에서 이 프로젝트를 이어받을 때:

```bash
# 1. 프로젝트 디렉토리 확인
ls /home/user/webapp/

# 2. 의존성 설치 (없으면)
cd /home/user/webapp && npm install

# 3. 빌드
cd /home/user/webapp && npm run build

# 4. 서버 시작
cd /home/user/webapp && pm2 start ecosystem.config.cjs

# 5. 상태 확인
pm2 list
curl http://localhost:3000

# 6. 공개 URL 확인 (GetServiceUrl 도구 사용 또는)
pm2 logs deedra-app --nostream
```

### 만약 pm2가 없으면
```bash
npm install -g pm2
```

### 만약 wrangler가 없으면
```bash
cd /home/user/webapp && npm install
```

---

## 18. 주요 파일별 역할 요약

| 파일 | 역할 | 줄수 |
|------|------|------|
| `src/index.tsx` | Hono 서버 + SPA HTML 렌더 + Firebase Auth 프록시 API | 1405 |
| `public/static/admin.html` | 어드민 전체 패널 (HTML+CSS+JS 단일파일) | 8410 |
| `public/static/app.js` | 회원 앱 모든 로직 (SPA) | 2972 |
| `public/static/firebase.js` | Firebase 초기화 + 로그인 프록시 함수 | 160 |
| `public/static/js/api.js` | DedraAPI 클래스 - 모든 Firestore CRUD | 1421 |
| `public/static/style.css` | 회원 앱 CSS | - |
| `public/static/i18n.js` | 한/영/베트남/태국 번역 데이터 | - |

---

## 19. 자주 발생했던 문제와 해결책

| 문제 | 원인 | 해결 |
|------|------|------|
| 로그인 안됨 | Firebase Auth 도메인 차단 | `signInWithCredential` 사용 또는 `/api/auth/login` 프록시 |
| Illegal return statement | `loadRateHistory()` 함수 선언 누락 | 함수 선언 추가 (✅ 이미 수정됨) |
| favicon 404 | `/favicon.ico` 경로에 파일 없음 | `→ /static/favicon.ico` 리다이렉트 (✅ 이미 수정됨) |
| __STATIC_CONTENT_MANIFEST 오류 | wrangler 초기 로딩 중 발생 | 무시해도 됨 (정상 작동) |
| 빌드 후 즉시 curl 실패 (000) | wrangler 초기화 시간 필요 | `sleep 5` 후 curl |
| Firestore 권한 오류 | Firebase 보안 규칙 | 인증 필요 or 규칙 완화 |

---

## 20. 프로덕션 배포 (Cloudflare Pages)

현재는 샌드박스에서만 실행 중. Cloudflare Pages 배포 시:

```bash
# 1. Cloudflare API 키 설정 (setup_cloudflare_api_key 도구 사용)

# 2. 빌드
cd /home/user/webapp && npm run build

# 3. Pages 프로젝트 생성 (최초 1회)
npx wrangler pages project create deedra --production-branch main

# 4. 배포
npx wrangler pages deploy dist --project-name deedra

# 5. Firebase Console에서 배포된 도메인 Authorized Domains에 추가
# → https://console.firebase.google.com/project/dedra-mlm/authentication/settings
```

---

*이 문서는 2026-03-12 기준으로 작성되었습니다.*  
*모든 코드는 `/home/user/webapp/` 에 있으며 git으로 관리됩니다.*
