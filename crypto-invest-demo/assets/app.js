const STORAGE_KEY = "vaultora-demo-state-v1";

function uid() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const plans = [
  {
    id: "stable",
    name: "Stable Yield Fund",
    asset: "USDT",
    tag: "Low volatility",
    min: 250,
    dailyRate: 0.004,
    term: 30,
    description: "A demo allocation for users who prefer steady stablecoin-style growth projections."
  },
  {
    id: "balanced",
    name: "Balanced Crypto Index",
    asset: "BTC / ETH",
    tag: "Diversified",
    min: 500,
    dailyRate: 0.007,
    term: 60,
    description: "Splits simulated exposure across major crypto assets and a fiat reserve sleeve."
  },
  {
    id: "growth",
    name: "DeFi Growth Pool",
    asset: "Multi-chain",
    tag: "Higher risk",
    min: 1000,
    dailyRate: 0.011,
    term: 90,
    description: "A higher-return demo strategy for showing performance, lockups, and payout logic."
  }
];

const marketSeed = [
  ["BTC", 68420, 1.8],
  ["ETH", 3620, -0.7],
  ["USDT", 1, 0.01],
  ["USD", 1, 0],
  ["EUR", 1.08, 0.12],
  ["NGN", 0.00067, -0.2]
];

const initialState = {
  wallet: 5000,
  withdrawn: 0,
  investments: [
    {
      id: uid(),
      planId: "balanced",
      principal: 1600,
      earnings: 142.4,
      daysElapsed: 13,
      createdAt: new Date(Date.now() - 13 * 86400000).toISOString()
    }
  ],
  transactions: [
    tx("Deposit", "USD", 5000, "Completed"),
    tx("Invest", "BTC / ETH", 1600, "Active"),
    tx("Yield", "BTC / ETH", 142.4, "Unlocked")
  ],
  markets: marketSeed
};

let state = loadState();

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

const els = {
  totalPortfolio: document.querySelector("#totalPortfolio"),
  portfolioDelta: document.querySelector("#portfolioDelta"),
  walletBalance: document.querySelector("#walletBalance"),
  activeInvestments: document.querySelector("#activeInvestments"),
  activePlans: document.querySelector("#activePlans"),
  withdrawable: document.querySelector("#withdrawable"),
  marketList: document.querySelector("#marketList"),
  plansGrid: document.querySelector("#plansGrid"),
  assetList: document.querySelector("#assetList"),
  transactionTable: document.querySelector("#transactionTable"),
  toast: document.querySelector("#toast"),
  approvalTitle: document.querySelector("#approvalTitle"),
  approvalText: document.querySelector("#approvalText"),
  approvalProgress: document.querySelector("#approvalProgress"),
  chart: document.querySelector("#growthChart")
};

function tx(type, asset, amount, status) {
  return {
    id: uid(),
    date: new Date().toISOString(),
    type,
    asset,
    amount,
    status
  };
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : structuredClone(initialState);
  } catch {
    return structuredClone(initialState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getPlan(id) {
  return plans.find((plan) => plan.id === id);
}

function investmentValue(investment) {
  return investment.principal + investment.earnings;
}

function totals() {
  const activePrincipal = state.investments.reduce((sum, item) => sum + item.principal, 0);
  const earnings = state.investments.reduce((sum, item) => sum + item.earnings, 0);
  const investedValue = state.investments.reduce((sum, item) => sum + investmentValue(item), 0);

  return {
    activePrincipal,
    earnings,
    investedValue,
    portfolio: state.wallet + investedValue,
    withdrawable: earnings
  };
}

function render() {
  const total = totals();
  els.totalPortfolio.textContent = currency.format(total.portfolio);
  els.portfolioDelta.textContent = `+${currency.format(total.earnings)} simulated earnings`;
  els.walletBalance.textContent = currency.format(state.wallet);
  els.activeInvestments.textContent = currency.format(total.activePrincipal);
  els.activePlans.textContent = `${state.investments.length} running ${state.investments.length === 1 ? "plan" : "plans"}`;
  els.withdrawable.textContent = currency.format(total.withdrawable);
  renderMarkets();
  renderPlans();
  renderAssets();
  renderTransactions();
  drawChart();
  saveState();
}

function renderMarkets() {
  els.marketList.innerHTML = state.markets.map(([symbol, price, change]) => `
    <div class="market-row">
      <div>
        <strong>${symbol}</strong>
        <small>${symbol === "USD" ? "Fiat reserve" : "Demo market price"}</small>
      </div>
      <div>
        <strong>${currency.format(price)}</strong>
        <small class="${change >= 0 ? "positive" : "negative"}">${change >= 0 ? "+" : ""}${change.toFixed(2)}%</small>
      </div>
    </div>
  `).join("");
}

function renderPlans() {
  els.plansGrid.innerHTML = plans.map((plan) => `
    <article class="plan-card">
      <header>
        <div>
          <h3>${plan.name}</h3>
          <p>${plan.description}</p>
        </div>
        <span class="badge">${plan.tag}</span>
      </header>
      <div class="plan-metrics">
        <div><small>Daily</small><strong>${(plan.dailyRate * 100).toFixed(2)}%</strong></div>
        <div><small>Term</small><strong>${plan.term}d</strong></div>
        <div><small>Min</small><strong>${currency.format(plan.min)}</strong></div>
      </div>
      <form class="form-grid" data-invest-form="${plan.id}">
        <label>
          Amount
          <input type="text" inputmode="decimal" value="${plan.min}">
        </label>
        <button class="primary-button" type="submit">Start plan</button>
      </form>
    </article>
  `).join("");
}

function renderAssets() {
  const byAsset = new Map();
  state.investments.forEach((item) => {
    const plan = getPlan(item.planId);
    const current = byAsset.get(plan.asset) || { principal: 0, earnings: 0 };
    current.principal += item.principal;
    current.earnings += item.earnings;
    byAsset.set(plan.asset, current);
  });

  const rows = [
    ["USD", { principal: state.wallet, earnings: 0 }],
    ...byAsset.entries()
  ];

  els.assetList.innerHTML = rows.map(([asset, data]) => `
    <div class="asset-row">
      <span class="asset-icon">${asset.slice(0, 1)}</span>
      <div>
        <strong>${asset}</strong>
        <small>Principal ${currency.format(data.principal)}${data.earnings ? ` + earnings ${currency.format(data.earnings)}` : ""}</small>
      </div>
      <strong>${currency.format(data.principal + data.earnings)}</strong>
    </div>
  `).join("");
}

function renderTransactions() {
  els.transactionTable.innerHTML = state.transactions.slice(0, 12).map((item) => `
    <tr>
      <td>${new Date(item.date).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
      <td>${item.type}</td>
      <td>${item.asset}</td>
      <td>${currency.format(item.amount)}</td>
      <td>${item.status}</td>
    </tr>
  `).join("");
}

function addTransaction(type, asset, amount, status) {
  state.transactions.unshift(tx(type, asset, amount, status));
}

function invest(planId, amount) {
  const plan = getPlan(planId);
  if (amount < plan.min) {
    notify(`Minimum for ${plan.name} is ${currency.format(plan.min)}.`);
    return;
  }
  if (amount > state.wallet) {
    notify("Wallet balance is not enough for this investment.");
    return;
  }

  state.wallet -= amount;
  state.investments.push({
    id: uid(),
    planId,
    principal: amount,
    earnings: 0,
    daysElapsed: 0,
    createdAt: new Date().toISOString()
  });
  addTransaction("Invest", plan.asset, amount, "Active");
  notify(`${plan.name} started with ${currency.format(amount)}.`);
  render();
}

function simulateDay() {
  let earned = 0;
  state.investments = state.investments.map((item) => {
    const plan = getPlan(item.planId);
    if (item.daysElapsed >= plan.term) {
      return item;
    }
    const daily = item.principal * plan.dailyRate;
    earned += daily;
    return {
      ...item,
      earnings: item.earnings + daily,
      daysElapsed: item.daysElapsed + 1
    };
  });

  if (earned > 0) {
    addTransaction("Yield", "Portfolio", earned, "Unlocked");
    notify(`Simulated growth added ${currency.format(earned)}.`);
  } else {
    notify("All active plans have reached their demo terms.");
  }
  render();
}

function deposit(asset, amount) {
  if (amount < 25) {
    notify("Minimum demo deposit is $25.");
    return;
  }
  state.wallet += amount;
  addTransaction("Deposit", asset, amount, "Completed");
  notify(`${currency.format(amount)} added to wallet.`);
  render();
}

function withdraw(destination, amount) {
  const total = totals();
  if (amount < 10) {
    notify("Minimum demo withdrawal is $10.");
    return;
  }
  if (amount > total.withdrawable) {
    notify("Withdrawal amount is higher than unlocked earnings.");
    return;
  }

  let remaining = amount;
  state.investments = state.investments.map((item) => {
    const deduction = Math.min(item.earnings, remaining);
    remaining -= deduction;
    return { ...item, earnings: item.earnings - deduction };
  });
  state.withdrawn += amount;
  addTransaction("Withdraw", destination, amount, "Processing");
  els.approvalTitle.textContent = "Withdrawal submitted";
  els.approvalText.textContent = `${currency.format(amount)} is queued to ${destination}. Demo approval is shown at 68%.`;
  els.approvalProgress.style.width = "68%";
  notify("Withdrawal request logged.");
  render();
}

function refreshRates() {
  state.markets = state.markets.map(([symbol, price, change]) => {
    if (symbol === "USD") return [symbol, price, 0];
    const nextChange = Math.max(-4.5, Math.min(4.5, change + (Math.random() - 0.48) * 1.6));
    const nextPrice = Math.max(0.0001, price * (1 + nextChange / 800));
    return [symbol, nextPrice, nextChange];
  });
  notify("Demo rates refreshed.");
  render();
}

function drawChart() {
  const ctx = els.chart.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = els.chart.getBoundingClientRect();
  els.chart.width = Math.floor(rect.width * ratio);
  els.chart.height = Math.floor(320 * ratio);
  ctx.scale(ratio, ratio);

  const width = rect.width;
  const height = 320;
  ctx.clearRect(0, 0, width, height);

  const range = Number(document.querySelector("#chartRange").value);
  const total = totals();
  const avgDailyRate = state.investments.length
    ? state.investments.reduce((sum, item) => sum + getPlan(item.planId).dailyRate, 0) / state.investments.length
    : 0.003;
  const points = Array.from({ length: 12 }, (_, index) => {
    const day = (range / 11) * index;
    return total.portfolio + total.activePrincipal * avgDailyRate * day;
  });
  const max = Math.max(...points) * 1.04;
  const min = Math.min(...points) * 0.98;
  const xStep = width / (points.length - 1);

  ctx.strokeStyle = "#dbe5e1";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = 28 + i * 58;
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(width - 20, y);
    ctx.stroke();
  }

  const coords = points.map((value, index) => {
    const x = index * xStep;
    const y = height - 30 - ((value - min) / (max - min || 1)) * (height - 64);
    return [x, y];
  });

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(31, 163, 125, 0.32)");
  gradient.addColorStop(1, "rgba(31, 163, 125, 0)");
  ctx.beginPath();
  coords.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  coords.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.strokeStyle = "#12735d";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.stroke();

  const [lastX, lastY] = coords.at(-1);
  ctx.fillStyle = "#d99b29";
  ctx.beginPath();
  ctx.arc(lastX - 2, lastY, 6, 0, Math.PI * 2);
  ctx.fill();
}

function notify(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

document.addEventListener("submit", (event) => {
  const investForm = event.target.closest("[data-invest-form]");
  if (investForm) {
    event.preventDefault();
    invest(investForm.dataset.investForm, Number(investForm.querySelector("input").value));
  }
});

document.querySelector("#depositForm").addEventListener("submit", (event) => {
  event.preventDefault();
  deposit(document.querySelector("#depositAsset").value, Number(document.querySelector("#depositAmount").value));
});

document.querySelector("#withdrawForm").addEventListener("submit", (event) => {
  event.preventDefault();
  withdraw(document.querySelector("#withdrawDestination").value, Number(document.querySelector("#withdrawAmount").value));
});

document.querySelector("#simulateDay").addEventListener("click", simulateDay);
document.querySelector("#refreshRates").addEventListener("click", refreshRates);
document.querySelector("#chartRange").addEventListener("change", drawChart);
window.addEventListener("resize", drawChart);

document.querySelector("#resetDemo").addEventListener("click", () => {
  state = structuredClone(initialState);
  notify("Demo data reset.");
  render();
});

document.querySelectorAll("[data-nav]").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll("[data-nav]").forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
  });
});

render();
