// ============================================
// Rnld Forex AI — Frontend Logic
// ============================================

// ---- CONFIG ----
// Set to true when your FastAPI backend is running
const USE_REAL_API = false;          // ← change to true later
const API_BASE = "http://localhost:8000";  // your backend URL

// ---- Simulated Live Data (used when USE_REAL_API = false) ----
const PAIRS = {
  EURUSD: { price: 1.08542, change: 0.00124, changePct: 0.11 },
  GBPUSD: { price: 1.26780, change: -0.00215, changePct: -0.17 },
  USDJPY: { price: 149.325, change: 0.412, changePct: 0.28 },
  AUDUSD: { price: 0.65210, change: 0.00085, changePct: 0.13 },
  USDCAD: { price: 1.37240, change: -0.00180, changePct: -0.13 },
  USDCHF: { price: 0.88450, change: 0.00045, changePct: 0.05 },
  NZDUSD: { price: 0.59820, change: -0.00110, changePct: -0.18 },
  EURGBP: { price: 0.85610, change: 0.00070, changePct: 0.08 }
};

const SIGNALS = [
  { pair: "EURUSD", action: "BUY", confidence: 78, entry: 1.08480, target: 1.08920, sl: 1.08150, tf: "1H", rr: "1:2.1" },
  { pair: "GBPUSD", action: "SELL", confidence: 72, entry: 1.26950, target: 1.26400, sl: 1.27280, tf: "4H", rr: "1:1.8" },
  { pair: "USDJPY", action: "BUY", confidence: 65, entry: 149.10, target: 149.85, sl: 148.70, tf: "1H", rr: "1:1.9" },
  { pair: "AUDUSD", action: "HOLD", confidence: 54, entry: 0.65180, target: 0.65500, sl: 0.64950, tf: "1D", rr: "1:1.5" },
  { pair: "USDCAD", action: "SELL", confidence: 81, entry: 1.37400, target: 1.36850, sl: 1.37720, tf: "4H", rr: "1:2.3" }
];

const RECENT = [
  { pair: "EURUSD", signal: "BUY", entry: 1.08210, result: "WIN", pips: +28, time: "2h ago", conf: 76 },
  { pair: "GBPUSD", signal: "SELL", entry: 1.27120, result: "WIN", pips: +35, time: "5h ago", conf: 82 },
  { pair: "USDJPY", signal: "BUY", entry: 148.95, result: "LOSS", pips: -18, time: "8h ago", conf: 61 },
  { pair: "AUDUSD", signal: "BUY", entry: 0.64980, result: "WIN", pips: +22, time: "12h ago", conf: 70 },
  { pair: "EURGBP", signal: "SELL", entry: 0.85840, result: "WIN", pips: +15, time: "1d ago", conf: 68 },
  { pair: "USDCAD", signal: "BUY", entry: 1.36950, result: "LOSS", pips: -12, time: "1d ago", conf: 59 },
  { pair: "NZDUSD", signal: "SELL", entry: 0.60110, result: "WIN", pips: +19, time: "2d ago", conf: 74 }
];

const STRENGTH = [
  { currency: "USD", strength: 72 },
  { currency: "EUR", strength: 58 },
  { currency: "GBP", strength: 45 },
  { currency: "JPY", strength: 63 },
  { currency: "AUD", strength: 51 },
  { currency: "CAD", strength: 48 }
];

// ---- Real API helpers ----
async function fetchRealPrice(symbol) {
  try {
    const res = await fetch(`${API_BASE}/api/price/${symbol}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.price;
  } catch (err) {
    console.warn("Real API price failed, falling back to simulated:", err.message);
    return null;
  }
}

async function fetchRealCandles(symbol, interval = "1H", limit = 60) {
  try {
    const res = await fetch(
      `${API_BASE}/api/candles/${symbol}?interval=${interval}&limit=${limit}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.candles.map(c => ({
      x: new Date(c.time).getTime(),
      y: c.close
    }));
  } catch (err) {
    console.warn("Real API candles failed, falling back to simulated:", err.message);
    return null;
  }
}

async function refreshRealPrices() {
  const symbols = Object.keys(PAIRS);
  for (const sym of symbols) {
    const price = await fetchRealPrice(sym);
    if (price !== null) {
      const old = PAIRS[sym].price;
      PAIRS[sym].price = price;
      PAIRS[sym].change = +(price - old).toFixed(sym.includes("JPY") ? 3 : 5);
      PAIRS[sym].changePct = +((PAIRS[sym].change / old) * 100).toFixed(2);
    }
  }
}

// ---- Chart ----
let priceChart = null;
let currentPair = "EURUSD";
let currentTf = "1H";

function generateChartData(pair, tf) {
  // Simulated fallback
  const base = PAIRS[pair].price;
  const points = 60;
  const data = [];
  let price = base * 0.997;
  
  const now = Date.now();
  const interval = tf === "1H" ? 60000 : tf === "4H" ? 240000 : tf === "1D" ? 900000 : 3600000;
  
  for (let i = 0; i < points; i++) {
    const volatility = base * 0.0008;
    price += (Math.random() - 0.48) * volatility;
    data.push({
      x: now - (points - i) * interval,
      y: +price.toFixed(pair.includes("JPY") ? 3 : 5)
    });
  }
  data[data.length - 1].y = base;
  return data;
}

async function getChartData(pair, tf) {
  if (USE_REAL_API) {
    const real = await fetchRealCandles(pair, tf, 60);
    if (real && real.length > 0) return real;
  }
  return generateChartData(pair, tf);
}

async function initChart() {
  const ctx = document.getElementById("priceChart").getContext("2d");
  
  const gradient = ctx.createLinearGradient(0, 0, 0, 380);
  gradient.addColorStop(0, "rgba(59, 130, 246, 0.25)");
  gradient.addColorStop(1, "rgba(59, 130, 246, 0.0)");

  const initialData = await getChartData(currentPair, currentTf);

  priceChart = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [{
        label: currentPair,
        data: initialData,
        borderColor: "#3b82f6",
        backgroundColor: gradient,
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: "#3b82f6"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#111827",
          titleColor: "#9ca3af",
          bodyColor: "#f3f4f6",
          borderColor: "#374151",
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: (ctx) => {
              const digits = currentPair.includes("JPY") ? 3 : 5;
              return ctx.parsed.y.toFixed(digits);
            }
          }
        }
      },
      scales: {
        x: {
          type: "time",
          time: { unit: currentTf === "1W" ? "day" : "hour" },
          grid: { color: "rgba(55, 65, 81, 0.4)", drawBorder: false },
          ticks: { color: "#6b7280", maxTicksLimit: 8, font: { size: 11 } }
        },
        y: {
          grid: { color: "rgba(55, 65, 81, 0.4)", drawBorder: false },
          ticks: {
            color: "#6b7280",
            font: { size: 11 },
            callback: (v) => v.toFixed(currentPair.includes("JPY") ? 3 : 5)
          }
        }
      }
    }
  });
}

async function updateChart() {
  if (!priceChart) return;
  const data = await getChartData(currentPair, currentTf);
  priceChart.data.datasets[0].data = data;
  priceChart.data.datasets[0].label = currentPair;
  priceChart.update("none");
}

// ---- UI Rendering ----
function renderTicker() {
  const container = document.getElementById("ticker-content");
  let html = "";
  
  // Duplicate for seamless scroll
  const items = Object.entries(PAIRS);
  [...items, ...items].forEach(([pair, data]) => {
    const isUp = data.change >= 0;
    html += `
      <div class="flex items-center gap-2">
        <span class="font-medium text-gray-300">${pair.slice(0,3)}/${pair.slice(3)}</span>
        <span class="font-semibold">${data.price.toFixed(pair.includes("JPY") ? 3 : 5)}</span>
        <span class="${isUp ? "price-up" : "price-down"} text-xs">
          ${isUp ? "+" : ""}${data.changePct.toFixed(2)}%
        </span>
      </div>
    `;
  });
  container.innerHTML = html;
}

function renderMainSignal() {
  const signal = SIGNALS[0];
  const isBuy = signal.action === "BUY";
  const isSell = signal.action === "SELL";
  
  const card = document.getElementById("main-signal");
  card.className = `rounded-2xl p-5 ${isBuy ? "signal-buy" : isSell ? "signal-sell" : "signal-hold"}`;
  
  document.getElementById("signal-action").textContent = signal.action;
  document.getElementById("signal-action").className = `text-2xl font-bold ${isBuy ? "text-green-400" : isSell ? "text-red-400" : "text-yellow-400"}`;
  document.getElementById("signal-pair").textContent = `${signal.pair.slice(0,3)}/${signal.pair.slice(3)} · ${signal.tf}`;
  document.getElementById("signal-confidence").textContent = signal.confidence + "%";
  document.getElementById("confidence-bar").style.width = signal.confidence + "%";
  document.getElementById("confidence-bar").className = `h-full rounded-full transition-all duration-700 ${isBuy ? "bg-green-500" : isSell ? "bg-red-500" : "bg-yellow-500"}`;
  document.getElementById("signal-entry").textContent = signal.entry;
  document.getElementById("signal-target").textContent = signal.target;
  document.getElementById("signal-sl").textContent = signal.sl;
  document.getElementById("signal-rr").textContent = signal.rr;
  
  // Icon
  const iconWrap = card.querySelector(".w-12");
  iconWrap.className = `w-12 h-12 rounded-xl flex items-center justify-center ${isBuy ? "bg-green-500/20" : isSell ? "bg-red-500/20" : "bg-yellow-500/20"}`;
  iconWrap.innerHTML = `<i class="fas ${isBuy ? "fa-arrow-trend-up text-green-400" : isSell ? "fa-arrow-trend-down text-red-400" : "fa-minus text-yellow-400"} text-xl"></i>`;
}

function renderOtherSignals() {
  const container = document.getElementById("other-signals");
  container.innerHTML = SIGNALS.slice(1).map(s => {
    const isBuy = s.action === "BUY";
    const isSell = s.action === "SELL";
    const color = isBuy ? "text-green-400" : isSell ? "text-red-400" : "text-yellow-400";
    const bg = isBuy ? "bg-green-500/10" : isSell ? "bg-red-500/10" : "bg-yellow-500/10";
    
    return `
      <div class="flex items-center justify-between p-3 rounded-xl bg-gray-800/40 hover:bg-gray-800/70 transition cursor-pointer">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg ${bg} flex items-center justify-center">
            <i class="fas ${isBuy ? "fa-arrow-up" : isSell ? "fa-arrow-down" : "fa-minus"} ${color} text-xs"></i>
          </div>
          <div>
            <p class="text-sm font-medium">${s.pair.slice(0,3)}/${s.pair.slice(3)}</p>
            <p class="text-xs text-gray-500">${s.tf} · ${s.confidence}%</p>
          </div>
        </div>
        <span class="text-sm font-semibold ${color}">${s.action}</span>
      </div>
    `;
  }).join("");
}

function renderStrength() {
  const container = document.getElementById("currency-strength");
  container.innerHTML = STRENGTH.map(c => {
    const color = c.strength >= 60 ? "bg-green-500" : c.strength >= 45 ? "bg-yellow-500" : "bg-red-500";
    return `
      <div>
        <div class="flex justify-between text-xs mb-1">
          <span class="font-medium">${c.currency}</span>
          <span class="text-gray-400">${c.strength}</span>
        </div>
        <div class="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div class="h-full ${color} rounded-full transition-all duration-500" style="width: ${c.strength}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

function renderTable() {
  const tbody = document.getElementById("predictions-table");
  tbody.innerHTML = RECENT.map(r => {
    const isWin = r.result === "WIN";
    return `
      <tr class="hover:bg-gray-800/30 transition">
        <td class="py-3 font-medium">${r.pair.slice(0,3)}/${r.pair.slice(3)}</td>
        <td class="py-3">
          <span class="${r.signal === "BUY" ? "text-green-400" : "text-red-400"} font-medium">${r.signal}</span>
        </td>
        <td class="py-3 text-gray-400">${r.entry}</td>
        <td class="py-3">
          <span class="px-2 py-0.5 rounded text-xs font-medium ${isWin ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}">
            ${r.result}
          </span>
        </td>
        <td class="py-3 ${isWin ? "text-green-400" : "text-red-400"} font-medium">
          ${isWin ? "+" : ""}${r.pips}
        </td>
        <td class="py-3 text-gray-500">${r.time}</td>
        <td class="py-3 text-gray-400">${r.conf}%</td>
      </tr>
    `;
  }).join("");
}

function updatePriceDisplay() {
  const data = PAIRS[currentPair];
  const digits = currentPair.includes("JPY") ? 3 : 5;
  document.getElementById("current-price").textContent = data.price.toFixed(digits);
  
  const changeEl = document.getElementById("price-change");
  const isUp = data.change >= 0;
  changeEl.textContent = `${isUp ? "+" : ""}${data.change.toFixed(digits)} (${isUp ? "+" : ""}${data.changePct.toFixed(2)}%)`;
  changeEl.className = `ml-2 text-sm ${isUp ? "price-up" : "price-down"}`;
}

function updateAIAnalysis() {
  const analyses = {
    EURUSD: "EUR/USD is showing bullish momentum with higher lows forming on the 1H timeframe. RSI is at 58 and rising, while MACD histogram is turning positive. Key resistance sits at 1.0890. AI models assign a 78% probability of continued upward movement toward the target zone. Watch for US economic data releases that could impact USD strength.",
    GBPUSD: "GBP/USD faces selling pressure after failing to hold above 1.2700. The pair is trading below its 50-period EMA on the 4H chart. Momentum indicators suggest further downside is likely. A break below 1.2650 could accelerate losses. Confidence is moderate due to upcoming UK data.",
    USDJPY: "USD/JPY continues its upward trend supported by interest rate differentials. Price is holding above key moving averages. The AI ensemble sees a continuation toward 150.00, though overbought conditions on shorter timeframes suggest possible consolidation first.",
    AUDUSD: "AUD/USD is consolidating in a tight range. Mixed signals from technical indicators lead to a HOLD recommendation. Wait for a clear break of either 0.6550 or 0.6480 before committing directional bias.",
    USDCAD: "Strong bearish setup on USD/CAD. Oil prices rising are supporting the Canadian dollar. Price action shows a clear lower-high structure. High confidence short opportunity with favorable risk-reward.",
    USDCHF: "USD/CHF remains range-bound. Low volatility environment. AI models currently show no high-probability directional edge.",
    NZDUSD: "NZD/USD is under pressure from risk-off flows. Technicals favor further weakness, but confidence is limited by thin liquidity.",
    EURGBP: "EUR/GBP is attempting a recovery. Cross-pair dynamics favor mild euro strength in the short term."
  };
  
  document.getElementById("ai-analysis").textContent = analyses[currentPair] || analyses.EURUSD;
}

// ---- Live Updates ----
async function liveUpdate() {
  if (USE_REAL_API) {
    await refreshRealPrices();
  } else {
    // Simulated movement
    Object.keys(PAIRS).forEach(pair => {
      const volatility = pair.includes("JPY") ? 0.015 : 0.00012;
      const delta = (Math.random() - 0.5) * volatility;
      PAIRS[pair].price = +(PAIRS[pair].price + delta).toFixed(pair.includes("JPY") ? 3 : 5);
      PAIRS[pair].change = +(PAIRS[pair].change + delta * 0.3).toFixed(pair.includes("JPY") ? 3 : 5);
    });
  }

  renderTicker();
  updatePriceDisplay();

  // Occasionally refresh chart
  if (Math.random() > 0.7) {
    updateChart();
  }
}

// ---- Event Listeners ----
document.getElementById("pair-select").addEventListener("change", (e) => {
  currentPair = e.target.value;
  updatePriceDisplay();
  updateChart();
  updateAIAnalysis();
  
  // Update main signal to match selected pair if available
  const match = SIGNALS.find(s => s.pair === currentPair);
  if (match) {
    // Temporarily promote it
    SIGNALS.unshift(SIGNALS.splice(SIGNALS.indexOf(match), 1)[0]);
    renderMainSignal();
    renderOtherSignals();
  }
});

document.querySelectorAll(".tf-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tf-btn").forEach(b => {
      b.classList.remove("bg-blue-600", "text-white");
      b.classList.add("text-gray-400");
    });
    btn.classList.add("bg-blue-600", "text-white");
    btn.classList.remove("text-gray-400");
    currentTf = btn.dataset.tf;
    updateChart();
  });
});

// ---- Init ----
document.addEventListener("DOMContentLoaded", async () => {
  // If using real API, try to load real prices first
  if (USE_REAL_API) {
    console.log("Connecting to real API at", API_BASE);
    await refreshRealPrices();
  }

  renderTicker();
  renderMainSignal();
  renderOtherSignals();
  renderStrength();
  renderTable();
  updatePriceDisplay();
  updateAIAnalysis();
  await initChart();

  // Live updates (simulated or real)
  setInterval(liveUpdate, USE_REAL_API ? 5000 : 2500);

  // Update "Updated Xs ago"
  let seconds = 12;
  setInterval(() => {
    seconds = (seconds % 45) + 1;
    document.getElementById("signal-time").textContent = `Updated ${seconds}s ago`;
  }, 1000);
});
