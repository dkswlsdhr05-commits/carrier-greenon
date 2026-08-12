# Carrier GreenON

Carrier GreenON은 캐리어 에어컨 사용자를 위한 ESG 친환경 냉방 미션 + GREEN POINT 리워드 웹앱입니다. 실제 에어컨 API 대신 가상 IoT 데이터를 사용합니다.

## 주요 흐름

회원가입/로그인 → 현재 날씨 및 가상 에어컨 상태 → GREEN MISSION → 30분 단위 시뮬레이션 → 미션 성공 → 포인트 적립 → GREEN WALLET → REWARD SHOP 구매 → GREEN REPORT

## 로컬 실행

Node.js 22 이상이 필요합니다.

1. `.env.example`을 참고해 환경변수를 설정합니다.
2. `npm start`를 실행합니다.
3. `http://localhost:10000`에 접속합니다.

외부 패키지 설치는 필요하지 않습니다. Supabase JavaScript SDK 2.56.0은 `vendor/supabase.js`에 고정되어 있습니다.

## Supabase

- 스키마: `supabase/schema.sql`
- 사용자 데이터 테이블은 모두 RLS가 활성화되어 있습니다.
- 포인트 적립과 상품 구매 차감은 DB 트리거가 처리합니다.
- 브라우저에는 publishable key만 제공하며 `service_role`/secret key는 사용하지 않습니다.
- 신규 프로젝트의 Data API 노출 정책에 대응하기 위해 `authenticated` 역할 권한을 명시했습니다.

## Render 배포

루트의 `render.yaml` Blueprint를 사용합니다.

- Build Command: `npm run check`
- Start Command: `npm start`
- Health Check: `/health`
- 환경변수: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`

배포 후 Supabase Auth의 Site URL과 Redirect URL에 Render 공개 주소를 등록해야 이메일 확인 후 앱으로 돌아올 수 있습니다.
