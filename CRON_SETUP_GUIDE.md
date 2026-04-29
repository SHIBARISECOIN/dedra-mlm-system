# 외부 Cron 설정 가이드 (cron-job.org)

## 개요

Cloudflare Pages는 자체 Cron Triggers를 지원하지 않으므로, 외부 cron 서비스인 **cron-job.org**(무료)를 사용하여 자동 입금 감지 및 정기 작업을 트리거합니다.

## 전체 구조

```
cron-job.org (5분 주기)
        │
        ├─→ POST https://ddra.io/api/solana/check-deposits         (Solana USDT 자동 감지)
        │   Header: x-cron-secret: {CRON_SECRET}
        │
        └─→ POST https://ddra.io/api/cron/check-major-chain-deposits  (XRP/BTC 자동 감지)
            Header: x-cron-secret: {CRON_SECRET}
            Body:   { "userLimit": 500, "txLimit": 20 }
```

추가로 일일 정산용 cron(매일 1회)도 등록할 수 있습니다.

---

## 사전 준비

### CRON_SECRET 값 확인

운영에 등록된 `CRON_SECRET`은 Cloudflare Pages > Settings > Environment Variables > Production 에서 확인할 수 있습니다 (이미 운영 환경에 등록 완료).

직접 확인이 어려우신 경우, 새로운 값으로 갱신하는 절차:

```bash
# 1. 새 시크릿 값 생성 (32자 랜덤)
openssl rand -hex 16

# 2. Cloudflare Pages에 업데이트
cd /home/user/webapp
npx wrangler pages secret put CRON_SECRET --project-name deedra
# (위 명령 실행 후 새 시크릿 값 입력)
```

⚠️ **새 값으로 변경하면 기존 cron-job.org 설정도 새 값으로 업데이트해야 합니다.**

---

## cron-job.org 설정 단계

### 1단계: 회원가입

1. https://cron-job.org 접속
2. 우측 상단 **"Sign up"** 클릭
3. 이메일 주소와 비밀번호 입력 후 가입
4. 이메일 인증 완료

### 2단계: Cron Job #1 — Solana 자동 입금 감지

1. 로그인 후 좌측 메뉴에서 **"Cronjobs"** 클릭
2. 우측 상단 **"CREATE CRONJOB"** 버튼 클릭
3. 다음 정보 입력:

| 항목 | 값 |
|------|-----|
| **Title** | `DDRA - Solana Deposit Check` |
| **Address (URL)** | `https://ddra.io/api/solana/check-deposits` |
| **Schedule** | `Every 5 minutes` 선택 (또는 `Custom: */5 * * * *`) |

4. **"ADVANCED"** 탭 클릭
5. 다음 정보 추가:

| 항목 | 값 |
|------|-----|
| **Request method** | `POST` |
| **Request body** | `{}` |
| **Request headers** | 아래 두 헤더 추가 |

**Headers 추가**:
- `Content-Type` : `application/json`
- `x-cron-secret` : `{여기에 CRON_SECRET 값 입력}`

6. **"Notifications"** 탭에서 실패 알림 설정 (선택사항):
   - `Notify on failure`: 체크
   - `Notify when job is restored`: 체크

7. **"SAVE"** 버튼 클릭

### 3단계: Cron Job #2 — XRP/BTC 자동 입금 감지

1. **"CREATE CRONJOB"** 버튼 클릭
2. 다음 정보 입력:

| 항목 | 값 |
|------|-----|
| **Title** | `DDRA - XRP/BTC Deposit Check` |
| **Address (URL)** | `https://ddra.io/api/cron/check-major-chain-deposits` |
| **Schedule** | `Every 5 minutes` (또는 `Custom: */5 * * * *`) |

3. **"ADVANCED"** 탭에서:

| 항목 | 값 |
|------|-----|
| **Request method** | `POST` |
| **Request body** | `{"userLimit":500,"txLimit":20}` |

**Headers 추가**:
- `Content-Type` : `application/json`
- `x-cron-secret` : `{CRON_SECRET 값}`

4. **"SAVE"** 버튼 클릭

### 4단계: Cron Job #3 — 일일 정산 (선택사항)

자동 정산을 외부 cron에서 강제 트리거하려면:

| 항목 | 값 |
|------|-----|
| **Title** | `DDRA - Daily Settlement` |
| **Address (URL)** | `https://ddra.io/api/cron/settle` |
| **Schedule** | `Every day at 00:00 UTC` (또는 `Custom: 0 0 * * *`) |
| **Request method** | `POST` |
| **Request body** | `{}` |

**Headers**:
- `Content-Type` : `application/json`
- `x-cron-secret` : `{CRON_SECRET 값}`

⚠️ 정산 시각은 Firestore의 `settings/rates` 문서에 설정된 시간과 일치해야 실행됩니다(자체 5분 윈도우 검증). 시각 불일치 시 자동으로 skip 처리됩니다.

---

## 검증 단계

### 1. cron-job.org 측 검증

각 cronjob 페이지에서 **"History"** 탭 확인:
- ✅ Status `200 OK` 또는 `OK` → 정상
- ❌ Status `401 Unauthorized` → CRON_SECRET 값 오류 (재설정 필요)
- ❌ Status `500 Internal Server Error` → 서버 측 문제 (관리자에게 보고)

### 2. 운영 측 검증

```bash
# 로그 확인 (Cloudflare Pages Functions 로그)
npx wrangler pages deployment tail --project-name deedra
```

### 3. 수동 테스트 (curl)

```bash
# Solana 자동 감지 테스트
curl -X POST https://ddra.io/api/solana/check-deposits \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: {CRON_SECRET}" \
  -d '{}'

# XRP/BTC 자동 감지 테스트
curl -X POST https://ddra.io/api/cron/check-major-chain-deposits \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: {CRON_SECRET}" \
  -d '{"userLimit":500,"txLimit":20}'
```

**기대 응답**: HTTP 200 + JSON 결과 (성공한 경우)

---

## 모니터링 권장사항

1. **cron-job.org 알림 설정**: 실패 알림 이메일 수신
2. **Cloudflare Analytics**: Pages 트래픽 모니터링에서 5분 주기 호출 확인
3. **Firestore 모니터링**: `transactions` 컬렉션에서 자동 처리된 입금 건수 추이 확인

---

## 문제 해결

| 증상 | 원인 | 해결 방법 |
|------|------|-----------|
| 401 Unauthorized | CRON_SECRET 불일치 | cron-job.org 헤더 값 재확인 |
| 응답 없음 / Timeout | URL 오타 | `https://ddra.io/api/...` URL 재확인 |
| 자동 처리 안됨 | RPC 한도 초과 | `userLimit` 줄이거나(예: 100) 호출 주기 늘리기(10분) |
| 비용 발생 | RPC 호출 과다 | Solana RPC 노드 분산 / 무료 크레딧 한도 확인 |

---

## 비용 정보

- **cron-job.org**: 완전 무료 (월 10,000 호출까지). 5분 주기 × 2개 = 월 약 17,280 호출 → **유료 플랜(월 $9.99)** 권장
  - 대안: 10분 주기로 변경 시 월 8,640 호출 → 무료 플랜 가능
- **Cloudflare Pages**: 무료 플랜 충분 (월 100,000 요청까지)
- **운영 RPC 비용**: Solana 공개 RPC 사용 중 → 별도 비용 없음

---

## 백업 옵션 (cron-job.org 장애 시)

1. **GitHub Actions** (`.github/workflows/cron.yml`)
2. **EasyCron** (https://www.easycron.com)
3. **별도 Cloudflare Worker** + Cron Triggers (Workers는 cron 지원)

필요 시 백업 옵션 구현 가이드를 추가로 제공해 드릴 수 있습니다.

---

**문서 작성일**: 2026-04-29
**최종 배포**: https://ddra.io (https://a73c76d0.deedra.pages.dev)
