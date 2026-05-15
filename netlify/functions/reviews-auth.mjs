import { isAuthorized, json } from "./_shared/review-store.mjs";

export default async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  if (!isAuthorized(request)) {
    return json({ error: "That review admin key is not correct." }, 403);
  }

  return json({ ok: true });
};

export const config = {
  path: "/api/reviews/auth",
  method: ["POST"]
};

