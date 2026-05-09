const { getMethod, json, readBody } = require("../../_utils");
const { readInvoices } = require("../../_invoice-storage");

function getBaseUrl(req) {
  const host = req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const safeProto = proto === "http" ? "http" : "https";
  return host ? `${safeProto}://${host}` : "";
}

function amountToKobo(amount) {
  return Math.round(Number(amount) * 100);
}

module.exports = async function handler(req, res) {
  if (getMethod(req) !== "POST") {
    return json(res, 405, { error: "Method not allowed." }, { Allow: "POST" });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return json(res, 500, { error: "PAYSTACK_SECRET_KEY is not set on the server. Add it as an environment variable in Vercel." });
  }

  const payload = readBody(req);
  if (payload === null) {
    return json(res, 400, { error: "Invalid JSON request body." });
  }

  const invoiceId = String(payload?.invoiceId || "").trim();
  const chargeType = String(payload?.chargeType || "due").trim();
  if (!invoiceId) {
    return json(res, 400, { error: "invoiceId is required." });
  }

  try {
    const invoices = await readInvoices();
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (!invoice) {
      return json(res, 404, { error: "Invoice not found." });
    }
    if (!invoice.clientEmail || !invoice.clientEmail.includes("@")) {
      return json(res, 400, { error: "Client email is required before payment can start." });
    }
    if (invoice.balanceAmount <= 0) {
      return json(res, 400, { error: "This invoice is already fully paid." });
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
      return json(res, 400, { error: "There is no payable amount on this invoice right now." });
    }

    const baseUrl = getBaseUrl(req);
    const callbackUrl = `${baseUrl}/invoice?id=${encodeURIComponent(invoice.id)}`;
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
      return json(res, response.status || 502, {
        error: "Paystack invoice payment initialization failed.",
        details: data?.message || "Unknown error"
      });
    }

    return json(res, 200, {
      ok: true,
      authorization_url: data.data?.authorization_url,
      access_code: data.data?.access_code,
      reference: data.data?.reference,
      amount
    });
  } catch (error) {
    return json(res, 500, { error: error.message || "Could not contact Paystack." });
  }
};
