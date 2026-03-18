# [인수인계서] Dedra MLM System 데이터 이관 및 시스템 현황

## 1. 프로젝트 개요 및 개발 환경
*   **프로젝트명**: Dedra MLM System (USDT/DDRA 기반 네트워크 마케팅/투자 플랫폼)
*   **프론트엔드**: HTML/CSS/Vanilla JS (Vite 빌드, `public/index.html` 및 `public/static/app.js` 핵심)
*   **백엔드/데이터베이스**: Firebase Authentication, Firestore Database
*   **호스팅/배포**: Cloudflare Pages 추정 (GitHub `main` 브랜치 연동)
*   **DB 접근 방식(중요)**: 별도의 Firebase Admin SDK 라이브러리 없이, `src/index.tsx` 파일 내부에 하드코딩된 `SERVICE_ACCOUNT` 객체를 정규식으로 추출하여 JWT 토큰을 직접 생성하고 Firestore REST API를 호출하는 `.cjs` 스크립트들을 사용해 DB를 제어하고 있습니다.

---

## 2. 핵심 데이터 구조 (Firestore)
이관 및 금액 계산의 핵심이 되는 3가지 주요 컬렉션입니다.

### A. `users` (사용자 정보)
*   `uid`: Firebase Auth 고유 식별자
*   `username`: 유저 아이디 (검색 시 소문자 변환하여 매칭 필요)
*   `migrated`: 마이그레이션 완료 여부 (boolean)

### B. `wallets` (지갑 및 자산 정보)
*   **`totalInvest` (가장 중요)**: 현재 **활성화된 투자 원금의 총합 (USDT 원금)**. 프론트엔드 메인 화면의 `lockedUsdt` 및 '운용중 상품락업'에 표시되는 값입니다.
*   `totalDeposit`: 총 입금액 (이관 당시의 기준금액 등)
*   `bonusBalance`: **수익금 (USDT 기준)**. 출금 시 이 값을 DDRA 가격(`deedraPrice`, 기본 0.5)으로 나누어 '출금 가능 DDRA'로 보여줍니다.
*   `totalInvested`: 누적 투자 금액 (종료된 투자 포함)
*   `usdtBalance`: 보유 중인 현금성 USDT
*   `dedraBalance`: 보유 중인 게임용 DDRA

### C. `investments` (투자 내역)
*   `userId`: 유저의 uid
*   `amount` / `amountUsdt`: 투자 금액 (초기 데이터는 `amount`, 최근 데이터는 `amountUsdt`에 혼재되어 있어 스크립트 연산 시 둘 다 체크해야 함)
*   `productName`: 상품명 (예: `기존 데이터 이관`, `DDRA 360Days` 등)
*   `status`: 상태 (`active` 등)
*   `source`: 생성 출처 (`migration` 등)

---

## 3. 데이터 이관(Migration) 주요 이슈 및 조치 내역

### 🚨 이슈 1: 메인 화면의 'USDT 원금'이 0.00으로 표시되는 현상
*   **원인**: 프론트엔드 `app.js`에서 원금을 `usdtBalance`(현금잔고) 또는 잘못된 필드에서 읽어오고 있었습니다. 또한 이관된 데이터(`기존 데이터 이관`)의 투자 금액 합산 로직이 누락되어 있었습니다.
*   **조치**: 
    1. `public/static/app.js`를 수정하여 **`walletData.totalInvest`** 값을 메인 화면의 `USDT 원금` 및 `lockedUsdt`로 매핑했습니다.
    2. 총 자산은 `lockedUsdt + usdt + bonus` 로 계산하도록 수정했습니다.

### 🚨 이슈 2: 유저 계정에 구매하지 않은 100 USDT 상품이 중복 생성된 현상 (cyj0300 등)
*   **원인**: `migrated_investments.json` 파일을 읽어 DB에 넣는 초기 이관 스크립트(`import_investments2.cjs`)가 **결제 취소된 내역(`"management": "구매취소"`)을 필터링하지 않고** 모두 `active` 상태인 'DDRA 360Days' 상품으로 강제 생성했습니다. (총 448건)
*   **조치 완료사항**:
    1. `delete_cancelled_migrated.cjs` 스크립트를 작성하여 잘못 들어간 448개의 취소된 투자 내역을 완전히 삭제했습니다.
    2. `fix_total_invest_field2.cjs` 스크립트를 실행해 모든 유저의 `investments`를 다시 읽어 활성(active) 투자금만 합산한 뒤, 각 유저 지갑의 `totalInvest` 필드를 정상적인 금액으로 원복 업데이트했습니다. (cyj0300 유저 기준 1,393.94 -> 정상 이관금액인 1,193.94로 수정 완료)

### 🚨 이슈 3: 프론트엔드 배포 후 모바일 적용 지연 (캐시 문제)
*   **원인**: 모바일 웹 브라우저가 기존 `app.js`를 강하게 캐싱하여 코드가 즉시 반영되지 않았습니다.
*   **조치**: `public/index.html` 하단의 스크립트 호출부를 `<script src="/static/app.js?v=80"></script>` 처럼 버전을 올려(Bump) 강제 새로고침을 유도했습니다. 프론트 수정 후에는 **반드시 `?v=` 숫자를 올려서 커밋/배포**해야 유저 폰에 즉시 반영됩니다.

---

## 4. 백엔드(DB) 제어를 위한 핵심 Node.js 스크립트
작업 디렉토리(`/home/user/webapp`) 내에 데이터 검증 및 일괄 수정을 위해 만들어둔 유용한 `.cjs` 스크립트들이 있습니다. 다음 작업자분은 이 스크립트들의 코드를 복사/수정하여 활용하시면 됩니다.

1. **`fix_total_invest_field2.cjs`**
   * **역할**: Firestore의 모든 활성 투자(`status: active`)를 불러와 각 유저별 총 투자금을 계산하고, `wallets` 컬렉션의 `totalInvest` 필드를 알맞게 덮어씁니다.
2. **`check_user_invest.cjs` / `find_and_check2.cjs`**
   * **역할**: 특정 유저(username 또는 uid)의 지갑 상태(`wallets`)와 현재 가입된 상품 목록(`investments`)을 콘솔에 빠르게 출력하여 검증합니다.
3. **`import_investments2.cjs`**
   * **역할**: JSON 파일 기반으로 투자를 DB에 밀어넣는 기존 스크립트 (참고용. 사용 시 반드시 `구매취소` 조건문 필터 추가 필요).

**💡 REST API 토큰 발급 로직 (모든 스크립트 공통 헤더)**
다음 개발자가 새로운 스크립트를 짤 때 무조건 상단에 들어가야 하는 권한 획득 코드입니다.
```javascript
const fs = require('fs');
const crypto = require('crypto');
const indexCode = fs.readFileSync('./src/index.tsx', 'utf8');
const saMatch = indexCode.match(/const SERVICE_ACCOUNT = ({[\s\S]*?\n})/);
const sa = eval('(' + saMatch[1] + ')');

async function getAdminToken() {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: sa.client_email, sub: sa.client_email, aud: sa.token_uri, iat: now, exp: now + 3600, scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit' };
  const unsigned = Buffer.from(JSON.stringify(header)).toString('base64url') + '.' + Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sign = crypto.createSign('RSA-SHA256'); sign.update(unsigned);
  const signature = sign.sign(sa.private_key).toString('base64url');
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${unsigned}.${signature}` });
  return (await res.json()).access_token;
}
```

---

## 5. 다음 개발자를 위한 To-Do 및 인계사항
1. **출금 프로세스 점검 (Pending)**
   * "출금 신청" 시 `fix_withdraw.cjs` 및 `fix_submit_withdraw.cjs` 관련된 로직이 작동하는지 실테스트 필요 (출금 시 `walletData.bonusBalance` 차감 및 `withdrawals` 컬렉션 기록).
2. **이관 데이터 잔여 검증**
   * "구매취소" 데이터는 제거완료됨. 현재 유저 피드백 상 누락된 원금 문제는 해결된 것으로 판단됨.
3. **UI 캐시 관리**
   * GitHub 배포 후 클라이언트 미반영 시 `public/index.html` 내 `app.js?v=XX` 버전 펌핑 필수.
