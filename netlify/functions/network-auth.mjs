import { getAdminKey, isAuthorized, json } from "./_shared/network-store.mjs";

export default async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const expected = getAdminKey();
  if (!expected) {
    return json({ error: "DEVHAVEN_REGISTRY_ADMIN_KEY is not set." }, 500);
  }

  return isAuthorized(request)
    ? json({ ok: true })
    : json({ error: "Invalid admin key." }, 403);
};

export const config = {
  path: "/api/network/auth"
};
