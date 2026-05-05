import { getStore } from "@netlify/blobs";

const STORE_NAME = "devhaven-live-invoices";
const STORE_KEY = "invoices";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function getInvoiceStore() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
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

export function getInvoiceAdminKey() {
  return Netlify.env.get("DEVHAVEN_INVOICE_ADMIN_KEY")
    || Netlify.env.get("DEVHAVEN_REGISTRY_ADMIN_KEY")
    || "";
}

export function isAuthorized(request) {
  const expected = getInvoiceAdminKey();
  const received = request.headers.get("x-devhaven-key") || "";
  return Boolean(expected) && received === expected;
}

export function unauthorizedResponse() {
  return json({ error: "Unauthorized invoice request." }, 403);
}

export async function readInvoices() {
  const store = getInvoiceStore();
  const saved = await store.get(STORE_KEY, { type: "json" });
  return Array.isArray(saved) ? saved : [];
}

export async function writeInvoices(invoices) {
  const store = getInvoiceStore();
  await store.setJSON(STORE_KEY, invoices);
  return invoices;
}

export function computeInvoiceTotals(invoice) {
  const totalAmount = normalizeAmount(invoice.totalAmount);
  const paymentPlan = invoice.paymentPlan === "split60" ? "split60" : "full";
  const depositPercent = paymentPlan === "split60" ? 60 : 100;
  const depositAmount = paymentPlan === "split60"
    ? Math.round(totalAmount * 0.6)
    : totalAmount;
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

export function normalizeInvoice(input = {}, existingInvoice = null) {
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

export function appendPayment(invoice, payment) {
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

export { json, normalizeAmount };
