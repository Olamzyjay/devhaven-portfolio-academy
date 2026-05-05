const { getMethod, json } = require("./_utils");

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
