const cdpPort = process.env.CDP_PORT || '9222';
const baseUrl = process.env.GREENON_E2E_URL;
const email = process.env.GREENON_E2E_EMAIL;
const password = process.env.GREENON_E2E_PASSWORD;

if (!baseUrl || !email || !password) {
  throw new Error('GREENON_E2E_URL, GREENON_E2E_EMAIL, GREENON_E2E_PASSWORD가 필요합니다.');
}

/** Chrome 원격 디버깅이 준비될 때까지 짧게 재시도합니다. */
async function waitForChrome() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
      if (response.ok) return response.json();
    } catch {
      // Chrome 시작 직후의 연결 실패는 다음 시도에서 다시 확인합니다.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Chrome 원격 디버깅에 연결하지 못했습니다.');
}

const pages = await waitForChrome();
const page = pages.find((item) => item.type === 'page');
if (!page) throw new Error('검사할 Chrome 페이지가 없습니다.');

const socket = new WebSocket(page.webSocketDebuggerUrl);
const pendingCommands = new Map();
const browserErrors = [];
let commandId = 0;

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pendingCommands.has(message.id)) {
    const { resolve, reject } = pendingCommands.get(message.id);
    pendingCommands.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
    return;
  }

  if (message.method === 'Runtime.exceptionThrown') {
    browserErrors.push(message.params.exceptionDetails.text || '알 수 없는 JavaScript 오류');
  }
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
    browserErrors.push(message.params.entry.text);
  }
});

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

/** Chrome DevTools Protocol 명령 하나를 실행합니다. */
function send(method, params = {}) {
  commandId += 1;
  return new Promise((resolve, reject) => {
    pendingCommands.set(commandId, { resolve, reject });
    socket.send(JSON.stringify({ id: commandId, method, params }));
  });
}

/** 페이지 안에서 JavaScript를 실행하고 실제 반환값을 읽습니다. */
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

/** Supabase 요청까지 끝날 시간을 주면서 조건을 기다립니다. */
async function waitFor(expression, label, timeout = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${label} 확인 시간이 초과됐습니다.`);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');

// Render 신규 도메인 전파 중 일시적인 404가 있을 수 있어 실제 앱이 뜰 때까지 새로 엽니다.
for (let attempt = 0; attempt < 12; attempt += 1) {
  await send('Page.navigate', { url: `${baseUrl}/#my` });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const title = await evaluate('document.title');
  const hasApp = await evaluate("document.querySelector('#auth-form') !== null");
  if (title === 'Carrier GreenON' && hasApp) break;
  if (attempt === 11) throw new Error('배포된 앱 화면을 불러오지 못했습니다.');
}

await waitFor("document.querySelector('#auth-form') !== null", '인증 폼');

// 실제 로그인 폼을 제출해 Supabase 세션과 사용자별 데이터를 불러옵니다.
await evaluate(`(() => {
  document.querySelector('[data-auth-mode="login"]').click();
  const emailInput = document.querySelector('#auth-email');
  const passwordInput = document.querySelector('#auth-password');
  emailInput.value = ${JSON.stringify(email)};
  passwordInput.value = ${JSON.stringify(password)};
  emailInput.dispatchEvent(new Event('input', { bubbles: true }));
  passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#auth-form').requestSubmit();
  return true;
})()`);

await waitFor("document.querySelector('#auth-panel').hidden === true", '로그인 완료');
await waitFor("document.querySelector('#wallet-balance').textContent.trim() === '20'", '지갑 데이터');

// 같은 브라우저에서 새로고침해도 세션과 Supabase 데이터가 다시 복원되는지 확인합니다.
await send('Page.reload', { ignoreCache: true });
await waitFor("document.querySelector('#auth-panel') !== null", '새로고침 화면');
await waitFor("document.querySelector('#auth-panel').hidden === true", '새로고침 후 세션');
await waitFor("document.querySelector('#wallet-balance').textContent.trim() === '20'", '새로고침 후 지갑 데이터');

// 실제 하단 메뉴 이동과 Supabase 구매내역 렌더링을 검사합니다.
await evaluate("document.querySelector('[data-nav-target=\"reward\"]').click()");
await waitFor("document.querySelector('#order-list').innerText.includes('구매 완료')", '구매내역');

// 가상 센서 오류를 선택했을 때 Red 오류 클래스가 적용되는지 검사합니다.
await evaluate("document.querySelector('[data-nav-target=\"home\"]').click(); document.querySelector('[data-error=\"sensor\"]').click(); true");
await waitFor("document.querySelector('#device-card').classList.contains('is-error')", 'Red 오류 UI');

const result = await evaluate(`({
  title: document.title,
  bodyLength: document.body.innerText.trim().length,
  walletBalance: document.querySelector('#wallet-balance').textContent.trim(),
  errorUi: document.querySelector('#device-card').classList.contains('is-error'),
  errorColor: getComputedStyle(document.querySelector('#device-status-badge')).color,
  mobileNavVisible: getComputedStyle(document.querySelector('.bottom-nav')).display !== 'none',
  cssApplied: getComputedStyle(document.body).fontFamily.length > 0,
})`);

// 마지막으로 로그아웃 버튼을 눌러 세션이 정리되는지 확인합니다.
await evaluate("document.querySelector('[data-nav-target=\"my\"]').click(); document.querySelector('#logout-button').click(); true");
await waitFor("document.querySelector('#auth-panel').hidden === false", '로그아웃 완료');

socket.close();

if (result.errorColor !== 'rgb(201, 45, 63)') {
  throw new Error(`오류 상태 색상이 Red 규칙과 다릅니다: ${result.errorColor}`);
}

console.log(JSON.stringify({
  ...result,
  login: true,
  refreshPersistence: true,
  rewardHistory: true,
  logout: true,
  browserErrors,
}));
