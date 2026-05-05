import { appendPayment, json, readInvoices, writeInvoices } from "./_shared/invoice-store.mjs";

export default async (request) => {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed." }, 405);
  }

  const secretKey = Netlify.env.get("PAYSTACK_SECRET_KEY") || "";
  if (!secretKey) {
    return json({ error: "PAYSTACK_SECRET_KEY is not set on Netlify." }, 500);
  }

  const url = new URL(request.url);
  const reference = String(url.searchParams.get("reference") || "").trim();

  if (!reference) {
    return json({ error: "Payment reference is required." }, 400);
  }

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: {
        Authorization: `Bearer ${secretKey}`
      }
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.status || !data?.data) {
      return json({
        error: "Could not verify Paystack payment.",
        details: data?.message || "Unknown error"
      }, response.status || 502);
    }

    const transaction = data.data;
    const metadata = transaction.metadata || {};
    const invoiceId = String(metadata.invoiceId || "").trim();

    if (!invoiceId) {
      return json({ error: "This payment is not attached to a saved invoice." }, 400);
    }

    const invoices = await readInvoices();
    const index = invoices.findIndex((item) => item.id === invoiceId);
    if (index < 0) {
      return json({ error: "Invoice not found for this payment." }, 404);
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

    return json({
      ok: true,
      invoice: nextInvoice,
      payment: {
        reference,
        status: transaction.status,
        amount: Math.round((Number(transaction.amount) || 0) / 100)
      }
    });
  } catch (error) {
    return json({ error: error?.message || "Could not verify Paystack invoice payment." }, 500);
  }
};

export const config = {
  path: "/api/invoices/paystack/verify",
  method: ["GET"]
};
