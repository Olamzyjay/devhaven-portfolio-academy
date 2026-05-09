const { del, get, list, put } = require("@vercel/blob");

const INVOICE_PATH = "devhaven-storage/invoices.json";
const PAYMENT_PATH = "devhaven-storage/payments.json";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function json(res, status, payload, extraHeaders = {}) {
  res.status(status);
  Object.entries({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders
  }).forEach(([key, value]) => res.setHeader(key, value));
  res.send(JSON.stringify(payload));
}

function ensureBlobConfigured() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set on the server. Add Vercel Blob before using live invoices.");
  }
}

async function findBlob(pathname) {
  ensureBlobConfigured();
  const { blobs = [] } = await list({ prefix: pathname, limit: 20 });
  const matches = blobs
    .filter((blob) => blob.pathname === pathname)
    .sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());
  return matches[0] || null;
}

async function readJsonBlob(pathname, fallback = []) {
  const blob = await findBlob(pathname);
  if (!blob) {
    return clone(fallback);
  }

  const result = await get(blob.url);
  const text = await new Response(result.body).text();
  if (!text.trim()) {
    return clone(fallback);
  }

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(fallback) ? (Array.isArray(parsed) ? parsed : clone(fallback)) : parsed;
  } catch {
    return clone(fallback);
  }
}

async function writeJsonBlob(pathname, payload) {
  ensureBlobConfigured();
  const { blobs = [] } = await list({ prefix: pathname, limit: 20 });
  const matches = blobs.filter((blob) => blob.pathname === pathname);
  if (matches.length) {
    await del(matches.map((blob) => blob.url));
  }

  await put(pathname, JSON.stringify(payload, null, 2), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json"
  });

  return payload;
}

function normalizeAmount(value) {
  const amount = Math.round(Number(value) || 0);
  return amount > 0 ? amount : 0;
}

function makeInvoiceId(source = "") {
  const cleaned = String(source || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const stamp = Date.now().toString().slice(-8);
  return cleaned ? `INV-${cleaned}-${stamp}` : `INV-${stamp}`;
}

function getInvoiceAdminKey() {
  return process.env.DEVHAVEN_INVOICE_ADMIN_KEY || process.env.DEVHAVEN_REGISTRY_ADMIN_KEY || "";
}

function isAuthorized(req) {
  const expected = getInvoiceAdminKey();
  const received = req.headers["x-devhaven-key"] || "";
  return Boolean(expected) && received === expected;
}

function computeInvoiceTotals(invoice) {
  const totalAmount = normalizeAmount(invoice.totalAmount);
  const paymentPlan = invoice.paymentPlan === "split60" ? "split60" : "full";
  const depositPercent = paymentPlan === "split60" ? 60 : 100;
  const depositAmount = paymentPlan === "split60" ? Math.round(totalAmount * 0.6) : totalAmount;
  const deliveryAmount = Math.max(0, totalAmount - depositAmount);
  const payments = Array.isArray(invoice.payments) ? invoice.payments : [];
  const paidAmount = payments.reduce((sum, payment) => {
    if (payment && payment.status === "success") {
      return sum + normalizeAmount(payment.amount);
    }
    return sum;
  }, 0);
  const balanceAmount = Math.max(0, totalAmount - paidAmount);
  const hasDepositCovered = paidAmount >= depositAmount;

  let dueNowAmount = balanceAmount;
  let nextPaymentLabel = "Pay remaining balance";

  if (paymentPlan === "split60") {
    if (!hasDepositCovered) {
      dueNowAmount = Math.max(0, depositAmount - paidAmount);
      nextPaymentLabel = paidAmount > 0 ? "Complete 60% upfront payment" : "Pay 60% upfront";
    } else if (balanceAmount > 0) {
      dueNowAmount = balanceAmount;
      nextPaymentLabel = "Pay remaining 40% on delivery";
    }
  } else if (balanceAmount > 0) {
    nextPaymentLabel = "Pay full invoice";
  }

  let paymentStatus = "sent";
  if (balanceAmount <= 0 && totalAmount > 0) {
    paymentStatus = "paid";
  } else if (paidAmount > 0) {
    paymentStatus = "partly-paid";
  } else if (String(invoice.status || "").toLowerCase() === "draft") {
    paymentStatus = "draft";
  }

  return {
    totalAmount,
    depositPercent,
    depositAmount,
    deliveryAmount,
    paidAmount,
    balanceAmount,
    dueNowAmount,
    nextPaymentLabel,
    paymentPlan,
    paymentStatus,
    hasDepositCovered
  };
}

function normalizeInvoice(input = {}, existingInvoice = null) {
  const now = new Date().toISOString();
  const id = String(input.id || existingInvoice?.id || makeInvoiceId(input.projectTitle || input.clientName)).trim();
  const lineItems = Array.isArray(input.lineItems)
    ? input.lineItems
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const title = String(item.title || "").trim();
          const amount = normalizeAmount(item.amount);
          return title && amount > 0 ? { title, amount } : null;
        })
        .filter(Boolean)
    : [];

  const invoice = {
    id,
    invoiceNumber: String(input.invoiceNumber || existingInvoice?.invoiceNumber || id).trim(),
    clientName: String(input.clientName || "").trim(),
    clientEmail: String(input.clientEmail || "").trim(),
    clientPhone: String(input.clientPhone || "").trim(),
    projectTitle: String(input.projectTitle || "").trim(),
    description: String(input.description || "").trim(),
    currency: "NGN",
    totalAmount: normalizeAmount(input.totalAmount),
    paymentPlan: input.paymentPlan === "split60" ? "split60" : "full",
    issueDate: String(input.issueDate || existingInvoice?.issueDate || now.slice(0, 10)).trim(),
    dueDate: String(input.dueDate || "").trim(),
    status: String(input.status || existingInvoice?.status || "sent").trim(),
    notes: String(input.notes || "").trim(),
    lineItems,
    payments: Array.isArray(existingInvoice?.payments) ? clone(existingInvoice.payments) : [],
    createdAt: existingInvoice?.createdAt || now,
    updatedAt: now
  };

  return {
    ...invoice,
    ...computeInvoiceTotals(invoice)
  };
}

function appendPayment(invoice, payment) {
  const payments = Array.isArray(invoice.payments) ? clone(invoice.payments) : [];
  const alreadyExists = payments.some((item) => item.reference === payment.reference);
  if (!alreadyExists) {
    payments.push(payment);
  }

  return normalizeInvoice({
    ...invoice,
    payments
  }, {
    ...invoice,
    payments,
    createdAt: invoice.createdAt,
    invoiceNumber: invoice.invoiceNumber
  });
}

function normalizePaymentRecord(input = {}, existing = null) {
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

function appendPaymentRecord(payments = [], input = {}) {
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

async function readInvoices() {
  return readJsonBlob(INVOICE_PATH, []);
}

async function writeInvoices(invoices) {
  return writeJsonBlob(INVOICE_PATH, Array.isArray(invoices) ? invoices : []);
}

async function readPayments() {
  return readJsonBlob(PAYMENT_PATH, []);
}

async function writePayments(payments) {
  return writeJsonBlob(PAYMENT_PATH, Array.isArray(payments) ? payments : []);
}

module.exports = {
  appendPayment,
  appendPaymentRecord,
  computeInvoiceTotals,
  ensureBlobConfigured,
  getInvoiceAdminKey,
  isAuthorized,
  json,
  normalizeAmount,
  normalizeInvoice,
  readInvoices,
  readPayments,
  writeInvoices,
  writePayments
};
