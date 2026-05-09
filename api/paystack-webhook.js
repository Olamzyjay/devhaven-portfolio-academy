const crypto = require("crypto");
const { getMethod } = require("./_utils");
const {
  appendPayment,
  appendPaymentRecord,
  readInvoices,
  readPayments,
  writeInvoices,
  writePayments
} = require("./_invoice-storage");

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
    const metadata = payment.metadata || {};
    const invoiceId = String(metadata.invoiceId || "").trim();
    const chargeType = String(metadata.chargeType || "full").trim() || "full";
    const paymentType = String(metadata.payment_type || (invoiceId ? "invoice" : "academy_checkout")).trim() || "academy_checkout";

    console.log("Payment successful:", {
      reference,
      amountPaid,
      customerEmail,
      status,
      invoiceId,
      chargeType,
      paymentType
    });

    const payments = await readPayments();
    const updatedPayments = appendPaymentRecord(payments, {
      reference,
      paymentType,
      source: paymentType === "support" ? String(metadata.support_source || "studio") : paymentType === "academy_checkout" ? "academy" : "invoice",
      status: status === "success" ? "success" : String(status || "unknown"),
      amount: Math.round(Number(amountPaid) || 0),
      currency: String(payment.currency || "NGN"),
      customerEmail: String(customerEmail || metadata?.customer?.email || metadata?.donor?.email || ""),
      customerName: String(metadata?.customer?.fullName || metadata?.donor?.fullName || ""),
      invoiceId,
      invoiceNumber: String(metadata.invoiceNumber || ""),
      chargeType,
      gatewayResponse: String(payment.gateway_response || ""),
      channel: String(payment.channel || ""),
      paidAt: payment.paid_at || new Date().toISOString(),
      metadata
    });
    await writePayments(updatedPayments);

    if (invoiceId) {
      const invoices = await readInvoices();
      const index = invoices.findIndex((item) => item.id === invoiceId);

      if (index >= 0) {
        const existing = invoices[index];
        const updated = appendPayment(existing, {
          reference,
          status: status === "success" ? "success" : String(status || "unknown"),
          amount: Math.round(Number(amountPaid) || 0),
          paidAt: payment.paid_at || new Date().toISOString(),
          chargeType,
          channel: String(payment.channel || ""),
          gatewayResponse: String(payment.gateway_response || ""),
          customerEmail: String(customerEmail || ""),
          source: "webhook"
        });

        invoices[index] = updated;
        await writeInvoices(invoices);
      }
    }
  }

  res.status(200).send("Webhook received");
};
