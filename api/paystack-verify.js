const { getMethod, json } = require("./_utils");
const {
  appendPaymentRecord,
  readPayments,
  writePayments
} = require("./_invoice-storage");

module.exports = async function handler(req, res) {
  if (getMethod(req) !== "GET") {
    return json(res, 405, { error: "Method not allowed" }, { Allow: "GET" });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return json(res, 500, {
      error: "PAYSTACK_SECRET_KEY is not set on the server. Add it as an environment variable in Vercel."
    });
  }

  const reference = String((req.query && req.query.reference) || "").trim();
  if (!reference) {
    return json(res, 400, { error: "Missing reference" });
  }

  try {
    const resp = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`
      }
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data) {
      return json(res, resp.status || 502, {
        error: "Paystack verify failed",
        details: data && data.message ? data.message : data || "Unknown error"
      });
    }

    const tx = data.data || {};
    const verified = data.status === true && tx.status === "success";
    const metadata = tx.metadata || {};

    if (verified) {
      const paymentType = String(metadata.payment_type || (metadata.invoiceId ? "invoice" : "academy_checkout")).trim() || "academy_checkout";
      const payments = await readPayments();
      const updatedPayments = appendPaymentRecord(payments, {
        reference: tx.reference || reference,
        paymentType,
        source: paymentType === "support" ? String(metadata.support_source || "studio") : paymentType === "academy_checkout" ? "academy" : "invoice",
        status: String(tx.status || "unknown"),
        amount: Math.round((Number(tx.amount) || 0) / 100),
        currency: String(tx.currency || "NGN"),
        customerEmail: String(tx.customer?.email || metadata?.customer?.email || metadata?.donor?.email || ""),
        customerName: String(tx.customer?.first_name || metadata?.customer?.fullName || metadata?.donor?.fullName || ""),
        invoiceId: String(metadata.invoiceId || ""),
        invoiceNumber: String(metadata.invoiceNumber || ""),
        chargeType: String(metadata.chargeType || ""),
        gatewayResponse: String(tx.gateway_response || ""),
        channel: String(tx.channel || ""),
        paidAt: tx.paid_at || new Date().toISOString(),
        metadata
      });
      await writePayments(updatedPayments);
    }

    return json(res, 200, {
      ok: true,
      verified,
      reference: tx.reference || reference,
      status: tx.status,
      amount: tx.amount,
      currency: tx.currency,
      paid_at: tx.paid_at,
      gateway_response: tx.gateway_response,
      customer: tx.customer,
      metadata: tx.metadata
    });
  } catch (err) {
    return json(res, 500, {
      error: "Server error while contacting Paystack",
      details: err && err.message ? err.message : String(err)
    });
  }
};
