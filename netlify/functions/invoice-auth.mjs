import { isAuthorized, json } from "./_shared/invoice-store.mjs";

export default async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  if (!isAuthorized(request)) {
    return json({ error: "Invalid invoice admin key." }, 403);
  }

  return json({ ok: true });
};

export const config = {
  path: "/api/invoices/auth",
  method: ["POST"]
};
