import {
  readReviewImage,
  reviewImageResponse
} from "./_shared/review-store.mjs";

export default async (request, context) => {
  if (request.method !== "GET") {
    return new Response("Method not allowed.", { status: 405 });
  }

  const key = context.params?.key ? String(context.params.key).trim() : "";
  if (!key) {
    return new Response("Image not found.", { status: 404 });
  }

  const found = await readReviewImage(key);
  return reviewImageResponse(found);
};

export const config = {
  path: "/api/reviews/image/:key",
  method: ["GET"]
};

