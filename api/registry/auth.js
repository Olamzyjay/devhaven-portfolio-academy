const { getMethod } = require("../_utils");
const { isAuthorized, json } = require("../_registry-storage");

module.exports = async function handler(req, res) {
  if (getMethod(req) !== "POST") {
    return json(res, 405, { error: "Method not allowed." }, { Allow: "POST" });
  }
  if (!isAuthorized(req)) {
    return json(res, 403, { error: "Invalid registry admin key." });
  }
  return json(res, 200, { ok: true });
};
