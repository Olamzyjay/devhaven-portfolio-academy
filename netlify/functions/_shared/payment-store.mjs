import { getStore } from "@netlify/blobs";

const STORE_NAME = "devhaven-live-payments";
const STORE_KEY = "payments";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getPaymentStore() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

function normalizeAmount(value) {
  const amount = Math.round(Number(value) || 0);
  return amount > 0 ? amount : 0;
}

export async function readPayments() {
  const store = getPaymentStore();
  const saved = await store.get(STORE_KEY, { type: "json" });
  return Array.isArray(saved) ? saved : [];
}

export async function writePayments(payments) {
  const store = getPaymentStore();
  await store.setJSON(STORE_KEY, payments);
  return payments;
}

export function normalizePaymentRecord(input = {}, existing = null) {
  const now = new Date().toISOString();
  const metadata = input.metadata && typeof input.metadata === "object" ? clone(input.metadata) : {};

  return {
    reference: String(input.reference || existing?.reference || "").trim(),
    paymentType: String(input.paymentType || existing?.paymentType || "general").trim(),
    source: String(input.source || existing?.source || "").trim(),
    status: String(input.status || existing?.status || "unknown").trim(),
    amount: normalizeAmount(input.amount ?? existing?.amount),
    currency: String(input.currency || existing?.currency || "NGN").trim() || "NGN",
    customerEmail: String(input.customerEmail || existing?.customerEmail || "").trim(),
    customerName: String(input.customerName || existing?.customerName || "").trim(),
    invoiceId: String(input.invoiceId || existing?.invoiceId || "").trim(),
    invoiceNumber: String(input.invoiceNumber || existing?.invoiceNumber || "").trim(),
    chargeType: String(input.chargeType || existing?.chargeType || "").trim(),
    gatewayResponse: String(input.gatewayResponse || existing?.gatewayResponse || "").trim(),
    channel: String(input.channel || existing?.channel || "").trim(),
    paidAt: String(input.paidAt || existing?.paidAt || now).trim(),
    metadata,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

export function appendPaymentRecord(payments = [], input = {}) {
  const list = Array.isArray(payments) ? clone(payments) : [];
  const reference = String(input.reference || "").trim();
  if (!reference) {
    return list;
  }

  const index = list.findIndex((item) => String(item.reference || "").trim() === reference);
  if (index >= 0) {
    list[index] = normalizePaymentRecord(input, list[index]);
  } else {
    list.unshift(normalizePaymentRecord(input));
  }

  return list;
}
