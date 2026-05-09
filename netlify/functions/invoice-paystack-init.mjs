import { json, readInvoices } from "./_shared/invoice-store.mjs";

function getBaseUrl(request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function amountToKobo(amount) {
  return Math.round(Number(amount) * 100);
}

export default async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const secretKey = Netlify.env.get("PAYSTACK_SECRET_KEY") || "";
  if (!secretKey) {
    return json({ error: "PAYSTACK_SECRET_KEY is not set on Netlify." }, 500);
  }

  const payload = await request.json().catch(() => null);
  const invoiceId = String(payload?.invoiceId || "").trim();
  const chargeType = String(payload?.chargeType || "due").trim();

  if (!invoiceId) {
    return json({ error: "invoiceId is required." }, 400);
  }

  const invoices = await readInvoices();
  const invoice = invoices.find((item) => item.id === invoiceId);
  if (!invoice) {
    return json({ error: "Invoice not found." }, 404);
  }

  if (!invoice.clientEmail || !invoice.clientEmail.includes("@")) {
    return json({ error: "Client email is required before payment can start." }, 400);
  }

  if (invoice.balanceAmount <= 0) {
    return json({ error: "This invoice is already fully paid." }, 400);
  }

  let amount = invoice.balanceAmount;
  let label = "full";

  if (invoice.paymentPlan === "split60" && chargeType === "deposit" && !invoice.hasDepositCovered) {
    amount = invoice.dueNowAmount;
    label = "deposit";
  } else if (invoice.paymentPlan === "split60" && chargeType === "balance" && invoice.hasDepositCovered) {
    amount = invoice.balanceAmount;
    label = "balance";
  } else if (chargeType === "full") {
    amount = invoice.balanceAmount;
    label = invoice.paymentPlan === "split60" && !invoice.hasDepositCovered ? "full-from-start" : "full";
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return json({ error: "There is no payable amount on this invoice right now." }, 400);
  }

  const callbackUrl = `${getBaseUrl(request)}/invoice.html?id=${encodeURIComponent(invoice.id)}`;
  const initBody = {
    email: invoice.clientEmail,
    amount: String(amountToKobo(amount)),
    currency: "NGN",
    callback_url: callbackUrl,
    metadata: {
      payment_type: "invoice",
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      chargeType: label,
      clientName: invoice.clientName,
      projectTitle: invoice.projectTitle
    }
  };

  try {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(initBody)
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.status) {
      return json({
        error: "Paystack invoice payment initialization failed.",
        details: data?.message || "Unknown error"
      }, response.status || 502);
    }

    return json({
      ok: true,
      authorization_url: data.data?.authorization_url,
      access_code: data.data?.access_code,
      reference: data.data?.reference,
      amount
    });
  } catch (error) {
    return json({ error: error?.message || "Could not contact Paystack." }, 500);
  }
};

export const config = {
  path: "/api/invoices/paystack/init",
  method: ["POST"]
};
