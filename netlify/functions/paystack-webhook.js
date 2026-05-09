const crypto = require("crypto");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return { statusCode: 500, body: "Missing PAYSTACK_SECRET_KEY" };
  }

  const signature = event.headers["x-paystack-signature"];
  if (!signature || !event.body) {
    return { statusCode: 400, body: "Missing signature or body" };
  }

  const hash = crypto
    .createHmac("sha512", secret)
    .update(event.body)
    .digest("hex");

  if (hash !== signature) {
    return { statusCode: 401, body: "Invalid signature" };
  }

  const payload = JSON.parse(event.body);

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

    const {
      appendPaymentRecord,
      readPayments,
      writePayments
    } = await import("./_shared/payment-store.mjs");

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
      const {
        appendPayment,
        readInvoices,
        writeInvoices
      } = await import("./_shared/invoice-store.mjs");

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

        console.log("Invoice updated from webhook:", {
          invoiceId,
          invoiceNumber: updated.invoiceNumber,
          paymentStatus: updated.paymentStatus,
          paidAmount: updated.paidAmount,
          balanceAmount: updated.balanceAmount
        });
      } else {
        console.warn("Webhook invoice not found for reference:", {
          invoiceId,
          reference
        });
      }
    }
  }

  return {
    statusCode: 200,
    body: "Webhook received",
  };
};
