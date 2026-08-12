# Carrier GreenON 개발 체크리스트

## PHASE 1 — 기본 웹앱

- [x] 프로젝트 기본 구조 생성
- [x] White + Blue 디자인 시스템
- [x] 모바일 반응형 레이아웃
- [x] 하단 Navigation
- [x] 홈 화면


## PHASE 2 — 에어컨 상태

- [x] 가상 Carrier 에어컨 데이터
- [x] POWER 상태
- [x] 냉방 MODE
- [x] 설정온도
- [x] FAN 상태
- [x] 사용시간
- [x] 필터 상태
- [x] 정상 상태 Blue UI
- [x] 비정상 상태 Red UI
- [x] 상태 시뮬레이션 패널


## PHASE 3 — GREEN MISSION

- [x] 오늘의 미션
- [x] 미션 참여
- [x] 미션 진행 상태
- [x] 진행률 표시
- [x] 시간 +30분 시뮬레이션
- [x] 미션 조건 확인
- [x] 미션 Warning
- [x] 미션 성공
- [x] 미션 실패


## PHASE 4 — GREEN POINT

- [x] 미션 성공 시 포인트 지급
- [x] GREEN WALLET
- [x] 현재 포인트
- [x] 포인트 적립 기록
- [x] 포인트 사용 기록


## PHASE 5 — REWARD SHOP

- [x] 리워드 상품 목록
- [x] FOOD 카테고리
- [x] LIFE 카테고리
- [x] CARRIER 카테고리
- [x] 상품 상세
- [x] 포인트 구매
- [x] 포인트 차감
- [x] 포인트 부족 Warning
- [x] 구매내역


## PHASE 6 — 사용자

- [x] 회원가입
- [x] 로그인
- [x] 로그아웃
- [x] MY 페이지
- [x] GREEN LEVEL
- [x] GREEN REPORT


## PHASE 7 — Supabase

- [x] Supabase 프로젝트 연결
- [x] Auth 연결
- [x] profiles 테이블
- [x] missions 테이블
- [x] user_missions 테이블
- [x] point_transactions 테이블
- [x] rewards 테이블
- [x] reward_orders 테이블
- [x] aircon_status 테이블
- [x] GREEN LEVEL 데이터
- [x] RLS 설정
- [x] 사용자별 데이터 접근 테스트


## PHASE 8 — 실제 DB 전환

- [x] 임시 사용자 데이터 제거
- [x] 임시 포인트 데이터 제거
- [x] GREEN POINT Supabase 저장
- [x] 미션 기록 Supabase 저장
- [x] 상품 데이터 Supabase 연결
- [x] 구매내역 Supabase 저장
- [x] 새로고침 후 데이터 유지
- [x] 다른 기기 로그인 테스트


## PHASE 9 — 날씨

- [x] 샘플 날씨 데이터
- [x] 날씨 API 연결 구조
- [x] 외부온도 표시
- [x] 습도 표시
- [x] 날씨 조건별 미션


## PHASE 10 — 배포 준비

- [x] 환경변수 분리
- [x] .env.example
- [x] API Key 노출 검사
- [x] production build 확인
- [x] Git 저장소 정리
- [x] README 작성


## PHASE 11 — Render 배포

- [x] Render 서비스 생성
- [x] Git 저장소 연결
- [x] 환경변수 등록
- [x] Build 성공
- [x] 배포 성공
- [x] 배포 URL 접속
- [x] 회원가입 테스트
- [x] 로그인 테스트
- [x] 미션 테스트
- [x] 포인트 적립 테스트
- [x] Reward 구매 테스트


## FINAL CHECK

- [x] PROJECT.md 요구사항 누락 검사
- [x] 모바일 화면 검사
- [x] 정상 상태 Blue 확인
- [x] Warning/Error Red 확인
- [x] Supabase 보안 확인
- [x] 전체 기능 회귀 테스트
- [x] 최종 배포 확인


## DESIGN UPDATE — GREENON 마스코트

- [x] 사용자 원숭이 캐릭터를 참고한 GreenON 마스코트 제작
- [x] 청록 · 민트 · 노랑 중심 컬러 팔레트 적용
- [x] 홈 마스코트 히어로 UI 적용
- [x] 마우스 방향 3D 틸트 및 레이어 패럴랙스 모션
- [x] 터치 기기 및 모션 감소 설정 대응
- [x] 데스크톱 · 390px 모바일 브라우저 검사
- [x] 콘솔 오류 및 주요 화면 이동 회귀 검사


## REWARD UPDATE — 바로 구매

- [x] 상품 카드 바로 구매 버튼
- [x] 상세 모달 없이 즉시 주문 처리
- [x] 연속 클릭 중복 구매 방지
- [x] 포인트 부족 카드 Red 안내
- [x] 로그인 필요 사용자 인증 화면 안내
- [x] 구매 완료 후 포인트 · 구매내역 즉시 갱신
- [x] 리워드 화면 데스크톱 브라우저 검사


## AIRCON UPDATE — 미션 연동 리모컨

- [x] 실제 리모컨 형태의 LCD · 조작 버튼 UI
- [x] 전원 · 온도 · 운전 모드 · 바람 세기 조작
- [x] 사용자별 가상 에어컨 상태 Supabase 저장
- [x] 미션 추천 설정 원터치 적용
- [x] 전원 · 냉방 · 26°C · 기기 정상 조건 연동
- [x] 조건 위반 리모컨 · 미션 안내 Red UI
- [x] 리모컨 현재 설정으로 30분 미션 진행
- [x] 연동 성공 조건 목록 실시간 갱신
- [x] 데스크톱 · 모바일 브라우저 검사
- [x] RLS 및 에어컨 상태 열 UPDATE 권한 확인

> 보안 확인 메모: 사용자 데이터 RLS와 공개 키 구성을 검증했습니다. Supabase Security Advisor의 추가 권장사항으로 Auth의 Leaked Password Protection 활성화 경고 1건이 남아 있습니다.
