const {
  isAuthorized,
  json,
  readInvoices,
  writeInvoices
} = require("../_invoice-storage");
const { getMethod } = require("../_utils");

module.exports = async function handler(req, res) {
  const method = getMethod(req);
  const id = String(req.query?.id || "").trim();

  if (!id) {
    return json(res, 400, { error: "Invoice id is required." });
  }

  try {
    if (method === "GET") {
      const invoices = await readInvoices();
      const invoice = invoices.find((item) => item.id === id);
      return invoice
        ? json(res, 200, { ok: true, invoice })
        : json(res, 404, { error: "Invoice not found." });
    }

    if (!isAuthorized(req)) {
      return json(res, 403, { error: "Unauthorized invoice request." });
    }

    if (method === "DELETE") {
      const invoices = await readInvoices();
      const filtered = invoices.filter((item) => item.id !== id);
      if (filtered.length === invoices.length) {
        return json(res, 404, { error: "Invoice not found." });
      }

      await writeInvoices(filtered);
      return json(res, 200, { ok: true, deletedId: id });
    }

    return json(res, 405, { error: "Method not allowed." }, { Allow: "GET, DELETE" });
  } catch (error) {
    return json(res, 500, { error: error.message || "Invoice request failed." });
  }
};
