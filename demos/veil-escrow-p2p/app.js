const STORE_KEY = "veilEscrowDemo";

const seedOffers = [
  {
    id: "offer-101",
    title: "Sealed electronics parcel",
    category: "Physical goods",
    price: 480,
    crypto: "USDT TRC20",
    window: "48 hours",
    seller: "Seller-8F41",
    terms: "Tracked delivery with photo proof. Buyer confirms after inspection and serial check."
  },
  {
    id: "offer-102",
    title: "Premium design source files",
    category: "Digital goods",
    price: 180,
    crypto: "USDC Polygon",
    window: "2 hours",
    seller: "Seller-A91C",
    terms: "Encrypted archive and hash supplied after funding. Buyer confirms after download opens."
  },
  {
    id: "offer-103",
    title: "Private server hardening",
    category: "Services",
    price: 350,
    crypto: "ETH",
    window: "24 hours",
    seller: "Seller-42D0",
    terms: "Security checklist, screenshots, and final access handoff are attached to delivery proof."
  },
  {
    id: "offer-104",
    title: "Bulk gift card transfer",
    category: "Digital goods",
    price: 700,
    crypto: "BTC",
    window: "1 hour",
    seller: "Seller-71BE",
    terms: "Codes are released inside escrow notes only after network confirmations are detected."
  }
];

const statusCopy = {
  awaiting_deposit: "Awaiting deposit",
  funded: "Funds locked",
  delivered: "Delivered, waiting buyer",
  released: "Released to seller",
  disputed: "Disputed",
  refunded: "Refunded to buyer"
};

let state = loadState();
let activeFilter = "all";

function loadState() {
  const stored = localStorage.getItem(STORE_KEY);
  if (stored) return JSON.parse(stored);

  return {
    identity: createIdentity(),
    offers: seedOffers,
    orders: []
  };
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function createIdentity() {
  const token = Math.random().toString(16).slice(2, 10).toUpperCase();
  return {
    handle: `Buyer-${token.slice(0, 4)}`,
    key: `session:${token.slice(0, 4)}-${token.slice(4)}`
  };
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[character]);
}

function renderIdentity() {
  document.querySelector("#sessionHandle").textContent = state.identity.handle;
  document.querySelector("#sessionKey").textContent = state.identity.key;
}

function renderStats() {
  const locked = state.orders
    .filter((order) => ["funded", "delivered", "disputed"].includes(order.status))
    .reduce((sum, order) => sum + order.price, 0);

  document.querySelector("#lockedTotal").textContent = formatMoney(locked);
  document.querySelector("#openTrades").textContent = state.orders.filter((order) => !["released", "refunded"].includes(order.status)).length;
}

function renderOffers() {
  const grid = document.querySelector("#offerGrid");
  const template = document.querySelector("#offerTemplate");
  grid.innerHTML = "";

  state.offers
    .filter((offer) => activeFilter === "all" || offer.category === activeFilter)
    .forEach((offer) => {
      const node = template.content.cloneNode(true);
      node.querySelector(".category").textContent = offer.category;
      node.querySelector(".seller").textContent = offer.seller;
      node.querySelector("h3").textContent = offer.title;
      node.querySelector("p").textContent = offer.terms;
      node.querySelector(".price").textContent = formatMoney(offer.price);
      node.querySelector(".crypto").textContent = offer.crypto;
      node.querySelector(".window").textContent = offer.window;
      node.querySelector("button").addEventListener("click", () => openEscrow(offer.id));
      grid.appendChild(node);
    });
}

function openEscrow(offerId) {
  const offer = state.offers.find((item) => item.id === offerId);
  const orderId = `ESC-${Date.now().toString().slice(-6)}`;
  state.orders.unshift({
    id: orderId,
    offerId,
    title: offer.title,
    seller: offer.seller,
    buyer: state.identity.handle,
    price: offer.price,
    crypto: offer.crypto,
    status: "awaiting_deposit",
    depositAddress: makeDepositAddress(offer.crypto),
    evidence: "No delivery evidence attached yet.",
    createdAt: new Date().toLocaleString()
  });
  saveAndRender();
  document.querySelector("#orders").scrollIntoView({ behavior: "smooth" });
}

function makeDepositAddress(crypto) {
  const prefix = crypto.includes("BTC") ? "bc1q" : crypto.includes("ETH") || crypto.includes("ERC") ? "0x" : "T";
  return `${prefix}${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 10)}`;
}

function updateOrder(orderId, status) {
  state.orders = state.orders.map((order) => {
    if (order.id !== orderId) return order;
    const evidence = status === "delivered"
      ? "Seller attached encrypted delivery proof, timestamp, and receipt checklist."
      : order.evidence;
    return { ...order, status, evidence };
  });
  saveAndRender();
}

function renderOrders() {
  const list = document.querySelector("#ordersList");
  list.innerHTML = "";

  if (!state.orders.length) {
    list.innerHTML = `<article><p class="muted">No escrow orders yet. Open an offer from the market or start the sample trade.</p></article>`;
    return;
  }

  state.orders.forEach((order) => {
    const article = document.createElement("article");
    article.innerHTML = `
      <div class="order-head">
        <div>
          <span class="status-pill status-${order.status.replace("_", "-")}">${statusCopy[order.status]}</span>
          <h3>${escapeHtml(order.title)}</h3>
        </div>
        <strong>${formatMoney(order.price)}</strong>
      </div>
      <div class="order-meta">
        <div><span>Order</span><strong>${escapeHtml(order.id)}</strong></div>
        <div><span>Buyer</span><strong>${escapeHtml(order.buyer)}</strong></div>
        <div><span>Seller</span><strong>${escapeHtml(order.seller)}</strong></div>
        <div><span>Crypto</span><strong>${escapeHtml(order.crypto)}</strong></div>
        <div><span>Deposit</span><strong>${escapeHtml(order.depositAddress)}</strong></div>
      </div>
      <p class="muted">${escapeHtml(order.evidence)}</p>
      <div class="order-actions"></div>
    `;

    const actions = article.querySelector(".order-actions");
    addActions(actions, order);
    list.appendChild(article);
  });
}

function addActions(actions, order) {
  const transitions = {
    awaiting_deposit: [["Mark deposit confirmed", "funded"]],
    funded: [["Seller marks delivered", "delivered"], ["Open dispute", "disputed"]],
    delivered: [["Buyer confirms receipt and releases", "released"], ["Open dispute", "disputed"]],
    disputed: [["Release to seller", "released"], ["Refund buyer", "refunded"]]
  };

  (transitions[order.status] || []).forEach(([label, status]) => {
    const button = document.createElement("button");
    button.className = status === "released" ? "primary-button" : "ghost-button";
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => updateOrder(order.id, status));
    actions.appendChild(button);
  });
}

function renderDisputes() {
  const panel = document.querySelector("#disputePanel");
  const disputes = state.orders.filter((order) => order.status === "disputed");

  if (!disputes.length) {
    panel.innerHTML = `<p class="muted">No active disputes. Orders appear here when buyer or seller escalates the trade.</p>`;
    return;
  }

  panel.innerHTML = disputes.map((order) => `
    <article class="dispute-item">
      <span class="status-pill status-disputed">Evidence review</span>
      <h3>${escapeHtml(order.id)}: ${escapeHtml(order.title)}</h3>
      <p class="muted">${escapeHtml(order.evidence)}</p>
      <div class="order-actions">
        <button class="primary-button" data-resolve="${order.id}" data-status="released" type="button">Approve release</button>
        <button class="ghost-button" data-resolve="${order.id}" data-status="refunded" type="button">Approve refund</button>
      </div>
    </article>
  `).join("");

  panel.querySelectorAll("[data-resolve]").forEach((button) => {
    button.addEventListener("click", () => updateOrder(button.dataset.resolve, button.dataset.status));
  });
}

function saveAndRender() {
  saveState();
  renderIdentity();
  renderStats();
  renderOffers();
  renderOrders();
  renderDisputes();
}

document.querySelector("#rotateIdentity").addEventListener("click", () => {
  state.identity = createIdentity();
  saveAndRender();
});

document.querySelector("#seedTrade").addEventListener("click", () => {
  openEscrow(state.offers[0].id);
});

document.querySelector("#clearDemo").addEventListener("click", () => {
  localStorage.removeItem(STORE_KEY);
  state = loadState();
  saveAndRender();
});

document.querySelector("#offerForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.offers.unshift({
    id: `offer-${Date.now()}`,
    title: form.get("title").trim(),
    category: form.get("category"),
    price: Number(form.get("price")),
    crypto: form.get("crypto"),
    window: form.get("window").trim(),
    seller: `Seller-${Math.random().toString(16).slice(2, 6).toUpperCase()}`,
    terms: form.get("terms").trim()
  });
  event.currentTarget.reset();
  saveAndRender();
  document.querySelector("#market").scrollIntoView({ behavior: "smooth" });
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    activeFilter = chip.dataset.filter;
    document.querySelectorAll(".chip").forEach((item) => item.classList.remove("active"));
    chip.classList.add("active");
    renderOffers();
  });
});

document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
  });
});

saveAndRender();
