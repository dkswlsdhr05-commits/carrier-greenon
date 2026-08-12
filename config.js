// 파일을 직접 열었을 때 사용하는 안전한 기본값입니다.
// Render에서는 server.js가 환경변수로 이 경로의 응답을 동적으로 생성합니다.
window.GREENON_CONFIG = window.GREENON_CONFIG || {
  SUPABASE_URL: '',
  SUPABASE_PUBLISHABLE_KEY: '',
};
