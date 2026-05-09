/**
 * Netlify Function: /.netlify/functions/paystack-verify?reference=xxxx
 *
 * Verifies a Paystack transaction from the server (keeps secret key private).
 *
 * Env vars:
 * - PAYSTACK_SECRET_KEY (required)
 */

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(payload)
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return json(500, {
      error: "PAYSTACK_SECRET_KEY is not set on the server. Add it as an environment variable in Netlify."
    });
  }

  const reference = String(event.queryStringParameters?.reference || "").trim();
  if (!reference) {
    return json(400, { error: "Missing reference" });
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
      return json(resp.status || 502, {
        error: "Paystack verify failed",
        details: data?.message || data || "Unknown error"
      });
    }

    const tx = data.data || {};
    const verified = data.status === true && tx.status === "success";
    const metadata = tx.metadata || {};

    if (verified) {
      const {
        appendPaymentRecord,
        readPayments,
        writePayments
      } = await import("./_shared/payment-store.mjs");

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

    return json(200, {
      ok: true,
      verified,
      reference: tx.reference || reference,
      status: tx.status,
      amount: tx.amount, // kobo
      currency: tx.currency,
      paid_at: tx.paid_at,
      gateway_response: tx.gateway_response,
      customer: tx.customer,
      metadata: tx.metadata
    });
  } catch (err) {
    return json(500, { error: "Server error while contacting Paystack", details: err?.message || String(err) });
  }
};

