function json(res, status, payload, extraHeaders = {}) {
  res.status(status);
  Object.entries({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders
  }).forEach(([key, value]) => res.setHeader(key, value));
  res.send(JSON.stringify(payload));
}

function getMethod(req) {
  return String(req.method || "GET").toUpperCase();
}

function readBody(req) {
  if (!req.body) {
    return {};
  }
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return req.body;
}

module.exports = {
  getMethod,
  json,
  readBody
};
