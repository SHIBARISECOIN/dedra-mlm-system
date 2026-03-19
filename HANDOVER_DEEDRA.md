# DEEDRA 프로젝트 인수인계서

## 1. 프로젝트 개요 및 환경
* **프로젝트명:** DEEDRA (글로벌 다단계/네트워크 마케팅 플랫폼)
* **프론트엔드:** HTML/CSS/JS (Vanilla JS + SPA 구조), Tailwind CSS (CDN)
* **백엔드/인프라:** Cloudflare Pages (Hono 프레임워크), Firebase (Auth, Firestore DB)
* **버전 관리:** GitHub (https://github.com/SHIBARISECOIN/dedra-mlm-system)

## 2. 주요 URL 및 접속 정보
* **회원 대시보드 (사용자):** https://deedra.pages.dev
* **관리자 콘솔:** https://deedra.pages.dev/static/admin
* **GitHub 저장소:** https://github.com/SHIBARISECOIN/dedra-mlm-system (브랜치: `main`)

## 3. 핵심 파일 및 디렉토리 구조 (`/home/user/webapp/`)
* `src/index.tsx`: Hono 기반의 백엔드 라우터 및 API (Firebase Auth 프록시, 토큰 가격 연동 등)
* `public/index.html`: 사용자용 SPA 메인 HTML
* `public/static/app.js`: 사용자용 SPA 핵심 비즈니스 로직 (회원가입/로그인, 조직도, 지갑 등)
* `public/static/admin.html`: 관리자용 SPA (메뉴, 통계, 입출금 관리, 서브어드민 제어 등 통합본)
* `public/static/firebase.js`: Firebase 초기화 및 전역 설정
* `vite.config.ts` / `wrangler.jsonc`: Cloudflare 빌드 및 배포 설정 파일

## 4. 현재 개발 완료 상태
* **회원 시스템:** 이메일/비밀번호 기반 Firebase Auth, 추천인 코드를 통한 트리 구조 형성 (firestore `users` 컬렉션).
* **지갑 및 자산:** USDT, 보너스(Bonus), 투자(Locked) 3종 지갑 구축 및 실시간 잔액 동기화.
* **입출금 관리 (관리자):** 관리자 모드에서 회원의 입출금 승인/거절 로직 구현 완료.
* **조직도 (사용자/관리자):** 본인 하위 네트워크 시각화 및 직급(G0~G4)에 따른 열람 뎁스(Depth) 제한 적용 완료. 마우스 드래그 이동 기능(`makeDraggableMap`) 버그 패치 완료.
* **보조계정 (서브어드민):** 관리자 기능 중 특정 메뉴만 권한을 부여하여 발급/관리하는 시스템 구축 완료.
* **임의 입금/차감 관리:** 이벤트/마케팅 목적 등으로 관리자가 직접 코인을 입금/차감하는 기능 및 히스토리(로그) 기록 기능 추가 완료 (⚠️ 내역에 임의입금 주의 배지 노출).

## 5. 현재 직면한 문제 및 다음 개발자가 해야 할 일 (To-Do)
1. **[버그 수정] 임의 입금 관리 "처리 내역" 로딩 에러:**
   * **원인:** `admin.html` 파일 내부의 `window.loadManualAdjustLogs` 함수에서 `window.fmtDate`를 호출하고 있으나, `fmtDate` 함수가 정의되지 않아 발생하는 에러입니다. (콘솔에 `window.fmtDate is not a function` 발생)
   * **해결책:** `admin.html` 상단에 공통 날짜 포맷 함수(`fmtDate`)를 선언해주거나, 해당 변환 로직을 `new Date(r.createdAt.seconds * 1000).toLocaleString()` 등으로 수정하면 바로 해결됩니다.
2. **[데이터 점검] 특정 사용자 하위 조직도 누락 현상:**
   * 아이디 `cyj0300`의 하위 조직 데이터가 정상적으로 표시되지 않거나 누락되는 이슈가 리포트되었습니다. Firestore의 `referredBy` 필드 연결 상태 및 재귀적 트리 로딩 로직(`fallback` 로직) 검토가 필요합니다.
3. **[기능 복구] 실시간 글로벌 트랜잭션 뷰:**
   * 과거 구현되었던 실시간 트랜잭션 뷰를 메인화면/관리자단에 복구하는 작업이 대기 중입니다.
4. **[코드 최적화] 파일 비대화 문제:**
   * `app.js`와 `admin.html` 파일이 매우 비대해진 상태입니다(각각 약 1만 줄 이상). 기능별로 JS 모듈화를 진행하면 유지보수가 훨씬 수월해질 것입니다.

## 6. 빌드 및 배포 명령어 가이드
새로운 코드를 수정한 후 Cloudflare Pages에 배포하려면 아래 명령어들을 순차적으로 실행하세요.
```bash
# 1. 터미널에서 작업 폴더로 이동
cd /home/user/webapp

# 2. Vite 기반 빌드 실행 (디렉토리 내에 dist 폴더가 생성/갱신됨)
npm run build
# 혹은 npx vite build

# 3. Wrangler를 사용해 Cloudflare Pages로 배포
npx wrangler pages deploy dist --project-name deedra
```
