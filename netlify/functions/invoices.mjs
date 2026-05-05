import {
  isAuthorized,
  json,
  normalizeInvoice,
  readInvoices,
  unauthorizedResponse,
  writeInvoices
} from "./_shared/invoice-store.mjs";

export default async (request, context) => {
  const id = context.params?.id ? String(context.params.id).trim() : "";

  if (request.method === "GET") {
    const invoices = await readInvoices();

    if (id) {
      const invoice = invoices.find((item) => item.id === id);
      return invoice
        ? json({ ok: true, invoice })
        : json({ error: "Invoice not found." }, 404);
    }

    if (!isAuthorized(request)) {
      return unauthorizedResponse();
    }

    return json({ ok: true, invoices });
  }

  if (!isAuthorized(request)) {
    return unauthorizedResponse();
  }

  if (request.method === "POST") {
    const payload = await request.json().catch(() => null);
    if (!payload?.clientName || !payload?.projectTitle || !payload?.totalAmount) {
      return json({ error: "clientName, projectTitle, and totalAmount are required." }, 400);
    }

    const invoices = await readInvoices();
    const existing = payload.id ? invoices.find((item) => item.id === payload.id) : null;
    const nextInvoice = normalizeInvoice(payload, existing);
    const index = invoices.findIndex((item) => item.id === nextInvoice.id);

    if (index >= 0) {
      invoices[index] = nextInvoice;
    } else {
      invoices.unshift(nextInvoice);
    }

    await writeInvoices(invoices);
    return json({ ok: true, invoice: nextInvoice });
  }

  if (request.method === "PUT") {
    const payload = await request.json().catch(() => null);
    if (!payload || !Array.isArray(payload.invoices)) {
      return json({ error: "invoices array is required." }, 400);
    }

    const invoices = payload.invoices.map((invoice) => normalizeInvoice(invoice));
    await writeInvoices(invoices);
    return json({ ok: true, invoices });
  }

  if (request.method === "DELETE") {
    if (!id) {
      return json({ error: "Invoice id is required." }, 400);
    }

    const invoices = await readInvoices();
    const filtered = invoices.filter((item) => item.id !== id);
    if (filtered.length === invoices.length) {
      return json({ error: "Invoice not found." }, 404);
    }

    await writeInvoices(filtered);
    return json({ ok: true, deletedId: id });
  }

  return json({ error: "Method not allowed." }, 405);
};

export const config = {
  path: ["/api/invoices", "/api/invoices/:id"],
  method: ["GET", "POST", "PUT", "DELETE"]
};
