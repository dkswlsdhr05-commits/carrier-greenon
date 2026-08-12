// 화면 전환에 사용하는 페이지와 내비게이션 버튼을 한 번만 찾아 둡니다.
// 이후 단계에서 페이지가 늘어나도 data-page 속성만 맞추면 같은 방식으로 전환됩니다.
const pages = [...document.querySelectorAll('[data-page]')];
const navigationButtons = [...document.querySelectorAll('[data-nav-target]')];
const bottomNavigationItems = [...document.querySelectorAll('.nav-item')];

// 이전 개발 단계에서 사용한 임시 키입니다. 실제 DB 전환 후에는 데이터 저장에 사용하지 않습니다.
const MISSION_STORAGE_KEY = 'carrier-greenon-mission';
const AIRCON_STORAGE_KEY = 'carrier-greenon-aircon';
const WALLET_STORAGE_KEY = 'carrier-greenon-wallet';
const ORDER_STORAGE_KEY = 'carrier-greenon-orders';

const defaultMissionState = {
  status: 'ready',
  elapsedMinutes: 0,
  rewardClaimed: false,
};

const defaultAirconState = {
  power: true,
  mode: 'cool',
  temperature: 26,
  fan: 'auto',
  usageMinutes: 0,
  filterLevel: 82,
  error: 'none',
};

const defaultWalletState = {
  balance: 0,
  transactions: [],
};

const defaultOrderState = {
  orders: [],
};

// 상품은 아직 DB 연결 전이므로 읽기 전용 시뮬레이션 데이터로 관리합니다.
const defaultRewardProducts = [
  { id: 'food-drink', category: 'food', name: '저탄소 과일 음료', price: 80, icon: '🧃', description: '가볍게 즐기는 저탄소 인증 과일 음료 모바일 교환권이에요.' },
  { id: 'food-snack', category: 'food', name: '유기농 간식 세트', price: 140, icon: '🍪', description: '환경을 생각한 포장에 담긴 유기농 간식 세트예요.' },
  { id: 'life-towel', category: 'life', name: '친환경 주방 타월', price: 120, icon: '🧺', description: '재생 섬유로 만들어 오래 사용할 수 있는 주방 타월이에요.' },
  { id: 'life-tumbler', category: 'life', name: 'GreenON 텀블러', price: 220, icon: '🥤', description: '일회용 컵 사용을 줄여 주는 GreenON 전용 텀블러예요.' },
  { id: 'carrier-filter', category: 'carrier', name: '에어컨 필터 할인권', price: 300, icon: '❄️', description: '캐리어 에어컨 정품 필터 구매에 사용할 수 있는 할인권이에요.' },
  { id: 'carrier-care', category: 'carrier', name: 'Green Care 점검권', price: 500, icon: '🛠️', description: '쾌적한 냉방을 위한 캐리어 에어컨 가상 점검 리워드예요.' },
];

const categoryLabels = { food: 'FOOD', life: 'LIFE', carrier: 'CARRIER' };
const greenLevelInfo = {
  SEED: { label: 'SEED · 씨앗', icon: '🌰', minimum: 0, next: 100 },
  SPROUT: { label: 'SPROUT · 새싹', icon: '🌱', minimum: 100, next: 500 },
  TREE: { label: 'TREE · 나무', icon: '🌳', minimum: 500, next: 1000 },
  FOREST: { label: 'FOREST · 숲', icon: '🌲', minimum: 1000, next: null },
};

// 브라우저 공개용 URL과 publishable key만 사용합니다. 비밀키는 클라이언트에 두지 않습니다.
const supabaseConfig = window.GREENON_CONFIG || {};
const supabaseClient = window.supabase && supabaseConfig.SUPABASE_URL && supabaseConfig.SUPABASE_PUBLISHABLE_KEY
  ? window.supabase.createClient(
    supabaseConfig.SUPABASE_URL,
    supabaseConfig.SUPABASE_PUBLISHABLE_KEY,
  )
  : null;

const modeLabels = { cool: '냉방', dry: '제습', fan: '송풍' };
const fanLabels = { auto: '자동', low: '약풍', high: '강풍' };

let missionState = { ...defaultMissionState };
let airconState = { ...defaultAirconState };
let walletState = { ...defaultWalletState };
let orderState = { ...defaultOrderState };
let rewardProducts = [...defaultRewardProducts];
let historyFilter = 'all';
let rewardCategory = 'all';
let selectedProductId = null;
let toastTimer;
let authMode = 'login';
let currentUser = null;
let currentProfile = null;
let activeMissionDefinition = null;
let userMissionRecordId = null;
let authLoadVersion = 0;

/** 현재 미션과 에어컨 상태를 각각 브라우저에 임시 저장합니다. */
function clearLegacyLocalState() {
  [MISSION_STORAGE_KEY, AIRCON_STORAGE_KEY, WALLET_STORAGE_KEY, ORDER_STORAGE_KEY]
    .forEach((storageKey) => localStorage.removeItem(storageKey));
}

/** 짧은 성공 안내를 화면 위에 보여 주고 자동으로 닫습니다. */
function showToast(message) {
  const toast = document.querySelector('#app-toast');
  document.querySelector('#toast-message').textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

/** 홈 인사 영역의 날짜를 한국 시간 기준으로 표시합니다. */
function renderTodayDate() {
  const formattedDate = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());
  document.querySelector('.welcome-row .eyebrow').textContent = formattedDate;
}

/** WMO 날씨 코드를 사용자가 이해하기 쉬운 문구와 아이콘으로 바꿉니다. */
function getWeatherPresentation(weatherCode) {
  if (weatherCode === 0) return { label: '맑고 쾌청해요', icon: '☀️' };
  if (weatherCode <= 3) return { label: '구름이 조금 있어요', icon: '⛅' };
  if (weatherCode <= 48) return { label: '안개가 끼었어요', icon: '🌫️' };
  if (weatherCode <= 67 || (weatherCode >= 80 && weatherCode <= 82)) return { label: '비가 내리고 있어요', icon: '🌧️' };
  if (weatherCode <= 77) return { label: '눈이 내리고 있어요', icon: '🌨️' };
  if (weatherCode >= 95) return { label: '천둥번개가 쳐요', icon: '⛈️' };
  return { label: '날씨를 확인했어요', icon: '🌤️' };
}

/** 현재 날씨에 맞춰 동일한 26°C 미션의 안내 문구를 조금 더 알맞게 추천합니다. */
function applyWeatherMissionRecommendation(temperature, humidity) {
  let title = '26°C로 건강한 냉방하기';
  let description = '적정 온도를 유지하고 에너지 절약 습관을 만들어 보세요.';

  if (humidity >= 70) {
    title = '습한 날, 26°C 쾌적 냉방';
    description = '냉방 모드와 자동 바람으로 습한 날에도 에너지를 아껴 보세요.';
  } else if (temperature >= 30) {
    title = '폭염에도 26°C 건강 냉방';
    description = '더운 날일수록 적정 온도를 유지해 전력 사용을 줄여 보세요.';
  }

  document.querySelector('.mission-copy h3').textContent = title;
  document.querySelector('.mission-copy > p').textContent = description;
  document.querySelector('#mission-detail-title').textContent = title;
  document.querySelector('.mission-detail-hero > div:first-child > p').textContent = description;
}

/** Open-Meteo에서 서울의 현재 날씨를 읽고, 실패하면 샘플 데이터임을 분명히 표시합니다. */
async function loadWeather() {
  const weatherCard = document.querySelector('.weather-card');
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 6000);
  const endpoint = 'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code&timezone=Asia%2FSeoul';

  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    if (!response.ok) throw new Error(`Weather API ${response.status}`);
    const data = await response.json();
    const current = data.current;
    const presentation = getWeatherPresentation(current.weather_code);

    weatherCard.classList.remove('is-error');
    document.querySelector('#weather-location').textContent = '서울 · 현재 날씨';
    document.querySelector('#weather-title').textContent = presentation.label;
    document.querySelector('#weather-icon').textContent = presentation.icon;
    document.querySelector('#weather-temperature').textContent = Math.round(current.temperature_2m);
    document.querySelector('#weather-humidity').textContent = Math.round(current.relative_humidity_2m);
    document.querySelector('#weather-apparent').textContent = Math.round(current.apparent_temperature);
    document.querySelector('#weather-note').textContent = current.temperature_2m >= 30
      ? '무더운 날이에요. 26°C 친환경 냉방으로 전력 사용을 줄여 보세요.'
      : '26°C 친환경 냉방을 시작하기 좋은 날이에요.';
    applyWeatherMissionRecommendation(current.temperature_2m, current.relative_humidity_2m);
  } catch (error) {
    console.warn('현재 날씨를 불러오지 못해 샘플 데이터를 표시합니다.', error);
    weatherCard.classList.add('is-error');
    document.querySelector('#weather-location').textContent = '서울 · 샘플 날씨';
    document.querySelector('#weather-note').textContent = '현재 날씨 연결 오류로 샘플 데이터를 표시하고 있어요.';
  } finally {
    window.clearTimeout(timeoutId);
  }
}

/** 날짜와 시간을 포인트 내역에 읽기 쉬운 한국어 형식으로 표시합니다. */
function formatTransactionDate(dateValue) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateValue));
}

/** 지갑 잔액과 선택한 필터에 맞는 포인트 이용내역을 그립니다. */
function renderWallet() {
  const earned = walletState.transactions
    .filter((transaction) => transaction.type === 'earn')
    .reduce((total, transaction) => total + transaction.amount, 0);
  const spent = walletState.transactions
    .filter((transaction) => transaction.type === 'spend')
    .reduce((total, transaction) => total + Math.abs(transaction.amount), 0);

  document.querySelector('#home-point-balance').textContent = `${walletState.balance.toLocaleString('ko-KR')} P`;
  document.querySelector('.point-chip').setAttribute('aria-label', `현재 그린 포인트 ${walletState.balance} 포인트`);
  document.querySelector('#wallet-balance').textContent = walletState.balance.toLocaleString('ko-KR');
  document.querySelector('#wallet-total-earned').textContent = `${earned.toLocaleString('ko-KR')} P`;
  document.querySelector('#wallet-total-spent').textContent = `${spent.toLocaleString('ko-KR')} P`;
  document.querySelector('#shop-point-balance').textContent = `${walletState.balance.toLocaleString('ko-KR')} P`;

  document.querySelectorAll('[data-history-filter]').forEach((button) => {
    button.classList.toggle('is-selected', button.dataset.historyFilter === historyFilter);
  });

  const filteredTransactions = walletState.transactions.filter((transaction) => (
    historyFilter === 'all' || transaction.type === historyFilter
  ));
  const transactionList = document.querySelector('#transaction-list');

  if (filteredTransactions.length === 0) {
    transactionList.innerHTML = `
      <div class="empty-state">
        <span aria-hidden="true">🧾</span>
        <strong>아직 포인트 기록이 없어요</strong>
        <p>GREEN MISSION을 완료하면 첫 적립 기록이 생겨요.</p>
      </div>
    `;
    return;
  }

  transactionList.innerHTML = filteredTransactions.map((transaction) => `
    <article class="transaction-item ${transaction.type === 'spend' ? 'is-spend' : ''}">
      <span class="transaction-icon" aria-hidden="true">${transaction.type === 'earn' ? '＋' : '−'}</span>
      <div class="transaction-copy">
        <strong>${transaction.title}</strong>
        <span>${formatTransactionDate(transaction.createdAt)}</span>
      </div>
      <strong class="transaction-amount">${transaction.amount > 0 ? '+' : ''}${transaction.amount.toLocaleString('ko-KR')} P</strong>
    </article>
  `).join('');
}

/** 선택한 카테고리의 상품과 사용자의 최근 구매내역을 표시합니다. */
function renderRewards() {
  const visibleProducts = rewardProducts.filter((product) => (
    rewardCategory === 'all' || product.category === rewardCategory
  ));

  document.querySelectorAll('[data-reward-category]').forEach((button) => {
    button.classList.toggle('is-selected', button.dataset.rewardCategory === rewardCategory);
  });
  document.querySelector('#product-count').textContent = `${visibleProducts.length}개`;
  document.querySelector('#product-grid').innerHTML = visibleProducts.map((product) => `
    <button class="product-card" type="button" data-product-id="${product.id}" data-category="${product.category}" aria-label="${product.name} 상세 보기">
      <span class="product-visual" aria-hidden="true">${product.icon}</span>
      <span class="product-copy">
        <span class="product-category">${categoryLabels[product.category]}</span>
        <h3>${product.name}</h3>
        <strong>${product.price.toLocaleString('ko-KR')} P</strong>
      </span>
    </button>
  `).join('');

  document.querySelectorAll('[data-product-id]').forEach((button) => {
    button.addEventListener('click', () => openProductDialog(button.dataset.productId));
  });

  const orderList = document.querySelector('#order-list');
  if (orderState.orders.length === 0) {
    orderList.innerHTML = `
      <div class="empty-state">
        <span aria-hidden="true">🎁</span>
        <strong>아직 구매한 리워드가 없어요</strong>
        <p>미션 포인트로 첫 친환경 리워드를 만나 보세요.</p>
      </div>
    `;
    return;
  }

  orderList.innerHTML = orderState.orders.slice(0, 5).map((order) => `
    <article class="order-item">
      <span aria-hidden="true">${order.icon}</span>
      <div class="order-copy">
        <strong>${order.productName}</strong>
        <span>${formatTransactionDate(order.createdAt)} · 구매 완료</span>
      </div>
      <strong class="order-cost">-${order.price.toLocaleString('ko-KR')} P</strong>
    </article>
  `).join('');
}

/** 상품 카드를 눌렀을 때 상세 정보와 구매 버튼이 있는 모달을 엽니다. */
function openProductDialog(productId) {
  const product = rewardProducts.find((item) => item.id === productId);
  if (!product) return;

  selectedProductId = productId;
  const visual = document.querySelector('#dialog-product-visual');
  visual.textContent = product.icon;
  visual.dataset.category = product.category;
  document.querySelector('#dialog-product-category').textContent = categoryLabels[product.category];
  document.querySelector('#dialog-product-name').textContent = product.name;
  document.querySelector('#dialog-product-description').textContent = product.description;
  document.querySelector('#dialog-product-price').textContent = `${product.price.toLocaleString('ko-KR')} P`;
  document.querySelector('#purchase-message').hidden = true;
  document.querySelector('#product-dialog').showModal();
}

/** 보유 포인트를 확인한 뒤 상품 구매, 포인트 차감, 구매내역 생성을 한 번에 처리합니다. */
async function purchaseSelectedProduct() {
  const product = rewardProducts.find((item) => item.id === selectedProductId);
  if (!product) return;

  if (!requireSignedIn('리워드를 구매하려면 먼저 로그인해 주세요.')) {
    document.querySelector('#product-dialog').close();
    return;
  }

  const purchaseMessage = document.querySelector('#purchase-message');
  if (walletState.balance < product.price) {
    const shortage = product.price - walletState.balance;
    purchaseMessage.textContent = `포인트가 ${shortage.toLocaleString('ko-KR')} P 부족해요. 미션을 더 완료해 주세요.`;
    purchaseMessage.hidden = false;
    return;
  }

  const purchaseButton = document.querySelector('#purchase-button');
  purchaseButton.disabled = true;
  purchaseButton.textContent = '구매 처리 중...';

  const { error } = await supabaseClient.from('reward_orders').insert({
    user_id: currentUser.id,
    reward_id: product.id,
    // DB 트리거가 실제 상품 가격으로 덮어쓰므로 클라이언트 값을 신뢰하지 않습니다.
    price: product.price,
  });

  purchaseButton.disabled = false;
  purchaseButton.textContent = '포인트로 구매하기';

  if (error) {
    const isInsufficient = error.message.includes('insufficient_points');
    purchaseMessage.textContent = isInsufficient
      ? '포인트가 부족해요. 미션을 더 완료한 뒤 다시 시도해 주세요.'
      : '구매 처리 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.';
    purchaseMessage.hidden = false;
    return;
  }

  await refreshWalletAndOrders();
  document.querySelector('#product-dialog').close();
  showToast(`${product.name} 구매 완료! ${product.price.toLocaleString('ko-KR')} P를 사용했어요.`);
}

/** 로그인/회원가입 탭에 맞춰 입력 필드와 버튼 문구를 바꿉니다. */
function renderAuthMode() {
  const isSignup = authMode === 'signup';
  document.querySelectorAll('[data-auth-mode]').forEach((button) => {
    const isSelected = button.dataset.authMode === authMode;
    button.classList.toggle('is-selected', isSelected);
    button.setAttribute('aria-selected', String(isSelected));
  });
  document.querySelector('#display-name-field').hidden = !isSignup;
  document.querySelector('#auth-display-name').required = isSignup;
  document.querySelector('#auth-password').autocomplete = isSignup ? 'new-password' : 'current-password';
  document.querySelector('#auth-submit-button').textContent = isSignup ? '회원가입' : '로그인';
  document.querySelector('#auth-message').hidden = true;
}

/** 인증 결과나 오류를 Blue 또는 Red 안내 상자로 표시합니다. */
function showAuthMessage(message, isError = false) {
  const messageElement = document.querySelector('#auth-message');
  messageElement.textContent = message;
  messageElement.classList.toggle('is-error', isError);
  messageElement.hidden = false;
}

/** Supabase Auth 오류를 사용자가 이해하기 쉬운 문장으로 바꿉니다. */
function getFriendlyAuthError(error) {
  const message = error?.message || '';
  if (message.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않아요.';
  if (message.includes('Email not confirmed')) return '이메일 확인을 완료한 뒤 로그인해 주세요.';
  if (message.includes('already registered')) return '이미 가입된 이메일이에요. 로그인해 주세요.';
  if (message.includes('Password should be')) return '비밀번호는 8자 이상 입력해 주세요.';
  return message || '인증 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

/** 로그인하지 않은 사용자의 데이터 변경을 막고 인증 화면으로 안내합니다. */
function requireSignedIn(message) {
  if (currentUser && supabaseClient) return true;
  showPage('my');
  showAuthMessage(message, true);
  return false;
}

/** 한국 시간대의 오늘 날짜를 YYYY-MM-DD 형태로 만듭니다. */
function getTodayDateString() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const datePart = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${datePart.year}-${datePart.month}-${datePart.day}`;
}

/** DB 행을 화면에서 사용하는 가상 에어컨 상태 형태로 변환합니다. */
function mapAirconRow(row) {
  if (!row) return { ...defaultAirconState };
  return {
    power: row.power,
    mode: row.mode,
    temperature: Number(row.temperature),
    fan: row.fan,
    usageMinutes: row.usage_minutes,
    filterLevel: row.filter_level,
    error: row.error_code,
  };
}

/** 포인트 거래와 주문을 다시 읽어 지갑·숍·리포트를 함께 갱신합니다. */
async function refreshWalletAndOrders() {
  if (!supabaseClient || !currentUser) return;

  const [transactionResult, orderResult] = await Promise.all([
    supabaseClient
      .from('point_transactions')
      .select('id, type, amount, title, created_at')
      .order('created_at', { ascending: false }),
    supabaseClient
      .from('reward_orders')
      .select('id, price, status, created_at, rewards(name, icon, code)')
      .order('created_at', { ascending: false }),
  ]);

  if (transactionResult.error || orderResult.error) {
    showToast('포인트 또는 구매내역을 새로고침하지 못했어요.');
    return;
  }

  walletState.transactions = transactionResult.data.map((transaction) => ({
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    title: transaction.title,
    createdAt: transaction.created_at,
  }));
  walletState.balance = walletState.transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  orderState.orders = orderResult.data.map((order) => ({
    id: order.id,
    productName: order.rewards?.name || 'GreenON 리워드',
    icon: order.rewards?.icon || '🎁',
    price: order.price,
    status: order.status,
    createdAt: order.created_at,
  }));

  renderWallet();
  renderRewards();
  loadUserDashboard();
}

/** 로그인 직후 사용자에게 허용된 데이터만 RLS를 거쳐 불러옵니다. */
async function loadRemoteAppData(loadVersion = authLoadVersion, retryCount = 0) {
  if (!supabaseClient || !currentUser) return;
  const userId = currentUser.id;

  const [missionDefinitionResult, airconResult, rewardResult] = await Promise.all([
    supabaseClient.from('missions').select('*').eq('is_active', true).limit(1).maybeSingle(),
    supabaseClient.from('aircon_status').select('*').eq('user_id', userId).maybeSingle(),
    supabaseClient.from('rewards').select('*').eq('is_active', true).order('price'),
  ]);

  // 로그아웃 또는 다른 사용자 로그인 뒤에 끝난 이전 요청은 현재 화면에 반영하지 않습니다.
  if (loadVersion !== authLoadVersion || currentUser?.id !== userId) return;

  if (missionDefinitionResult.error || airconResult.error || rewardResult.error) {
    const errors = [missionDefinitionResult.error, airconResult.error, rewardResult.error].filter(Boolean);
    const sessionWasNotReady = errors.some((error) => error.status === 401);

    // 앱 시작과 빠른 로그인이 겹치면 첫 사용자 요청만 이전 인증 상태로 나갈 수 있어 한 번 재확인합니다.
    if (sessionWasNotReady && retryCount === 0) {
      const { data } = await supabaseClient.auth.getSession();
      if (data.session?.user.id === userId && loadVersion === authLoadVersion) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        return loadRemoteAppData(loadVersion, retryCount + 1);
      }
    }

    showToast('GreenON 데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    return;
  }

  activeMissionDefinition = missionDefinitionResult.data;
  airconState = mapAirconRow(airconResult.data);
  rewardProducts = rewardResult.data.map((product) => ({
    id: product.id,
    code: product.code,
    category: product.category,
    name: product.name,
    description: product.description,
    price: product.price,
    icon: product.icon,
  }));

  if (activeMissionDefinition) {
    const { data, error } = await supabaseClient
      .from('user_missions')
      .select('*')
      .eq('mission_id', activeMissionDefinition.id)
      .eq('mission_date', getTodayDateString())
      .maybeSingle();

    if (error) {
      showToast('오늘의 미션 기록을 불러오지 못했어요.');
      return;
    }

    if (loadVersion !== authLoadVersion || currentUser?.id !== userId) return;

    userMissionRecordId = data?.id || null;
    missionState = data
      ? {
        status: data.status,
        elapsedMinutes: data.progress_minutes,
        rewardClaimed: data.reward_claimed,
      }
      : { ...defaultMissionState };
  }

  clearLegacyLocalState();
  renderAirconState();
  renderRewards();
  await refreshWalletAndOrders();
}

/** 로그아웃 시 이전 사용자의 화면 데이터를 즉시 비웁니다. */
function resetAppData() {
  missionState = { ...defaultMissionState };
  airconState = { ...defaultAirconState };
  walletState = { balance: 0, transactions: [] };
  orderState = { orders: [] };
  rewardProducts = [...defaultRewardProducts];
  activeMissionDefinition = null;
  userMissionRecordId = null;
  renderAirconState();
  renderWallet();
  renderRewards();
}

/** 로그인 사용자의 프로필과 리포트 집계를 Supabase에서 읽습니다. */
async function loadUserDashboard() {
  if (!supabaseClient || !currentUser) return;

  const [profileResult, missionResult, transactionResult, orderResult, airconResult] = await Promise.all([
    supabaseClient.from('profiles').select('display_name, green_level, lifetime_points').eq('id', currentUser.id).maybeSingle(),
    supabaseClient.from('user_missions').select('id', { count: 'exact', head: true }).eq('status', 'success'),
    supabaseClient.from('point_transactions').select('amount').eq('type', 'earn'),
    supabaseClient.from('reward_orders').select('id', { count: 'exact', head: true }),
    supabaseClient.from('aircon_status').select('usage_minutes').eq('user_id', currentUser.id).maybeSingle(),
  ]);

  if (profileResult.error) {
    showAuthMessage('프로필을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.', true);
    return;
  }

  currentProfile = profileResult.data || {
    display_name: currentUser.user_metadata?.display_name || currentUser.email?.split('@')[0] || 'GreenON 사용자',
    green_level: 'SEED',
    lifetime_points: 0,
  };
  const totalEarned = (transactionResult.data || []).reduce((sum, transaction) => sum + transaction.amount, 0);
  renderProfile({
    completedMissions: missionResult.count || 0,
    totalEarned,
    orders: orderResult.count || 0,
    coolingMinutes: airconResult.data?.usage_minutes || 0,
  });
}

/** 로그인 여부에 따라 인증 폼 또는 MY 대시보드를 표시합니다. */
function renderAuthState() {
  const isSignedIn = Boolean(currentUser);
  document.querySelector('#auth-panel').hidden = isSignedIn;
  document.querySelector('#profile-panel').hidden = !isSignedIn;
  document.querySelector('.profile-button').setAttribute(
    'aria-label',
    isSignedIn ? '내 GreenON 프로필 열기' : '로그인 화면 열기',
  );
}

/** 프로필, GREEN LEVEL, GREEN REPORT 수치를 화면에 반영합니다. */
function renderProfile(report) {
  if (!currentUser || !currentProfile) return;

  const level = greenLevelInfo[currentProfile.green_level] || greenLevelInfo.SEED;
  const lifetimePoints = currentProfile.lifetime_points || 0;
  const progress = level.next
    ? Math.min(100, Math.round(((lifetimePoints - level.minimum) / (level.next - level.minimum)) * 100))
    : 100;

  document.querySelector('#profile-display-name').textContent = currentProfile.display_name;
  document.querySelector('#profile-email').textContent = currentUser.email || '';
  document.querySelector('#level-icon').textContent = level.icon;
  document.querySelector('#green-level-name').textContent = level.label;
  document.querySelector('#level-progress-bar').style.width = `${progress}%`;
  document.querySelector('.level-progress').setAttribute('aria-valuenow', String(progress));
  document.querySelector('#level-progress-text').textContent = level.next
    ? `다음 레벨까지 ${(level.next - lifetimePoints).toLocaleString('ko-KR')} P 남았어요.`
    : '최고 레벨에 도착했어요. 멋진 친환경 습관을 이어가세요!';
  document.querySelector('#report-missions').textContent = `${report.completedMissions}회`;
  document.querySelector('#report-earned').textContent = `${report.totalEarned.toLocaleString('ko-KR')} P`;
  document.querySelector('#report-orders').textContent = `${report.orders}개`;
  document.querySelector('#report-cooling').textContent = `${report.coolingMinutes.toLocaleString('ko-KR')}분`;
}

/** 폼의 현재 탭에 따라 Supabase 회원가입 또는 로그인을 실행합니다. */
async function handleAuthSubmit(event) {
  event.preventDefault();
  if (!supabaseClient) {
    showAuthMessage('Supabase 연결 설정을 불러오지 못했어요.', true);
    return;
  }

  const email = document.querySelector('#auth-email').value.trim();
  const password = document.querySelector('#auth-password').value;
  const displayName = document.querySelector('#auth-display-name').value.trim();
  const submitButton = document.querySelector('#auth-submit-button');
  submitButton.disabled = true;
  submitButton.textContent = authMode === 'signup' ? '가입 중...' : '로그인 중...';

  try {
    if (authMode === 'signup') {
      const redirectOptions = location.protocol.startsWith('http')
        ? { emailRedirectTo: `${location.origin}${location.pathname}#my` }
        : {};
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          ...redirectOptions,
        },
      });
      if (error) throw error;

      if (!data.session) {
        showAuthMessage('가입 확인 메일을 보냈어요. 이메일 확인 후 로그인해 주세요.');
        authMode = 'login';
        renderAuthMode();
        showAuthMessage('가입 확인 메일을 보냈어요. 이메일 확인 후 로그인해 주세요.');
      }
    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      document.querySelector('#auth-form').reset();
      showToast('로그인했어요. GreenON 기록을 불러왔습니다.');
    }
  } catch (error) {
    showAuthMessage(getFriendlyAuthError(error), true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = authMode === 'signup' ? '회원가입' : '로그인';
  }
}

/** 세션이 바뀔 때 사용자 화면과 DB 데이터를 함께 갱신합니다. */
function handleAuthSession(session) {
  const previousUserId = currentUser?.id || null;
  authLoadVersion += 1;
  const loadVersion = authLoadVersion;
  currentUser = session?.user || null;
  currentProfile = null;
  renderAuthState();
  if (currentUser) {
    // 인증 콜백이 끝난 다음 최신 세션으로 DB 요청을 시작해 초기화 경합을 피합니다.
    setTimeout(() => {
      if (loadVersion === authLoadVersion) loadRemoteAppData(loadVersion);
    }, 0);
  } else if (previousUserId) {
    resetAppData();
  }
}

/**
 * 선택한 메뉴에 맞는 화면을 보여 줍니다.
 * @param {string} targetPage 보여 줄 화면 이름
 * @param {boolean} updateHash 주소의 해시도 함께 바꿀지 여부
 */
function showPage(targetPage, updateHash = true) {
  const pageExists = pages.some((page) => page.dataset.page === targetPage);
  const safeTarget = pageExists ? targetPage : 'home';
  // 에어컨 상세 화면은 홈의 하위 화면이므로 하단 내비게이션에서는 홈을 활성화합니다.
  const navigationTarget = safeTarget === 'aircon' ? 'home' : safeTarget;

  pages.forEach((page) => {
    const isTarget = page.dataset.page === safeTarget;
    page.hidden = !isTarget;
    page.classList.toggle('is-active', isTarget);
  });

  bottomNavigationItems.forEach((button) => {
    const isActive = button.dataset.navTarget === navigationTarget;
    button.classList.toggle('is-active', isActive);

    if (isActive) {
      button.setAttribute('aria-current', 'page');
    } else {
      button.removeAttribute('aria-current');
    }
  });

  if (updateHash) {
    history.replaceState(null, '', `#${safeTarget}`);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** 조건 목록 한 줄을 성공 또는 위반 상태로 표시합니다. */
function renderCondition(elementId, isMet, showViolation) {
  const element = document.querySelector(elementId);
  element.classList.toggle('is-met', isMet);
  element.classList.toggle('is-violated', showViolation && !isMet);
  element.querySelector('.condition-check').textContent = isMet ? '✓' : element.dataset.step || '';
}

/** 현재 미션 참여 상태를 상세 화면과 홈 카드에 함께 표시합니다. */
function renderMissionState() {
  const progress = Math.min(100, Math.round((missionState.elapsedMinutes / 60) * 100));
  const statusMap = {
    ready: '참여 전',
    active: '진행 중',
    success: '미션 성공',
    failed: '미션 실패',
  };
  const statusText = statusMap[missionState.status] || statusMap.ready;
  const powerMet = airconState.power;
  const temperatureMet = airconState.temperature >= 26;
  const durationMet = missionState.elapsedMinutes >= 60;
  const deviceHealthy = airconState.error === 'none';
  const hasConditionWarning = missionState.status === 'active'
    && (!powerMet || !temperatureMet || airconState.mode !== 'cool' || !deviceHealthy);

  const statusElement = document.querySelector('#mission-status-text');
  const progressText = document.querySelector('#mission-progress-text');
  const progressBar = document.querySelector('#mission-progress-bar');
  const progressTrack = document.querySelector('#mission-progress');
  const progressPanel = document.querySelector('.mission-progress-panel');
  const progressDescription = document.querySelector('#mission-progress-description');
  const startButton = document.querySelector('#mission-start-button');
  const homeMissionStatus = document.querySelector('.mission-meta span:last-child');
  const infoMessage = document.querySelector('#mission-info-message');

  statusElement.textContent = statusText;
  progressText.textContent = `${progress}%`;
  progressBar.style.width = `${progress}%`;
  progressTrack.setAttribute('aria-valuenow', String(progress));
  progressPanel.classList.toggle('is-success', missionState.status === 'success');
  progressPanel.classList.toggle('is-error', missionState.status === 'failed');

  if (missionState.status === 'success') {
    progressDescription.textContent = '60분 동안 친환경 냉방 조건을 지켰어요!';
  } else if (missionState.status === 'failed') {
    progressDescription.textContent = '조건을 지키지 못해 기록이 중단됐어요. 다시 도전해 보세요.';
  } else if (missionState.status === 'active') {
    progressDescription.textContent = `${missionState.elapsedMinutes}분 진행했어요. 친환경 냉방을 계속 유지해 주세요.`;
  } else {
    progressDescription.textContent = '미션에 참여하면 진행 시간이 기록돼요.';
  }

  startButton.disabled = missionState.status === 'active' || missionState.status === 'success';
  if (missionState.status === 'active') {
    startButton.innerHTML = '미션 진행 중 <span aria-hidden="true">✓</span>';
  } else if (missionState.status === 'success') {
    startButton.innerHTML = '오늘의 미션 완료 <span aria-hidden="true">✓</span>';
  } else if (missionState.status === 'failed') {
    startButton.innerHTML = '다시 참여하기 <span aria-hidden="true">↻</span>';
  } else {
    startButton.innerHTML = '미션 참여하기 <span aria-hidden="true">→</span>';
  }
  homeMissionStatus.textContent = statusText;

  document.querySelector('#condition-power').dataset.step = '1';
  document.querySelector('#condition-temperature').dataset.step = '2';
  document.querySelector('#condition-duration').dataset.step = '3';
  const showViolation = missionState.status === 'active' || missionState.status === 'failed';
  renderCondition('#condition-power', powerMet, showViolation);
  renderCondition('#condition-temperature', temperatureMet, showViolation);
  renderCondition('#condition-duration', durationMet, false);

  infoMessage.classList.toggle('is-warning', hasConditionWarning || missionState.status === 'failed');
  if (missionState.status === 'success') {
    infoMessage.innerHTML = '<span aria-hidden="true">✓</span><p>미션 성공! GREEN POINT 100 P가 지갑에 적립됐어요.</p>';
  } else if (missionState.status === 'failed') {
    infoMessage.innerHTML = '<span aria-hidden="true">!</span><p>미션 조건 위반으로 실패했어요. 에어컨 설정을 확인한 뒤 다시 참여해 주세요.</p>';
  } else if (hasConditionWarning) {
    infoMessage.innerHTML = '<span aria-hidden="true">!</span><p>현재 미션 조건을 위반하고 있어요. +30분 전에 전원·냉방 모드·26°C·기기 상태를 확인해 주세요.</p>';
  } else {
    infoMessage.innerHTML = '<span aria-hidden="true">i</span><p>가상 에어컨 패널에서 현재 설정을 확인하고 시간을 진행할 수 있어요.</p>';
  }
}

/** 가상 에어컨 상태를 홈 요약 카드와 상세 패널에 동시에 반영합니다. */
function renderAirconState() {
  const hasError = airconState.error !== 'none';
  const isFilterWarning = airconState.error === 'filter';
  const isSensorError = airconState.error === 'sensor';
  const statusText = isSensorError ? '센서 오류' : isFilterWarning ? '필터 점검' : airconState.power ? '정상' : '대기';
  const operationText = airconState.power
    ? `${modeLabels[airconState.mode]} 운전 중`
    : '전원 꺼짐';
  const filterValue = isFilterWarning ? 12 : airconState.filterLevel;

  const homeCard = document.querySelector('#home-aircon-card');
  homeCard.classList.toggle('has-alert', hasError);
  document.querySelector('#home-aircon-status').textContent = statusText;
  document.querySelector('#home-aircon-temperature').textContent = `${airconState.temperature}°`;
  document.querySelector('#home-aircon-power').textContent = operationText;
  document.querySelector('#home-aircon-setting').textContent = `설정 ${airconState.temperature}°C`;
  document.querySelector('#home-aircon-fan').textContent = `바람 ${fanLabels[airconState.fan]}`;

  const deviceCard = document.querySelector('#device-card');
  const deviceMessage = document.querySelector('#device-message');
  deviceCard.classList.toggle('is-error', hasError);
  document.querySelector('#device-status-badge').textContent = statusText;
  document.querySelector('#device-temperature').textContent = airconState.temperature;
  document.querySelector('#device-operation-text').textContent = operationText;
  document.querySelector('#device-power-value').textContent = airconState.power ? 'ON' : 'OFF';
  document.querySelector('#device-mode-value').textContent = modeLabels[airconState.mode];
  document.querySelector('#device-fan-value').textContent = fanLabels[airconState.fan];
  document.querySelector('#device-usage-value').textContent = `${airconState.usageMinutes}분`;
  document.querySelector('#device-filter-value').textContent = `${filterValue}%`;
  document.querySelector('#device-connection-value').textContent = isSensorError ? '오류' : '정상';
  document.querySelector('#control-temperature').textContent = airconState.temperature;

  const powerButton = document.querySelector('#power-button');
  powerButton.classList.toggle('is-on', airconState.power);
  powerButton.setAttribute('aria-pressed', String(airconState.power));
  powerButton.innerHTML = `<span aria-hidden="true">⏻</span> ${airconState.power ? 'ON' : 'OFF'}`;

  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.classList.toggle('is-selected', button.dataset.mode === airconState.mode);
    button.disabled = !airconState.power;
  });
  document.querySelectorAll('[data-fan]').forEach((button) => {
    button.classList.toggle('is-selected', button.dataset.fan === airconState.fan);
    button.disabled = !airconState.power;
  });
  document.querySelector('#temperature-down').disabled = !airconState.power;
  document.querySelector('#temperature-up').disabled = !airconState.power;
  document.querySelectorAll('[data-error]').forEach((button) => {
    button.classList.toggle('is-selected', button.dataset.error === airconState.error);
  });

  deviceMessage.classList.toggle('is-error', hasError);
  if (isSensorError) {
    deviceMessage.innerHTML = '<span aria-hidden="true">!</span><p><strong>온도 센서 오류가 감지됐어요.</strong><br />미션을 진행하기 전에 기기 상태를 정상으로 바꿔 주세요.</p>';
  } else if (isFilterWarning) {
    deviceMessage.innerHTML = '<span aria-hidden="true">!</span><p><strong>필터 점검이 필요해요.</strong><br />필터 상태가 20% 미만이어서 냉방 효율이 낮아졌습니다.</p>';
  } else if (!airconState.power) {
    deviceMessage.innerHTML = '<span aria-hidden="true">i</span><p><strong>에어컨 전원이 꺼져 있어요.</strong><br />미션을 진행하려면 POWER를 켜 주세요.</p>';
  } else {
    deviceMessage.innerHTML = '<span aria-hidden="true">✓</span><p><strong>에어컨이 정상이에요.</strong><br />친환경 미션을 시작할 수 있습니다.</p>';
  }

  renderMissionState();
}

/** 참여 전 또는 실패 상태에서 오늘의 미션 기록을 Supabase에 생성하거나 다시 시작합니다. */
async function startMission() {
  if (!['ready', 'failed'].includes(missionState.status)) return;
  if (!requireSignedIn('GREEN MISSION에 참여하려면 먼저 로그인해 주세요.')) return;
  if (!activeMissionDefinition) {
    showToast('오늘의 미션 정보를 불러오는 중이에요. 잠시 후 다시 시도해 주세요.');
    return;
  }

  let result;
  if (userMissionRecordId) {
    result = await supabaseClient
      .from('user_missions')
      .update({ status: 'active', progress_minutes: 0 })
      .eq('id', userMissionRecordId)
      .select()
      .single();
  } else {
    result = await supabaseClient
      .from('user_missions')
      .insert({
        user_id: currentUser.id,
        mission_id: activeMissionDefinition.id,
        mission_date: getTodayDateString(),
        status: 'active',
        progress_minutes: 0,
      })
      .select()
      .single();
  }

  if (result.error) {
    showToast('미션을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
    return;
  }

  userMissionRecordId = result.data.id;
  missionState = { status: 'active', elapsedMinutes: 0, rewardClaimed: false };
  renderMissionState();
  showToast('오늘의 GREEN MISSION을 시작했어요!');
}

/** 현재 에어컨 설정이 미션의 친환경 조건을 만족하는지 확인합니다. */
function isMissionConditionMet() {
  return airconState.power
    && airconState.mode === 'cool'
    && airconState.temperature >= 26
    && airconState.error === 'none';
}

/** 변경된 가상 에어컨 값을 사용자 전용 DB 행에 저장합니다. */
async function updateAirconState(changes) {
  if (!requireSignedIn('가상 에어컨을 조작하려면 먼저 로그인해 주세요.')) return false;

  const previousState = { ...airconState };
  airconState = { ...airconState, ...changes };
  renderAirconState();

  const { error } = await supabaseClient
    .from('aircon_status')
    .update({
      power: airconState.power,
      mode: airconState.mode,
      temperature: airconState.temperature,
      fan: airconState.fan,
      usage_minutes: airconState.usageMinutes,
      filter_level: airconState.filterLevel,
      error_code: airconState.error,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', currentUser.id);

  if (error) {
    airconState = previousState;
    renderAirconState();
    showToast('에어컨 상태를 저장하지 못했어요. 다시 시도해 주세요.');
    return false;
  }
  return true;
}

/** 현재 설정으로 30분이 흐른 상황을 만들고 DB에서 미션 보상까지 판정합니다. */
async function advanceSimulationTime() {
  if (!requireSignedIn('시간 시뮬레이션을 사용하려면 먼저 로그인해 주세요.')) return;
  const advanceButton = document.querySelector('#advance-time-button');
  advanceButton.disabled = true;

  const nextAirconState = { ...airconState };
  const nextMissionState = { ...missionState };

  if (nextAirconState.power) {
    nextAirconState.usageMinutes += 30;
    if (nextAirconState.error !== 'filter') {
      nextAirconState.filterLevel = Math.max(0, nextAirconState.filterLevel - 1);
    }
  }

  if (nextMissionState.status === 'active') {
    if (isMissionConditionMet()) {
      nextMissionState.elapsedMinutes = Math.min(60, nextMissionState.elapsedMinutes + 30);
      if (nextMissionState.elapsedMinutes >= 60) {
        nextMissionState.status = 'success';
      }
    } else {
      nextMissionState.status = 'failed';
    }
  }

  const airconSaved = await updateAirconState(nextAirconState);
  if (!airconSaved) {
    advanceButton.disabled = false;
    return;
  }

  if (missionState.status === 'active' && userMissionRecordId) {
    const { data, error } = await supabaseClient
      .from('user_missions')
      .update({
        status: nextMissionState.status,
        progress_minutes: nextMissionState.elapsedMinutes,
      })
      .eq('id', userMissionRecordId)
      .select()
      .single();

    if (error) {
      showToast('미션 진행 상태를 저장하지 못했어요. 데이터를 다시 불러옵니다.');
      await loadRemoteAppData();
      advanceButton.disabled = false;
      return;
    }

    missionState = {
      status: data.status,
      elapsedMinutes: data.progress_minutes,
      rewardClaimed: data.reward_claimed,
    };
  }

  renderAirconState();
  if (missionState.status === 'success') {
    await refreshWalletAndOrders();
    showToast('미션 성공! GREEN POINT 100 P가 적립됐어요.');
  }
  advanceButton.disabled = false;
}

// 마우스가 히어로 영역 안에서 움직이면 캐릭터와 장식이 깊이에 따라 다르게 이동합니다.
// 터치 기기와 모션 감소 설정에서는 이 효과를 사용하지 않아 조작과 접근성을 방해하지 않습니다.
function setupHeroMouseMotion() {
  const hero = document.querySelector('#greenon-hero');
  if (!hero) return;

  const canUsePointerMotion = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!canUsePointerMotion || prefersReducedMotion) return;

  const layers = [...hero.querySelectorAll('[data-motion-depth]')];
  let animationFrameId = null;
  let nextX = 0;
  let nextY = 0;

  const paintMotion = () => {
    hero.style.setProperty('--hero-rotate-x', `${(-nextY * 2.1).toFixed(2)}deg`);
    hero.style.setProperty('--hero-rotate-y', `${(nextX * 2.8).toFixed(2)}deg`);

    layers.forEach((layer) => {
      const depth = Number(layer.dataset.motionDepth || 0);
      layer.style.setProperty('--layer-x', `${(nextX * 18 * depth).toFixed(2)}px`);
      layer.style.setProperty('--layer-y', `${(nextY * 14 * depth).toFixed(2)}px`);
    });

    animationFrameId = null;
  };

  const requestMotionPaint = () => {
    if (animationFrameId !== null) return;
    animationFrameId = window.requestAnimationFrame(paintMotion);
  };

  hero.addEventListener('pointerenter', () => hero.classList.add('is-pointer-active'));
  hero.addEventListener('pointermove', (event) => {
    const bounds = hero.getBoundingClientRect();
    nextX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    nextY = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
    requestMotionPaint();
  });
  hero.addEventListener('pointerleave', () => {
    hero.classList.remove('is-pointer-active');
    nextX = 0;
    nextY = 0;
    requestMotionPaint();
  });
}

// 하단 메뉴와 카드 안의 이동 버튼은 모두 같은 화면 전환 함수를 사용합니다.
navigationButtons.forEach((button) => {
  button.addEventListener('click', () => showPage(button.dataset.navTarget));
});

document.querySelector('#mission-start-button').addEventListener('click', startMission);
document.querySelector('#power-button').addEventListener('click', () => updateAirconState({ power: !airconState.power }));
document.querySelector('#temperature-down').addEventListener('click', () => updateAirconState({
  temperature: Math.max(18, airconState.temperature - 1),
}));
document.querySelector('#temperature-up').addEventListener('click', () => updateAirconState({
  temperature: Math.min(30, airconState.temperature + 1),
}));
document.querySelectorAll('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => updateAirconState({ mode: button.dataset.mode }));
});
document.querySelectorAll('[data-fan]').forEach((button) => {
  button.addEventListener('click', () => updateAirconState({ fan: button.dataset.fan }));
});
document.querySelectorAll('[data-error]').forEach((button) => {
  button.addEventListener('click', () => {
    const nextError = button.dataset.error;
    let nextFilterLevel = airconState.filterLevel;
    if (nextError === 'filter') nextFilterLevel = 12;
    if (nextError === 'none' && nextFilterLevel < 20) nextFilterLevel = 82;
    updateAirconState({ error: nextError, filterLevel: nextFilterLevel });
  });
});
document.querySelector('#advance-time-button').addEventListener('click', advanceSimulationTime);
document.querySelectorAll('[data-history-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    historyFilter = button.dataset.historyFilter;
    renderWallet();
  });
});
document.querySelectorAll('[data-reward-category]').forEach((button) => {
  button.addEventListener('click', () => {
    rewardCategory = button.dataset.rewardCategory;
    renderRewards();
  });
});
document.querySelector('#dialog-close').addEventListener('click', () => {
  document.querySelector('#product-dialog').close();
});
document.querySelector('#product-dialog').addEventListener('click', (event) => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});
document.querySelector('#purchase-button').addEventListener('click', purchaseSelectedProduct);
document.querySelectorAll('[data-auth-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    authMode = button.dataset.authMode;
    renderAuthMode();
  });
});
document.querySelector('#auth-form').addEventListener('submit', handleAuthSubmit);
document.querySelector('#logout-button').addEventListener('click', async () => {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    showToast('로그아웃 중 문제가 발생했어요. 다시 시도해 주세요.');
    return;
  }
  showToast('안전하게 로그아웃했어요.');
});

// 새로고침했을 때 #mission 같은 주소가 있다면 해당 화면을 다시 보여 줍니다.
const initialPage = window.location.hash.replace('#', '') || 'home';
clearLegacyLocalState();
renderTodayDate();
showPage(initialPage, false);
renderAirconState();
renderWallet();
renderRewards();
renderAuthMode();
renderAuthState();
setupHeroMouseMotion();
loadWeather();

if (supabaseClient) {
  // 현재 세션을 먼저 읽고, 이후 로그인/로그아웃 이벤트도 계속 반영합니다.
  supabaseClient.auth.getSession().then(({ data }) => handleAuthSession(data.session));
  supabaseClient.auth.onAuthStateChange((_event, session) => handleAuthSession(session));
}
