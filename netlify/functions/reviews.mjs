import {
  deleteReviewImage,
  isAuthorized,
  json,
  normalizeReview,
  readReviews,
  saveReviewImage,
  serializeReview,
  sortReviews,
  unauthorizedResponse,
  validatePublicReviewPayload,
  writeReviews
} from "./_shared/review-store.mjs";

export default async (request, context) => {
  const id = context.params?.id ? String(context.params.id).trim() : "";

  if (id === "auth") {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }

    if (!isAuthorized(request)) {
      return json({ error: "That review admin key is not correct." }, 403);
    }

    return json({ ok: true });
  }

  if (request.method === "GET") {
    const reviews = sortReviews(await readReviews());
    if (id) {
      const review = reviews.find((item) => item.id === id);
      if (!review) {
        return json({ error: "Review not found." }, 404);
      }

      if (review.status !== "approved" && !isAuthorized(request)) {
        return unauthorizedResponse();
      }

      return json({ ok: true, review: serializeReview(review, { includeAdmin: isAuthorized(request) }) });
    }

    if (isAuthorized(request)) {
      return json({
        ok: true,
        reviews: reviews.map((item) => serializeReview(item, { includeAdmin: true }))
      });
    }

    return json({
      ok: true,
      reviews: reviews
        .filter((item) => item.status === "approved")
        .map((item) => serializeReview(item))
    });
  }

  if (request.method === "POST") {
    const payload = await request.json().catch(() => null);
    const error = validatePublicReviewPayload(payload);
    if (error) {
      return json({ error }, 400);
    }

    const reviews = await readReviews();
    const draft = normalizeReview({
      ...payload,
      status: "pending"
    });

    const imageKey = await saveReviewImage(draft.id, payload.imageDataUrl);
    const review = normalizeReview({
      ...payload,
      id: draft.id,
      imageKey,
      status: "pending"
    }, draft);

    reviews.unshift(review);
    await writeReviews(reviews);

    return json({
      ok: true,
      message: "Thanks. Your review has been sent for approval.",
      review: serializeReview(review)
    }, 201);
  }

  if (!isAuthorized(request)) {
    return unauthorizedResponse();
  }

  if (request.method === "PATCH") {
    if (!id) {
      return json({ error: "Review id is required." }, 400);
    }

    const payload = await request.json().catch(() => null);
    const reviews = await readReviews();
    const index = reviews.findIndex((item) => item.id === id);
    if (index < 0) {
      return json({ error: "Review not found." }, 404);
    }

    const existing = reviews[index];
    const nextStatus = payload?.status || existing.status;
    const nextReview = normalizeReview({
      ...existing,
      ...payload,
      status: nextStatus
    }, existing);

    if (nextStatus === "approved" && !nextReview.approvedAt) {
      nextReview.approvedAt = new Date().toISOString();
    }
    if (nextStatus !== "approved") {
      nextReview.approvedAt = "";
    }

    reviews[index] = nextReview;
    await writeReviews(reviews);

    return json({ ok: true, review: serializeReview(nextReview, { includeAdmin: true }) });
  }

  if (request.method === "DELETE") {
    if (!id) {
      return json({ error: "Review id is required." }, 400);
    }

    const reviews = await readReviews();
    const target = reviews.find((item) => item.id === id);
    if (!target) {
      return json({ error: "Review not found." }, 404);
    }

    const filtered = reviews.filter((item) => item.id !== id);
    await writeReviews(filtered);
    await deleteReviewImage(target.imageKey);
    return json({ ok: true, deletedId: id });
  }

  return json({ error: "Method not allowed." }, 405);
};

export const config = {
  path: ["/api/reviews", "/api/reviews/:id"],
  method: ["GET", "POST", "PATCH", "DELETE"]
};
