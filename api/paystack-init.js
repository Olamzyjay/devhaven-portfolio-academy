const { getMethod, json, readBody } = require("./_utils");

const COURSE_CATALOG = {
  "web-design-starter": {
    id: "web-design-starter",
    title: "Frontend Website Design",
    duration: "6 weeks",
    price: 45000
  },
  "digital-marketing-bootcamp": {
    id: "digital-marketing-bootcamp",
    title: "Digital Marketing for Small Brands",
    duration: "4 weeks",
    price: 35000
  },
  "freelance-launch-lab": {
    id: "freelance-launch-lab",
    title: "Freelance Launch Lab",
    duration: "8 weeks",
    price: 55000
  }
};

function normalizeCart(cart) {
  if (!Array.isArray(cart)) {
    return [];
  }

  return cart
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const id = String(item.id || "").trim();
      const qty = Math.max(1, Number(item.qty) || 1);
      const course = COURSE_CATALOG[id];
      if (!course) return null;
      return {
        id: course.id,
        title: course.title,
        qty,
        unit_price: course.price,
        line_total: course.price * qty
      };
    })
    .filter(Boolean);
}

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

  const customer = payload && typeof payload.customer === "object" ? payload.customer : {};
  const email = String(customer.email || "").trim();
  const fullName = String(customer.fullName || "").trim();
  const phone = String(customer.phone || "").trim();

  if (!email || !email.includes("@")) {
    return json(res, 400, { error: "A valid email is required for Paystack payment." });
  }

  const cartLines = normalizeCart(payload.cart);
  if (cartLines.length === 0) {
    return json(res, 400, { error: "Cart is empty or invalid." });
  }

  const amountNgn = cartLines.reduce((sum, line) => sum + line.line_total, 0);
  if (!Number.isFinite(amountNgn) || amountNgn <= 0) {
    return json(res, 400, { error: "Invalid cart amount." });
  }

  const amountKobo = Math.round(amountNgn * 100);
  const baseUrl = getBaseUrl(req);
  const callbackUrl = baseUrl ? `${baseUrl}/payment-success` : undefined;

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
          custom_fields: [
            { display_name: "Customer Name", variable_name: "customer_name", value: fullName || "Website visitor" },
            { display_name: "Customer Phone", variable_name: "customer_phone", value: phone || "" }
          ],
          cart: cartLines
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
