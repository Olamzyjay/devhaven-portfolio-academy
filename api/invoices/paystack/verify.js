const { getMethod, json } = require("../../_utils");
const {
  appendPayment,
  appendPaymentRecord,
  readInvoices,
  readPayments,
  writeInvoices,
  writePayments
} = require("../../_invoice-storage");

module.exports = async function handler(req, res) {
  if (getMethod(req) !== "GET") {
    return json(res, 405, { error: "Method not allowed." }, { Allow: "GET" });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return json(res, 500, { error: "PAYSTACK_SECRET_KEY is not set on the server. Add it as an environment variable in Vercel." });
  }

  const reference = String(req.query?.reference || "").trim();
  if (!reference) {
    return json(res, 400, { error: "Payment reference is required." });
  }

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` }
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.status || !data?.data) {
      return json(res, response.status || 502, {
        error: "Could not verify Paystack payment.",
        details: data?.message || "Unknown error"
      });
    }

    const transaction = data.data;
    const metadata = transaction.metadata || {};
    const invoiceId = String(metadata.invoiceId || "").trim();

    if (!invoiceId) {
      return json(res, 400, { error: "This payment is not attached to a saved invoice." });
    }

    const invoices = await readInvoices();
    const index = invoices.findIndex((item) => item.id === invoiceId);
    if (index < 0) {
      return json(res, 404, { error: "Invoice not found for this payment." });
    }

    const existing = invoices[index];
    const nextInvoice = appendPayment(existing, {
      reference,
      status: transaction.status === "success" ? "success" : String(transaction.status || "unknown"),
      amount: Math.round((Number(transaction.amount) || 0) / 100),
      paidAt: transaction.paid_at || new Date().toISOString(),
      chargeType: String(metadata.chargeType || "full"),
      channel: String(transaction.channel || ""),
      gatewayResponse: String(transaction.gateway_response || "")
    });

    invoices[index] = nextInvoice;
    await writeInvoices(invoices);

    const payments = await readPayments();
    const updatedPayments = appendPaymentRecord(payments, {
      reference,
      paymentType: "invoice",
      source: "invoice",
      status: String(transaction.status || "unknown"),
      amount: Math.round((Number(transaction.amount) || 0) / 100),
      currency: String(transaction.currency || "NGN"),
      customerEmail: String(transaction.customer?.email || existing.clientEmail || ""),
      customerName: String(existing.clientName || ""),
      invoiceId: existing.id,
      invoiceNumber: existing.invoiceNumber,
      chargeType: String(metadata.chargeType || "full"),
      gatewayResponse: String(transaction.gateway_response || ""),
      channel: String(transaction.channel || ""),
      paidAt: transaction.paid_at || new Date().toISOString(),
      metadata
    });
    await writePayments(updatedPayments);

    return json(res, 200, {
      ok: true,
      invoice: nextInvoice,
      payment: {
        reference,
        status: transaction.status,
        amount: Math.round((Number(transaction.amount) || 0) / 100)
      }
    });
  } catch (error) {
    return json(res, 500, { error: error.message || "Could not verify Paystack invoice payment." });
  }
};
