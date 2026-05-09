const {
  isAuthorized,
  json,
  normalizeInvoice,
  readInvoices,
  writeInvoices
} = require("../_invoice-storage");
const { getMethod, readBody } = require("../_utils");

module.exports = async function handler(req, res) {
  const method = getMethod(req);

  try {
    if (method === "GET") {
      if (!isAuthorized(req)) {
        return json(res, 403, { error: "Unauthorized invoice request." });
      }

      const invoices = await readInvoices();
      return json(res, 200, { ok: true, invoices });
    }

    if (!isAuthorized(req)) {
      return json(res, 403, { error: "Unauthorized invoice request." });
    }

    if (method === "POST") {
      const payload = readBody(req);
      if (payload === null) {
        return json(res, 400, { error: "Invalid JSON request body." });
      }
      if (!payload?.clientName || !payload?.projectTitle || !payload?.totalAmount) {
        return json(res, 400, { error: "clientName, projectTitle, and totalAmount are required." });
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
      return json(res, 200, { ok: true, invoice: nextInvoice });
    }

    if (method === "PUT") {
      const payload = readBody(req);
      if (payload === null || !Array.isArray(payload?.invoices)) {
        return json(res, 400, { error: "invoices array is required." });
      }
      const invoices = payload.invoices.map((invoice) => normalizeInvoice(invoice));
      await writeInvoices(invoices);
      return json(res, 200, { ok: true, invoices });
    }

    return json(res, 405, { error: "Method not allowed." }, { Allow: "GET, POST, PUT" });
  } catch (error) {
    return json(res, 500, { error: error.message || "Invoice request failed." });
  }
};
