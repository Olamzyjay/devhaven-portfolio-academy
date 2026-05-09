const crypto = require("crypto");
const { getMethod } = require("./_utils");

module.exports = async function handler(req, res) {
  if (getMethod(req) !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const secret = process.env.PAYSTACK_SECRET_KEY;
  const signature = req.headers["x-paystack-signature"];
  const bodyString = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});

  const hash = crypto
    .createHmac("sha512", secret)
    .update(bodyString)
    .digest("hex");

  if (hash !== signature) {
    res.status(401).send("Invalid signature");
    return;
  }

  const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

  if (payload.event === "charge.success") {
    const payment = payload.data;

    const reference = payment.reference;
    const amountPaid = payment.amount / 100;
    const customerEmail = payment.customer?.email;
    const status = payment.status;

    console.log("Payment successful:", {
      reference,
      amountPaid,
      customerEmail,
      status,
    });

    /*
      TODO:
      Update your invoice record here.

      Example logic:
      - Find invoice by payment.reference
      - Confirm amount matches invoice amount
      - Mark invoice as paid
      - Save paid_at date
    */
  }

  res.status(200).send("Webhook received");
};
