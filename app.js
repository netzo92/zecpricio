// ZEC App - Price + Shielded Supply Charts

// ============================================================================
// Configuration
// ============================================================================

// Binance WebSocket for real-time price
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/zecusdt@trade';

// CoinGecko via Netlify function (hides API key)
// CoinMarketCap via Netlify function
// CoinGecko Public API
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3/coins/markets';

// CMC Proxy
const CMC_PROXY = '/api/cmc';
const CMC_QUOTES_URL = `${CMC_PROXY}?endpoint=cryptocurrency/quotes/latest&symbol=ZEC`;

const POND_API_URL = '/api/pond-markets';

// CoinGecko via Netlify function (still used for charts)
const COINGECKO_PROXY = '/api/coingecko';
const COINGECKO_CHART_1Y_URL = `${COINGECKO_PROXY}?endpoint=coins/zcash/market_chart&vs_currency=usd&days=365`;
const COINGECKO_CHART_1MO_URL = `${COINGECKO_PROXY}?endpoint=coins/zcash/market_chart&vs_currency=usd&days=30`;
const COINGECKO_CHART_1D_URL = `${COINGECKO_PROXY}?endpoint=coins/zcash/market_chart&vs_currency=usd&days=1`;
const COINGECKO_CHART_1H_URL = `${COINGECKO_PROXY}?endpoint=coins/zcash/market_chart&vs_currency=usd&days=0.0417`; // ~1 hour

// Shielded pool data
const SHIELDED_DATA_URL = 'shielded-pool-data.json';
const SHIELDED_HOURLY_URL = '/api/shielded-hourly';
const ZCASH_RPC_PROXY = '/api/zcash-rpc';  // Netlify function

// ============================================================================
// DOM Elements
// ============================================================================

const splash = document.getElementById('splash');
const container = document.getElementById('container');
const viewToggle = document.getElementById('view-toggle');
const toggleText = viewToggle.querySelector('.toggle-text');

// Headlines
const headlinePrice = document.getElementById('headline-price');
const headlineShielded = document.getElementById('headline-shielded');
const shieldedValueEl = document.getElementById('shielded-value');
const shieldedPercentEl = document.getElementById('shielded-percent');

// Charts
const chartPrice = document.getElementById('chart-price');
const chartShielded = document.getElementById('chart-shielded');
const priceChartCanvas = document.getElementById('price-chart');
const shieldedChartCanvas = document.getElementById('shielded-chart');

const priceEl = document.getElementById('price');
const priceChangeBtn = document.getElementById('price-change-btn');
const shieldedChangeBtn = document.getElementById('shielded-change-btn');
const liveIndicator = document.getElementById('live-indicator');
const pollProgressBar = document.getElementById('poll-progress-bar');

// Stats Elements
const statHighEl = document.getElementById('stat-high');
const statLowEl = document.getElementById('stat-low');
const statVolEl = document.getElementById('stat-vol');

// Currency Elements
const currencyToggleBtn = document.getElementById('currency-toggle');
const currencySymbolEl = document.getElementById('currency-symbol');

// Mode Tabs
const dashboardTab = document.getElementById('tab-dashboard');
const predictTab = document.getElementById('tab-predict');
const dashboardView = document.getElementById('dashboard-view');
const predictView = document.getElementById('predict-view');

// Predict UI Elements
const walletBalanceEl = document.getElementById('wallet-balance');
const roundEntryPriceEl = document.getElementById('round-entry-price');
const roundLastPriceEl = document.getElementById('round-last-price');
const roundPoolEl = document.getElementById('round-pool');
const betUpBtn = document.getElementById('bet-up');
const betDownBtn = document.getElementById('bet-down');
const timerMEl = document.getElementById('timer-m');
const timerSEl = document.getElementById('timer-s');
const predictHistoryEl = document.getElementById('predict-history');

// ============================================================================
// State
// ============================================================================

let currentView = 'price'; // 'price' or 'shielded'
let isReady = false;

// Shielded data
let shieldedData = null;
let shieldedDataFull = null; // Full historical data for filtering
let shieldedChart = null;
let circulatingSupply = null;
let shieldedChartTimeframe = 'all'; // 'all', '1y', '1mo', '1d'
const SHIELDED_TIMEFRAME_CYCLE = ['all', '1y', '1mo', '1d'];
const SHIELDED_TIMEFRAME_LABELS = { 'all': 'All', '1y': 'Y', '1mo': 'M', '1d': 'D' };

// Price data
let priceChart = null;
let priceHistoricalData = null;
let livePrice = null;
let previousPrice = null;
let currentPriceChars = [];
let priceChartTimeframe = '1d'; // '1d', '1mo', '1y', or '1h' - starts at D
const TIMEFRAME_CYCLE = ['1d', '1mo', '1y', '1h'];
const TIMEFRAME_LABELS = { '1d': 'D', '1mo': 'M', '1y': 'Y', '1h': 'H' };
let hourlyYAxisLocked = { min: null, max: null };
let isTogglingPriceChart = false; // Prevent race condition on rapid clicks

// Currency State
let zecQuotes = null; // Store latest quotes from CMC
let currentCurrency = 'USD'; // 'USD' or 'BTC'

// Predict Mode State
let currentMode = 'dashboard';
let walletBalance = parseFloat(localStorage.getItem('zec_wallet_balance')) || 1000;
let predictHistory = JSON.parse(localStorage.getItem('zec_predict_history')) || [];
let activeBet = null; // 'up', 'down', or null
let currentRound = {
  id: Date.now(),
  entryPrice: null,
  pool: 4000 + Math.floor(Math.random() * 1000),
  startTime: Date.now(),
  duration: 60000 // 1 minute rounds
};

// ============================================================================
// View Toggle
// ============================================================================

function switchView() {
  if (currentView === 'price') {
    currentView = 'shielded';
    // Swap headlines
    headlinePrice.classList.remove('active');
    headlineShielded.classList.add('active');
    // Swap charts
    chartPrice.classList.remove('active');
    chartShielded.classList.add('active');
    // Update button
    toggleText.textContent = 'market price';
    viewToggle.classList.add('flipped');
  } else {
    currentView = 'price';
    // Swap headlines
    headlineShielded.classList.remove('active');
    headlinePrice.classList.add('active');
    // Swap charts
    chartShielded.classList.remove('active');
    chartPrice.classList.add('active');
    // Update button
    toggleText.textContent = 'shielded supply';
    viewToggle.classList.remove('flipped');
  }
}

viewToggle.addEventListener('click', switchView);

// Mode Toggle
function switchMode(mode) {
  currentMode = mode;
  if (mode === 'dashboard') {
    dashboardTab.classList.add('active');
    predictTab.classList.remove('active');
    dashboardView.classList.add('active');
    predictView.classList.remove('active');
    viewToggle.style.display = 'flex';
  } else {
    predictTab.classList.add('active');
    dashboardTab.classList.remove('active');
    predictView.classList.add('active');
    dashboardView.classList.remove('active');
    viewToggle.style.display = 'none';

    // Initial UI update for predict
    updatePredictUI();
    fetchPondMarkets();
  }
}

dashboardTab.addEventListener('click', () => switchMode('dashboard'));
predictTab.addEventListener('click', () => switchMode('predict'));

// ============================================================================
// Formatting Helpers
// ============================================================================

function formatPrice(price) {
  if (currentCurrency === 'BTC') {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 6,
      maximumFractionDigits: 6
    });
  }
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatStatValue(value) {
  if (currentCurrency === 'BTC') return value.toFixed(6);
  if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
  if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function updateStatsDisplay(quote) {
  if (!quote) return;
  statHighEl.textContent = (currentCurrency === 'USD' ? '$' : '') + formatStatValue(quote.high_24h || 0);
  statLowEl.textContent = (currentCurrency === 'USD' ? '$' : '') + formatStatValue(quote.low_24h || 0);
  statVolEl.textContent = (currentCurrency === 'USD' ? '$' : '') + formatStatValue(quote.volume_24h || 0);

  saveToCache(LAST_STATS_KEY, quote);
}

async function toggleCurrency() {
  currentCurrency = currentCurrency === 'USD' ? 'BTC' : 'USD';
  currencyToggleBtn.textContent = currentCurrency;
  currencySymbolEl.textContent = currentCurrency === 'USD' ? '$' : '₿';
  currencySymbolEl.style.fontSize = currentCurrency === 'USD' ? '32px' : '48px';

  localStorage.setItem(CURRENCY_KEY, currentCurrency);

  // Fetch price for the new currency immediately
  const price = await fetchInitialPrice();
  if (price !== null) {
    updatePrice(price);
  }
}

currencyToggleBtn.addEventListener('click', toggleCurrency);

function formatShieldedValue(value) {
  return Math.round(value).toLocaleString('en-US');
}

// ============================================================================
// Rolling Digit Animation (for price)
// ============================================================================

function createDigitSlot(char, index) {
  const slot = document.createElement('span');
  slot.className = 'digit-slot';
  slot.dataset.index = index;

  const roll = document.createElement('span');
  roll.className = 'digit-roll';

  if (/\d/.test(char)) {
    for (let i = 0; i <= 9; i++) {
      const span = document.createElement('span');
      span.textContent = i;
      roll.appendChild(span);
    }
    roll.style.transform = `translateY(-${parseInt(char) * (100 / 10)}%)`;
  } else {
    const span = document.createElement('span');
    span.textContent = char;
    roll.appendChild(span);
  }

  slot.appendChild(roll);
  return slot;
}

function updatePriceDisplay(newPrice) {
  if (!newPrice) return;
  const newChars = newPrice.split('');

  if (newChars.length !== currentPriceChars.length) {
    priceEl.innerHTML = '';
    newChars.forEach((char, i) => {
      priceEl.appendChild(createDigitSlot(char, i));
    });
    currentPriceChars = newChars;
    return;
  }

  const slots = priceEl.querySelectorAll('.digit-slot');
  newChars.forEach((char, i) => {
    if (char !== currentPriceChars[i]) {
      const roll = slots[i].querySelector('.digit-roll');
      if (/\d/.test(char)) {
        roll.style.transform = `translateY(-${parseInt(char) * (100 / 10)}%)`;
      }
    }
  });

  currentPriceChars = newChars;
}

// ============================================================================
// Live Indicator
// ============================================================================

function updateLiveIndicator() {
  if (!priceChart || !priceChart.data.datasets[0].data.length) return;

  const meta = priceChart.getDatasetMeta(0);
  const lastPoint = meta.data[meta.data.length - 1];

  if (lastPoint) {
    liveIndicator.style.left = `${lastPoint.x}px`;
    liveIndicator.style.top = `${lastPoint.y}px`;
  }
}

// ============================================================================
// Shielded Data & Chart
// ============================================================================

async function fetchShieldedData() {
  try {
    const res = await fetch(SHIELDED_DATA_URL);
    const json = await res.json();
    shieldedDataFull = json.data;
    shieldedData = shieldedDataFull; // Start with all data
    return shieldedData;
  } catch (err) {
    console.error('Failed to fetch shielded data:', err);
    return null;
  }
}

// Fetch hourly shielded data for 1D view
async function fetchShieldedHourlyData() {
  try {
    const res = await fetch(SHIELDED_HOURLY_URL);
    const json = await res.json();
    return json.data;
  } catch (err) {
    console.error('Failed to fetch hourly shielded data:', err);
    return null;
  }
}

// Filter shielded data by timeframe
function getShieldedDataForTimeframe(timeframe) {
  if (!shieldedDataFull) return [];

  const now = Date.now() / 1000;
  let cutoff;

  switch (timeframe) {
    case '1d':
      return null; // Will fetch from hourly endpoint
    case '1mo':
      cutoff = now - (30 * 24 * 60 * 60);
      break;
    case '1y':
      cutoff = now - (365 * 24 * 60 * 60);
      break;
    case 'all':
    default:
      return shieldedDataFull;
  }

  return shieldedDataFull.filter(d => d.t >= cutoff);
}

// Update shielded timeframe button with % change
function updateShieldedBtn(data) {
  const label = SHIELDED_TIMEFRAME_LABELS[shieldedChartTimeframe];

  // For "All" timeframe, just show label (% from genesis is meaningless)
  if (shieldedChartTimeframe === 'all') {
    shieldedChangeBtn.textContent = label;
    shieldedChangeBtn.classList.remove('up', 'down');
    return;
  }

  // Calculate % change if we have data
  let percentChange = 0;
  const chartData = data || shieldedData;
  if (chartData && chartData.length >= 2) {
    const firstValue = chartData[0].v;
    // For M/Y, use live value if available (more accurate than stale JSON)
    let lastValue = chartData[chartData.length - 1].v;
    if (shieldedChartTimeframe !== '1d' && currentShieldedValue > 0) {
      lastValue = currentShieldedValue;
    }
    if (firstValue > 0) {
      percentChange = ((lastValue - firstValue) / firstValue) * 100;
    }
  }

  const isUp = percentChange >= 0;
  // Use 2 decimal places to capture small daily changes (supply is ~5M ZEC)
  const absChange = Math.abs(percentChange);
  const decimals = absChange < 0.1 ? 2 : 1;
  const formatted = `${absChange.toFixed(decimals)}% · ${label}`;

  shieldedChangeBtn.textContent = formatted;
  shieldedChangeBtn.classList.remove('up', 'down');
  shieldedChangeBtn.classList.add(isUp ? 'up' : 'down');
}

// Toggle shielded chart timeframe
let isTogglingShieldedChart = false; // Prevent race condition on rapid clicks

async function toggleShieldedChartTimeframe() {
  // Prevent race condition from rapid clicks
  if (isTogglingShieldedChart) return;
  isTogglingShieldedChart = true;

  const currentIndex = SHIELDED_TIMEFRAME_CYCLE.indexOf(shieldedChartTimeframe);
  shieldedChartTimeframe = SHIELDED_TIMEFRAME_CYCLE[(currentIndex + 1) % SHIELDED_TIMEFRAME_CYCLE.length];

  let newData;
  if (shieldedChartTimeframe === '1d') {
    // Show loading state for API fetch
    shieldedChangeBtn.textContent = '· · ·';
    shieldedChangeBtn.classList.add('loading');
    shieldedChangeBtn.classList.remove('up', 'down');

    // Fetch hourly data for 1D view
    newData = await fetchShieldedHourlyData();

    shieldedChangeBtn.classList.remove('loading');
  } else {
    // Filter existing data (instant, no loading needed)
    newData = getShieldedDataForTimeframe(shieldedChartTimeframe);
  }

  if (newData && newData.length > 0) {
    shieldedData = newData;

    // Update chart
    const labels = shieldedData.map(d => new Date(d.t * 1000));
    const data = shieldedData.map(d => d.v);

    // For M/Y/All, append live value as final point (keeps chart current)
    if (shieldedChartTimeframe !== '1d' && currentShieldedValue > 0) {
      labels.push(new Date());
      data.push(currentShieldedValue);
    }

    shieldedChart.data.labels = labels;
    shieldedChart.data.datasets[0].data = data;
    shieldedChart.update();
  }

  // Update button with % change
  updateShieldedBtn(newData);
  isTogglingShieldedChart = false; // Release lock
}

// Fetch live shielded supply from Zcash node via RPC proxy
async function fetchLiveShieldedSupply() {
  try {
    const heightRes = await fetch(ZCASH_RPC_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '1.0', id: 'zec', method: 'getblockcount', params: [] })
    });

    if (!heightRes.ok) throw new Error(`RPC height check failed: ${heightRes.status}`);
    const heightData = await heightRes.json();
    const height = heightData.result;

    const blockRes = await fetch(ZCASH_RPC_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '1.0', id: 'zec', method: 'getblock', params: [String(height), 1] })
    });

    if (!blockRes.ok) throw new Error(`RPC block fetch failed: ${blockRes.status}`);
    const blockData = await blockRes.json();
    const block = blockData.result;

    if (!block || !block.valuePools) return null;

    const pools = block.valuePools || [];
    const sprout = pools.find(p => p.id === 'sprout')?.chainValueZat || 0;
    const sapling = pools.find(p => p.id === 'sapling')?.chainValueZat || 0;
    const orchard = pools.find(p => p.id === 'orchard')?.chainValueZat || 0;
    const total = (sprout + sapling + orchard) / 1e8;

    return { height, time: block.time, total, sprout: sprout / 1e8, sapling: sapling / 1e8, orchard: orchard / 1e8 };
  } catch (err) {
    console.warn('Failed to fetch live shielded supply:', err.message);
    return null;
  }
}

// Count-up animation for shielded value
let currentShieldedValue = 0;
let shieldedAnimationFrame = null;

function animateShieldedValue(targetValue, duration = 800) {
  const startValue = currentShieldedValue;
  const difference = targetValue - startValue;

  // Skip animation if no change or first load
  if (difference === 0) return;
  if (startValue === 0) {
    currentShieldedValue = targetValue;
    shieldedValueEl.textContent = formatShieldedValue(targetValue);
    return;
  }

  // Flash green/red based on direction
  shieldedValueEl.classList.remove('flash-up', 'flash-down');
  void shieldedValueEl.offsetWidth; // Force reflow
  shieldedValueEl.classList.add(difference > 0 ? 'flash-up' : 'flash-down');

  setTimeout(() => {
    shieldedValueEl.classList.remove('flash-up', 'flash-down');
  }, duration);

  const startTime = performance.now();

  // Cancel any existing animation
  if (shieldedAnimationFrame) {
    cancelAnimationFrame(shieldedAnimationFrame);
  }

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-out cubic for smooth deceleration
    const easeOut = 1 - Math.pow(1 - progress, 3);

    const currentValue = startValue + (difference * easeOut);
    shieldedValueEl.textContent = formatShieldedValue(currentValue);

    if (progress < 1) {
      shieldedAnimationFrame = requestAnimationFrame(animate);
    } else {
      currentShieldedValue = targetValue;
      shieldedValueEl.textContent = formatShieldedValue(targetValue);
    }
  }

  shieldedAnimationFrame = requestAnimationFrame(animate);
}

// Update shielded display with live data
function updateLiveShieldedDisplay(data) {
  if (!data) return;

  // Animate headline value
  animateShieldedValue(data.total);

  // Update percentage of supply shielded
  if (circulatingSupply && circulatingSupply > 0) {
    const percent = (data.total / circulatingSupply) * 100;
    shieldedPercentEl.textContent = `${Math.round(percent)}%`;
  }

  // Update chart's live tip (for M/Y/All timeframes only)
  if (shieldedChart && shieldedData && shieldedChartTimeframe !== '1d') {
    const labels = shieldedData.map(d => new Date(d.t * 1000));
    const chartData = shieldedData.map(d => d.v);

    // Append live data point as the tip
    labels.push(new Date(data.time * 1000));
    chartData.push(data.total);

    shieldedChart.data.labels = labels;
    shieldedChart.data.datasets[0].data = chartData;
    shieldedChart.update('none');
  }
}

function initShieldedChart() {
  if (!shieldedData || shieldedData.length === 0) return;

  const labels = shieldedData.map(d => new Date(d.t * 1000));
  const data = shieldedData.map(d => d.v);

  // Set initial headline value (no animation on first load)
  const latestValue = shieldedData[shieldedData.length - 1].v;
  currentShieldedValue = latestValue;
  shieldedValueEl.textContent = formatShieldedValue(latestValue);

  // Update percentage of supply shielded
  if (circulatingSupply && circulatingSupply > 0) {
    const percent = (latestValue / circulatingSupply) * 100;
    shieldedPercentEl.textContent = `${Math.round(percent)}%`;
  }

  // Set initial timeframe button label
  updateShieldedBtn();

  shieldedChart = new Chart(shieldedChartCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: '#f4b728',
        borderWidth: 2,
        fill: true,
        backgroundColor: 'rgba(244, 183, 40, 0.05)',
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: '#000',
          borderColor: '#333',
          borderWidth: 1,
          titleColor: '#666',
          bodyColor: '#fff',
          titleFont: { family: "'Inter', sans-serif", size: 11, weight: '400' },
          bodyFont: { family: "'Inter', sans-serif", size: 14, weight: '300' },
          padding: 12,
          displayColors: false,
          callbacks: {
            title: (items) => {
              const date = new Date(items[0].label);
              if (shieldedChartTimeframe === '1d') {
                // Show time for 1D view
                return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
              } else if (shieldedChartTimeframe === '1mo') {
                // Show date without year for 1M
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            },
            label: (item) => {
              return Math.round(item.raw).toLocaleString('en-US') + ' ZEC';
            }
          }
        }
      },
      scales: {
        x: {
          display: false,
          grid: { display: false }
        },
        y: {
          display: false,
          grid: { display: false }
        }
      },
      animation: {
        duration: 0
      }
    }
  });
}

// ============================================================================
// Price Data & Chart
// ============================================================================

async function fetchInitialPrice() {
  try {
    const currency = currentCurrency.toLowerCase();
    const url = `${COINGECKO_API_URL}?vs_currency=${currency}&ids=zcash`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`CoinGecko API Error ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (!data || data.length === 0) {
      console.error('Invalid data structure from CoinGecko:', data);
      return null;
    }

    const zecData = data[0];

    // Update 24h change display
    const change24h = zecData.price_change_percentage_24h;
    if (change24h !== undefined) {
      updatePriceChangeBtn(change24h);
    }

    // Update Stats
    updateStatsDisplay({
      high_24h: zecData.high_24h,
      low_24h: zecData.low_24h,
      volume_24h: zecData.total_volume
    });

    // Update circulating supply if not already set
    if (zecData.circulating_supply) {
      circulatingSupply = zecData.circulating_supply;
    }

    return zecData.current_price;
  } catch (err) {
    console.error(`Failed to fetch ${currentCurrency} price from CoinGecko:`, err);
    return null;
  }
}

let currentPriceChange = 0;

function updatePriceChangeBtn(change) {
  currentPriceChange = change;
  const isUp = change >= 0;
  const label = TIMEFRAME_LABELS[priceChartTimeframe];
  const percentText = `${Math.abs(change).toFixed(2)}%`;

  // Use innerHTML to style the label differently
  priceChangeBtn.innerHTML = `<span class="pct">${percentText}</span> · <span class="tf-label">${label}</span>`;
  priceChangeBtn.classList.remove('up', 'down');
  priceChangeBtn.classList.add(isUp ? 'up' : 'down');
}

// Toggle price chart timeframe
async function togglePriceChartTimeframe() {
  // Prevent race condition from rapid clicks
  if (isTogglingPriceChart) return;
  isTogglingPriceChart = true;

  const previousTimeframe = priceChartTimeframe;

  // Cycle to next timeframe: 1d → 1mo → 1y → 1h → 1d...
  const currentIndex = TIMEFRAME_CYCLE.indexOf(priceChartTimeframe);
  const nextIndex = (currentIndex + 1) % TIMEFRAME_CYCLE.length;
  const nextTimeframe = TIMEFRAME_CYCLE[nextIndex];

  // Set proposed timeframe
  priceChartTimeframe = nextTimeframe;

  // Hide live indicator immediately
  liveIndicator.style.opacity = '0';

  // Add loading state to button
  priceChangeBtn.style.opacity = '0.5';
  priceChangeBtn.style.pointerEvents = 'none'; // Prevent rapid clicks

  // Fetch new chart data
  const newData = await fetchPriceChartData(priceChartTimeframe);

  // If fetch failed, revert state and stop
  if (!newData) {
    console.warn(`Failed to fetch data for ${priceChartTimeframe}, reverting to ${previousTimeframe}`);
    priceChartTimeframe = previousTimeframe;
    priceChangeBtn.style.opacity = '1';
    priceChangeBtn.style.pointerEvents = 'auto';
    liveIndicator.style.opacity = '1';
    isTogglingPriceChart = false; // Release lock

    // Optional: Flash error state on button
    priceChangeBtn.classList.add('error');
    setTimeout(() => priceChangeBtn.classList.remove('error'), 500);
    return;
  }

  // Update chart with smooth animation
  if (priceChart && priceHistoricalData) {
    const { labels, data } = getPriceChartDataWithLiveTip();
    priceChart.data.labels = labels;
    priceChart.data.datasets[0].data = data;

    // Lock y-axis for 1H to prevent jitter on refresh, reset for others
    if (priceChartTimeframe === '1h') {
      lockYAxisForHourly(data);
      applyYAxisLock();
    } else {
      hourlyYAxisLocked = { min: null, max: null };
      applyYAxisLock();
    }

    // Update chart with animation
    priceChart.update();

    // Reposition and show indicator after animation completes (400ms)
    setTimeout(() => {
      updateLiveIndicator();
      liveIndicator.style.opacity = '1';
    }, 450);

    // Calculate % change for current timeframe
    if (data.length >= 2) {
      const firstPrice = data[0];
      const lastPrice = data[data.length - 1];
      const percentChange = ((lastPrice - firstPrice) / firstPrice) * 100;

      // Animate button content change
      priceChangeBtn.style.opacity = '0';
      setTimeout(() => {
        updatePriceChangeBtn(percentChange);
        priceChangeBtn.style.opacity = '1';
        priceChangeBtn.style.pointerEvents = 'auto';
        isTogglingPriceChart = false; // Release lock
      }, 150);
    } else {
      priceChangeBtn.style.pointerEvents = 'auto'; // Re-enable if no data to calc change
      isTogglingPriceChart = false; // Release lock
    }
  } else {
    priceChangeBtn.style.opacity = '1';
    liveIndicator.style.opacity = '1';
    isTogglingPriceChart = false; // Release lock
  }
}

priceChangeBtn.addEventListener('click', togglePriceChartTimeframe);
shieldedChangeBtn.addEventListener('click', toggleShieldedChartTimeframe);

async function fetchCirculatingSupply() {
  try {
    // If we already have it from the initial price fetch, use it
    if (circulatingSupply) return circulatingSupply;

    // Use CoinGecko for consistency if not set yet
    const url = `${COINGECKO_API_URL}?vs_currency=usd&ids=zcash`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.length > 0) {
      circulatingSupply = data[0].circulating_supply;
      return circulatingSupply;
    }
    return null;
  } catch (err) {
    console.error('Failed to fetch circulating supply from CoinGecko:', err);
    return null;
  }
}

async function fetchPriceChartData(timeframe = '1d') {
  try {
    let url;
    if (timeframe === '1h') url = COINGECKO_CHART_1H_URL;
    else if (timeframe === '1d') url = COINGECKO_CHART_1D_URL;
    else if (timeframe === '1mo') url = COINGECKO_CHART_1MO_URL;
    else url = COINGECKO_CHART_1Y_URL;

    const res = await fetch(url);
    const data = await res.json();
    priceHistoricalData = data.prices;
    return priceHistoricalData;
  } catch (err) {
    console.error('Failed to fetch price chart data:', err);
    return null;
  }
}

function getPriceChartDataWithLiveTip() {
  if (!priceHistoricalData) return { labels: [], data: [] };

  const labels = priceHistoricalData.map(p => new Date(p[0]));
  const data = priceHistoricalData.map(p => p[1]);

  if (livePrice !== null) {
    labels.push(new Date());
    data.push(livePrice);
  }

  return { labels, data };
}

function updatePriceChartLiveTip() {
  if (!priceChart || !priceHistoricalData) return;

  const { labels, data } = getPriceChartDataWithLiveTip();
  priceChart.data.labels = labels;
  priceChart.data.datasets[0].data = data;
  priceChart.update('none');
  updateLiveIndicator();
}

function initPriceChart() {
  if (!priceHistoricalData) return;

  const { labels, data } = getPriceChartDataWithLiveTip();

  priceChart = new Chart(priceChartCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: '#fff',
        borderWidth: 2,
        fill: true,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: '#000',
          borderColor: '#333',
          borderWidth: 1,
          titleColor: '#666',
          bodyColor: '#fff',
          titleFont: { family: "'Inter', sans-serif", size: 11, weight: '400' },
          bodyFont: { family: "'Inter', sans-serif", size: 14, weight: '300' },
          padding: 12,
          displayColors: false,
          callbacks: {
            title: (items) => {
              const date = new Date(items[0].label);
              if (priceChartTimeframe === '1h') {
                // Show time with minutes for 1H chart
                return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
              } else if (priceChartTimeframe === '1d') {
                // Show time for 1D chart
                return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
              } else if (priceChartTimeframe === '1mo') {
                // Show date without year for 1MO chart
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            },
            label: (item) => {
              return '$' + item.raw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
          }
        }
      },
      scales: {
        x: {
          display: false,
          grid: { display: false }
        },
        y: {
          display: false,
          grid: { display: false }
        }
      },
      animation: {
        duration: 400,
        easing: 'easeOutQuart',
        onComplete: updateLiveIndicator
      }
    }
  });
}

// ============================================================================
// WebSocket Price Stream (with fallback to polling)
// ============================================================================

let wsConnected = false;
let wsRetries = 0;
let pollingInterval = null;

function updatePrice(price) {
  if (price === null || price === undefined) return;

  // Flash color on price change
  if (previousPrice !== null && price !== previousPrice) {
    priceEl.classList.remove('flash-up', 'flash-down');
    void priceEl.offsetWidth;
    priceEl.classList.add(price > previousPrice ? 'flash-up' : 'flash-down');

    setTimeout(() => {
      priceEl.classList.remove('flash-up', 'flash-down');
    }, 600);
  }

  previousPrice = price;
  livePrice = price;
  updatePriceDisplay(formatPrice(price));
  updatePriceChartLiveTip();
  document.title = `${currentCurrency === 'USD' ? '$' : '₿'}${formatPrice(price)} · ZEC`;

  if (currentMode === 'predict') {
    updatePredictUI();
  }

  saveToCache(LAST_PRICE_KEY, price);
}

// Fallback: poll CoinGecko every 10 seconds
function startPricePolling() {
  if (pollingInterval) return; // Already polling

  console.log('WebSocket unavailable, falling back to CMC polling');
  pollingInterval = setInterval(async () => {
    try {
      // Only add convert if it's not USD (default)
      let url = CMC_QUOTES_URL;
      if (currentCurrency && currentCurrency !== 'USD') {
        url += `&convert=${currentCurrency}`;
      }

      const res = await fetch(url);
      if (!res.ok) return;

      const data = await res.json();
      if (!data || !data.data || !data.data.ZEC) return;

      zecQuotes = data.data.ZEC;
      const quote = zecQuotes.quote[currentCurrency];
      if (!quote) return;

      const price = quote.price;
      const change24h = quote.percent_change_24h;

      updatePrice(price);
      if (priceChartTimeframe === '1d') {
        updatePriceChangeBtn(change24h);
      }

      updateStatsDisplay({
        volume_24h: quote.volume_24h
      });
    } catch (err) {
      console.error('Polling error:', err);
    }
  }, 10000); // Every 10 seconds
}

function stopPricePolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

function connectPriceStream() {
  const ws = new WebSocket(BINANCE_WS_URL);

  ws.onopen = () => {
    wsConnected = true;
    wsRetries = 0;
    stopPricePolling(); // Stop polling if WebSocket connects
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const price = parseFloat(data.p);

    // Only update if current currency is USD (Binance stream is ZECUSDT)
    if (currentCurrency === 'USD') {
      updatePrice(price);
      // Minimal stats update if we have zecQuotes
      if (zecQuotes && zecQuotes.quote.USD) {
        zecQuotes.quote.USD.price = price;
      }
    }
  };

  ws.onclose = (event) => {
    wsConnected = false;

    // If blocked (451) or too many retries, switch to polling
    if (wsRetries >= 3) {
      startPricePolling();
      return;
    }

    wsRetries++;
    setTimeout(connectPriceStream, 2000);
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
    wsConnected = false;
    ws.close();
  };
}

// ============================================================================
// UI Reveal
// ============================================================================

function revealUI() {
  if (isReady) return;
  isReady = true;
  splash.classList.add('fade-out');
  setTimeout(() => {
    container.classList.add('ready');
  }, 1300);
}

// ============================================================================
// Caching
// ============================================================================

const CURRENCY_KEY = 'zec_currency';
const LAST_PRICE_KEY = 'zec_last_price';
const LAST_STATS_KEY = 'zec_last_stats';

function saveToCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving to cache:', e);
  }
}

function loadFromCache(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Error loading from cache:', e);
    return null;
  }
}

// ============================================================================
// Initialization
// ============================================================================

// Initial data loading
async function init() {
  try {
    console.log('App initialization started...');

    // 1. Load cached currency preference
    const cachedCurrency = localStorage.getItem(CURRENCY_KEY);
    if (cachedCurrency) {
      currentCurrency = cachedCurrency;
      currencyToggleBtn.textContent = currentCurrency;
      currencySymbolEl.textContent = currentCurrency === 'USD' ? '$' : '₿';
      currencySymbolEl.style.fontSize = currentCurrency === 'USD' ? '32px' : '48px';
    }

    // 2. Load cached data for instant display (UX Optimization)
    const cachedPrice = loadFromCache(LAST_PRICE_KEY);
    if (cachedPrice) {
      updatePrice(cachedPrice);
      revealUI(); // Show UI early if we have cached data
    }

    const cachedStats = loadFromCache(LAST_STATS_KEY);
    if (cachedStats) {
      updateStatsDisplay(cachedStats);
    }

    // 3. Fetch initial price (Critical path)
    const initialPrice = await fetchInitialPrice();
    if (initialPrice !== null) {
      livePrice = initialPrice;
      previousPrice = initialPrice;
      updatePriceDisplay(formatPrice(initialPrice));
      revealUI(); // Show UI as soon as we have a real price
    } else if (!isReady) {
      // Fallback: If price fetch fails and we're still on splash, reveal anyway to show error/polling state
      revealUI();
    }

    // 4. Background Fetches (Non-blocking)
    Promise.all([
      fetchShieldedData().then(() => {
        // Only init shielded chart if we have data
        if (shieldedDataFull) initShieldedChart();
      }),
      fetchPriceChartData(priceChartTimeframe).then(() => {
        initPriceChart();
        // Lock y-axis for initial 1H view if applicable
        if (priceChartTimeframe === '1h' && priceHistoricalData) {
          const { data } = getPriceChartDataWithLiveTip();
          lockYAxisForHourly(data);
          applyYAxisLock();
          priceChart.update('none');
        }
      }),
      fetchCirculatingSupply(),
      fetchLiveShieldedSupply().then(liveShielded => {
        if (liveShielded) updateLiveShieldedDisplay(liveShielded);
      })
    ]).catch(err => {
      console.warn('One or more background fetches failed:', err);
    });

    // 5. Connect WebSocket/Polling
    connectPriceStream();

    console.log('App initialization sequence complete.');
  } catch (err) {
    console.error('FATAL initialization error:', err);
    revealUI(); // Always clear splash screen
  }
}

window.addEventListener('DOMContentLoaded', init);

// Refresh price chart data - 30s for 1H, 5min for others
function getChartRefreshInterval() {
  return priceChartTimeframe === '1h' ? 30 * 1000 : 5 * 60 * 1000;
}

function lockYAxisForHourly(data) {
  if (!data || data.length === 0) return;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const padding = (max - min) * 0.1; // 10% padding
  hourlyYAxisLocked.min = min - padding;
  hourlyYAxisLocked.max = max + padding;
}

function applyYAxisLock() {
  if (!priceChart || !priceChart.options || !priceChart.options.scales || !priceChart.options.scales.y) return;

  if (priceChartTimeframe === '1h' && hourlyYAxisLocked.min !== null) {
    priceChart.options.scales.y.min = hourlyYAxisLocked.min;
    priceChart.options.scales.y.max = hourlyYAxisLocked.max;
  } else {
    // Reset to auto-scale for other timeframes
    priceChart.options.scales.y.min = undefined;
    priceChart.options.scales.y.max = undefined;
  }
}

async function refreshPriceChart() {
  await fetchPriceChartData(priceChartTimeframe);

  // Update chart silently (no animation) for background refreshes
  if (priceChart && priceHistoricalData) {
    const { labels, data } = getPriceChartDataWithLiveTip();
    priceChart.data.labels = labels;
    priceChart.data.datasets[0].data = data;

    // For 1H, keep y-axis locked to prevent vertical jitter
    if (priceChartTimeframe === '1h') {
      applyYAxisLock();
    }

    priceChart.update('none'); // No animation for silent refresh
    updateLiveIndicator();
  }

  setTimeout(refreshPriceChart, getChartRefreshInterval());
}

setTimeout(refreshPriceChart, getChartRefreshInterval());

// Refresh shielded supply every 75 seconds (~1 block)
const POLL_INTERVAL = 75 * 1000;
let pollStartTime = Date.now();

// Animate progress bar
function updatePollProgress() {
  const elapsed = Date.now() - pollStartTime;
  const progress = Math.min((elapsed / POLL_INTERVAL) * 100, 100);
  pollProgressBar.style.width = `${progress}%`;
}

// Start progress bar animation
setInterval(updatePollProgress, 500);

// Poll for shielded supply
async function pollShieldedSupply() {
  // Flash the bar briefly to indicate polling
  pollProgressBar.classList.add('polling');

  const liveShielded = await fetchLiveShieldedSupply();
  if (liveShielded) {
    updateLiveShieldedDisplay(liveShielded);
  }

  // Reset progress bar
  pollProgressBar.classList.remove('polling');
  pollProgressBar.style.width = '0%';
  pollStartTime = Date.now();
}

setInterval(pollShieldedSupply, POLL_INTERVAL);

// ============================================================================
// Prediction Market Logic
// ============================================================================

function updatePredictUI() {
  walletBalanceEl.textContent = `$${walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  roundPoolEl.textContent = `$${currentRound.pool.toLocaleString()}`;

  if (currentRound.entryPrice) {
    roundEntryPriceEl.textContent = `$${currentRound.entryPrice.toFixed(2)}`;
  } else {
    roundEntryPriceEl.textContent = 'WAITING...';
  }

  if (livePrice) {
    roundLastPriceEl.textContent = `$${livePrice.toFixed(2)}`;
    // Highlight price based on entry
    if (currentRound.entryPrice) {
      roundLastPriceEl.style.color = livePrice >= currentRound.entryPrice ? '#22c55e' : '#ef4444';
    } else {
      roundLastPriceEl.style.color = '#fff';
    }
  }

  // Update Bet buttons
  betUpBtn.style.opacity = activeBet === 'down' ? '0.5' : '1';
  betDownBtn.style.opacity = activeBet === 'up' ? '0.5' : '1';
  betUpBtn.style.borderWidth = activeBet === 'up' ? '2px' : '1px';
  betDownBtn.style.borderWidth = activeBet === 'down' ? '2px' : '1px';

  renderPredictHistory();
}

function renderPredictHistory() {
  predictHistoryEl.innerHTML = '';
  predictHistory.slice(-5).reverse().forEach(round => {
    const item = document.createElement('div');
    item.className = `history-item ${round.outcome}`;

    const time = new Date(round.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const profitText = round.outcome === 'win' ? `<span class="win-text">+$${round.profit}</span>` : `<span class="loss-text">-$${round.bet}</span>`;

    item.innerHTML = `
      <div class="round-info">
        <span class="round-num">#${round.id % 1000}</span>
        <span class="outcome ${round.outcome}-text">${round.outcome}</span>
      </div>
      <div class="round-result">
        ${profitText}
      </div>
    `;
    predictHistoryEl.appendChild(item);
  });
}

function startNewRound() {
  // Resolve previous round if any
  if (currentRound.entryPrice && activeBet) {
    const isWin = (activeBet === 'up' && livePrice >= currentRound.entryPrice) ||
      (activeBet === 'down' && livePrice < currentRound.entryPrice);

    const betAmount = 100; // Fixed bet for demo
    let outcome = isWin ? 'win' : 'loss';
    let profit = isWin ? betAmount * 0.9 : 0; // 90% payout

    if (isWin) {
      walletBalance += profit;
    } else {
      walletBalance -= betAmount;
    }

    predictHistory.push({
      id: currentRound.id,
      outcome: outcome,
      bet: betAmount,
      profit: profit,
      time: Date.now()
    });

    localStorage.setItem('zec_wallet_balance', walletBalance);
    localStorage.setItem('zec_predict_history', JSON.stringify(predictHistory));
  }

  // Reset for new round
  activeBet = null;
  currentRound = {
    id: Date.now(),
    entryPrice: livePrice,
    pool: 4000 + Math.floor(Math.random() * 1000),
    startTime: Date.now(),
    duration: 60000
  };

  updatePredictUI();
}

function updatePredictTimer() {
  const elapsed = Date.now() - currentRound.startTime;
  const remaining = Math.max(0, currentRound.duration - elapsed);

  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);

  timerMEl.textContent = String(m).padStart(2, '0');
  timerSEl.textContent = String(s).padStart(2, '0');

  if (remaining === 0) {
    startNewRound();
  }
}

// Bet listeners
betUpBtn.addEventListener('click', () => {
  if (activeBet) return;
  if (walletBalance < 100) return;
  activeBet = 'up';
  updatePredictUI();
});

betDownBtn.addEventListener('click', () => {
  if (activeBet) return;
  if (walletBalance < 100) return;
  activeBet = 'down';
  updatePredictUI();
});

// Sync with live updates
// Removed manual window.updatePrice override as it's now integrated in updatePrice function

// Initialization
setInterval(updatePredictTimer, 1000);
if (!currentRound.entryPrice && livePrice) {
  currentRound.entryPrice = livePrice;
}

// ============================================================================
// Pond Prediction Markets
// ============================================================================

async function fetchPondMarkets() {
  const pondMarketsList = document.getElementById('pond-markets-list');
  if (!pondMarketsList) return;

  try {
    const response = await fetch(POND_API_URL);
    if (response.status === 429) {
      pondMarketsList.innerHTML = '<div class="error-markets">Rate limit exceeded. Please wait a few seconds.</div>';
      return;
    }
    if (!response.ok) throw new Error('Failed to fetch markets');
    const data = await response.json();

    // Filter for ZEC related markets
    const zecMarkets = (data.events || []).filter(event =>
      (event.title && (event.title.toUpperCase().includes('ZEC') || event.title.toUpperCase().includes('ZCASH'))) ||
      (event.ticker && event.ticker.toUpperCase().includes('ZEC'))
    );

    // Sort by closing soonest
    zecMarkets.sort((a, b) => {
      const timeA = a.markets?.[0]?.closeTime || Infinity;
      const timeB = b.markets?.[0]?.closeTime || Infinity;
      return timeA - timeB;
    });

    renderPondMarkets(zecMarkets);
  } catch (error) {
    console.error('Error fetching prediction markets:', error);
    pondMarketsList.innerHTML = '<div class="error-markets">Failed to load live markets.</div>';
  }
}

function renderPondMarkets(events) {
  const pondMarketsList = document.getElementById('pond-markets-list');
  if (!pondMarketsList) return;

  if (!events || events.length === 0) {
    pondMarketsList.innerHTML = '<div class="no-markets">No active prediction markets found.</div>';
    return;
  }

  pondMarketsList.innerHTML = '';
  events.forEach(event => {
    const card = document.createElement('div');
    card.className = 'market-card';

    const market = event.markets?.[0];
    const closeTime = market ? new Date(market.closeTime * 1000) : null;
    const timeRemaining = closeTime ? getTimeRemainingString(closeTime) : 'N/A';

    card.innerHTML = `
      <div class="market-ticker">${event.ticker}</div>
      <div class="market-title">${event.title}</div>
      <div class="market-subtitle">${event.subtitle || ''}</div>
      <div class="market-footer">
        <div class="market-timer">Ends in: ${timeRemaining}</div>
        <div class="market-status">${market?.status || 'active'}</div>
      </div>
    `;
    pondMarketsList.appendChild(card);
  });
}

function getTimeRemainingString(endTime) {
  const total = endTime.getTime() - Date.now();
  if (total <= 0) return 'Ended';

  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ============================================================================
// Wallet Integration
// ============================================================================

const connectWalletBtn = document.getElementById('connect-wallet-btn');
const walletInfoEl = document.getElementById('wallet-info');
const walletAddressEl = document.getElementById('wallet-address');

// Handle wallet connection button click
if (connectWalletBtn) {
  connectWalletBtn.addEventListener('click', async () => {
    console.log('Connect wallet button clicked');

    // If already connected, disconnect
    if (window.walletConnected) {
      connectWalletBtn.textContent = 'Disconnecting...';
      const result = await window.disconnectSolanaWallet();
      connectWalletBtn.textContent = 'Connect Wallet';
      return;
    }

    // Show connecting state
    connectWalletBtn.textContent = 'Connecting...';

    // Attempt connection
    const result = await window.connectSolanaWallet();

    if (result.success) {
      // UI update handled by event listener below
    } else {
      connectWalletBtn.textContent = result.error?.includes('No Solana') ? 'Get Phantom' : 'Failed';
      setTimeout(() => {
        connectWalletBtn.textContent = 'Connect Wallet';
      }, 2000);
    }
  });
}

// Listen for wallet connection events
window.addEventListener('walletConnected', async (e) => {
  const address = e.detail.address;
  const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;

  // Update UI
  if (connectWalletBtn) connectWalletBtn.style.display = 'none';
  if (walletInfoEl) walletInfoEl.style.display = 'flex';
  if (walletAddressEl) walletAddressEl.textContent = shortAddress;
  if (walletBalanceEl) {
    walletBalanceEl.style.display = 'block';
    walletBalanceEl.textContent = 'Loading...';
  }

  console.log('Wallet connected UI updated:', shortAddress);

  // Fetch SOL balance
  await window.getSolanaBalance(address);
});

// Listen for balance updates
window.addEventListener('walletBalanceUpdated', (e) => {
  const balance = e.detail.balance;
  if (walletBalanceEl) {
    // Format balance nicely
    const formattedBalance = balance.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    });
    walletBalanceEl.textContent = `◎ ${formattedBalance} SOL`;
  }
  console.log('Wallet balance updated:', balance, 'SOL');
});

// Listen for balance fetch errors
window.addEventListener('walletBalanceError', (e) => {
  if (walletBalanceEl) {
    walletBalanceEl.textContent = 'Balance unavailable';
  }
  console.error('Balance fetch error:', e.detail.error);
});

window.addEventListener('walletDisconnected', () => {
  // Update UI
  if (connectWalletBtn) connectWalletBtn.style.display = 'block';
  if (walletInfoEl) walletInfoEl.style.display = 'none';
  if (walletBalanceEl) {
    walletBalanceEl.style.display = 'none';
    walletBalanceEl.textContent = '';
  }

  console.log('Wallet disconnected UI updated');
});
