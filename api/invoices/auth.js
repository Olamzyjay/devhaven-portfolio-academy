const { isAuthorized, json } = require("../_invoice-storage");
const { getMethod } = require("../_utils");

module.exports = async function handler(req, res) {
  if (getMethod(req) !== "POST") {
    return json(res, 405, { error: "Method not allowed." }, { Allow: "POST" });
  }

  if (!isAuthorized(req)) {
    return json(res, 403, { error: "Invalid invoice admin key." });
  }

  return json(res, 200, { ok: true });
};
