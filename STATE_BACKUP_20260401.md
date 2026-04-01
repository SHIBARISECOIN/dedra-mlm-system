# DEEDRA 프로젝트 상태 및 AI 인수인계 백업 (2026-04-01)

## 1. 시스템 핵심 요약
- **프로젝트명**: DEEDRA (글로벌 MLM 가상자산 투자 플랫폼)
- **프론트엔드**: Vanilla JS (app.v3.js), HTML/CSS (Tailwind CDN) - SPA 방식
- **백엔드**: Hono v4 (Cloudflare Workers/Pages)
- **데이터베이스 & 인증**: Firebase Firestore, Firebase Auth (ddra-mlm)
- **라이브 URL**: https://deedra.pages.dev / https://ddra.io
- **주요 기능**: USDT 입금, FREEZE 플랜, 자동 복리(Snowball), 카지노 게임, 잭팟, 다국어(한/영/베/태)

## 2. 오늘 해결 및 완료된 작업
1. **무한 로딩 버그 픽스**: `app.v3.js` 내 잭팟 렌더링 함수의 중괄호(`}`) 오타로 인한 구문 오류(Syntax Error) 해결 및 캐시 무효화 버전 업데이트(`v=1775029778191`).
2. **주간 잭팟 다국어(i18n) 적용**: 한국어, 영어, 베트남어, 태국어로 잭팟 배너 UI 번역 완료.
3. **Cloudflare 배포 파이프라인 복구**: `CLOUDFLARE_API_TOKEN` 연동하여 `npx wrangler pages deploy` 정상화.
4. **무인 자동화(Cron) 스케줄러 완벽 연동**: 
   - 깃허브 액션(`.github/workflows/cron.yml`) 세팅 완료.
   - `*/5 * * * *`: 5분마다 솔라나 자동 입금 체크.
   - `0 3 * * 6`: 매주 토요일 낮 12시(KST) 주간 잭팟 당첨자 추첨 실행.

## 3. 관리자(AI) 지원 가능 로직 (명령 대기 중)
- **수동 입출금 조작**: 특정 유저의 이메일/ID로 Firestore `wallets` 컬렉션에 접근, 즉각적인 잔액(USDT 등) 증감 및 `Manual Adjust` 로그 기록.
- **출금 제재**: 유저의 `withdrawSuspended` 값을 true로 변경하여 즉시 출금 차단.
- **기타 관리**: 직급 강제 조정, 롤백, 페널티 부과 등 DB 권한을 통한 1초 컷 조치 가능.

## 4. AI 개발자 절대 수칙 (대표님 지시사항)
1. **"무턱대고 라이브 서버 덮어쓰기 금지"**: 프론트엔드/백엔드 코드 수정 시 반드시 내부에서 문법 검사(`node -c` 등) 및 로직 확인 후 배포할 것 (무한 로딩 절대 방지).
2. **"오만함 금지"**: 모호한 기획이나 중요한 자금 관련 로직은 독단적으로 판단하지 말고 대표님께 여쭤보고 실행할 것.
3. 잦은 실수로 전기를 굶는 일이 없도록 철저히 검증하고 완벽주의를 기할 것.

## 5. 추후 진행 대기 중인 잔여 과제 (이전 AI 인수인계 내역)
- 뉴스 피드 UI 로더(`loadNewsFeed()`) 부재 문제 해결.
- 하드코딩된 DDRA 코인 가격을 Firestore Settings와 연동.
- 10일 특수 보너스 출금 페널티 로직 우회 상태 점검.
