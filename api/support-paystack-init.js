const { getMethod, json, readBody } = require("./_utils");

function getBaseUrl(req) {
  const host = req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const safeProto = proto === "http" ? "http" : "https";
  return host ? `${safeProto}://${host}` : "";
}

module.exports = async function handler(req, res) {
  if (getMethod(req) !== "POST") {
    return json(res, 405, { error: "Method not allowed" }, { Allow: "POST" });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return json(res, 500, {
      error: "PAYSTACK_SECRET_KEY is not set on the server. Add it as an environment variable in Vercel."
    });
  }

  const payload = readBody(req);
  if (payload === null) {
    return json(res, 400, { error: "Invalid JSON request body" });
  }

  const donor = payload && typeof payload.donor === "object" ? payload.donor : {};
  const email = String(donor.email || "").trim();
  const fullName = String(donor.fullName || "").trim();
  const note = String(donor.note || "").trim();
  const source = String(payload.source || "studio").trim() || "studio";
  const amountNgn = Math.round(Number(payload.amount) || 0);

  if (!email || !email.includes("@")) {
    return json(res, 400, { error: "A valid email is required for support payment." });
  }

  if (!Number.isFinite(amountNgn) || amountNgn < 1000) {
    return json(res, 400, { error: "Support amount must be at least NGN 1,000." });
  }

  const amountKobo = Math.round(amountNgn * 100);
  const baseUrl = getBaseUrl(req);
  const callbackUrl = baseUrl ? `${baseUrl}/payment-success.html?support=1&source=${encodeURIComponent(source)}` : undefined;

  try {
    const resp = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        amount: String(amountKobo),
        currency: "NGN",
        callback_url: callbackUrl,
        metadata: {
          payment_type: "support",
          support_source: source,
          note,
          custom_fields: [
            { display_name: "Supporter Name", variable_name: "supporter_name", value: fullName || "Supporter" },
            { display_name: "Support Source", variable_name: "support_source", value: source },
            { display_name: "Support Note", variable_name: "support_note", value: note || "General support" }
          ]
        }
      })
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data || data.status !== true) {
      return json(res, resp.status || 502, {
        error: "Paystack initialize failed",
        details: data && data.message ? data.message : data || "Unknown error"
      });
    }

    return json(res, 200, {
      authorization_url: data.data && data.data.authorization_url,
      access_code: data.data && data.data.access_code,
      reference: data.data && data.data.reference,
      amount: amountNgn,
      currency: "NGN"
    });
  } catch (err) {
    return json(res, 500, {
      error: "Server error while contacting Paystack",
      details: err && err.message ? err.message : String(err)
    });
  }
};
