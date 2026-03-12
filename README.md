# DEEDRA

## 프로젝트 개요
- **서비스명**: DEEDRA (디드라)
- **목적**: MLM 기반 가상자산 투자 관리 플랫폼
- **핵심 기능**: USDT 투자 → 일일 ROI(DDRA) 지급 → 카지노 게임 / USDT 출금
- **타겟 시장**: 한국, 베트남, 태국 (4개 언어 지원)

## 🔗 접속 URL
| 구분 | URL |
|------|-----|
| 🏠 **회원 앱 (프로덕션)** | https://deedra.pages.dev |
| 🔐 **관리자 페이지** | https://deedra.pages.dev/admin |
| 🛠️ **초기 데이터 설정** | https://deedra.pages.dev/setup |

## 🔐 관리자 계정
| 항목 | 값 |
|------|-----|
| 이메일 | `admin@deedra.com` |
| 비밀번호 | `Admin1234!` |

## 기술 스택
| 구분 | 기술 |
|------|------|
| 백엔드 | Hono v4 (Cloudflare Workers) |
| 프론트엔드 | Vanilla JS + Custom CSS |
| 데이터베이스 | Firebase Firestore |
| 인증 | Firebase Auth (Hono 프록시) |
| 배포 | Cloudflare Pages |
| 빌드 | Vite |

## 데이터 구조
- **users** – 회원 정보 (직급, 추천인, PIN)
- **wallets** – 지갑 (usdtBalance, bonusBalance)
- **investments** – 투자 기록
- **transactions** – 입출금 내역
- **bonuses** – 보너스 지급 내역
- **gamelogs** – 게임 결과 기록
- **notifications** – 알림 (실시간 onSnapshot)
- **announcements** – 공지사항
- **products** – 투자 상품
- **settings** – 시스템 설정 (DDRA 시세, 수수료, 직급 조건)

## 주요 기능 현황
### 회원 앱 (5탭 SPA)
- ✅ 홈: 자산 현황, 입출금, DDRA 시세, 공지사항
- ✅ 투자: 상품 목록, 시뮬레이터, 투자 신청, 만기 자동 처리
- ✅ 네트워크: 조직도, 추천 코드, 직급 현황
- ✅ 플레이: 6종 카지노 게임 (홀짝/주사위/슬롯/바카라/룰렛/포커)
- ✅ 더보기: 거래 내역, 프로필, 설정

### 관리자 패널
- ✅ 대시보드 / 회원관리 / 조직도 / 입출금 승인 / 상품관리
- ✅ 보너스 정산 / 공지사항 / 게임로그 / 푸시 알림 발송

## 개발 환경 시작
```bash
cd /home/user/webapp
npm install
npm run build
pm2 start ecosystem.config.cjs
```

## 배포
```bash
export CLOUDFLARE_API_TOKEN=<토큰>
export CLOUDFLARE_ACCOUNT_ID=e35626e04599222b1df7a710e862cf91
npm run build
npx wrangler pages deploy dist --project-name deedra --branch main
```

## 배포 상태
- **플랫폼**: Cloudflare Pages
- **상태**: ✅ 운영 중
- **최종 배포**: 2026-03-12
