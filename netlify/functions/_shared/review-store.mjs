import { getStore } from "@netlify/blobs";

const REVIEW_STORE_NAME = "devhaven-live-reviews";
const REVIEW_LIST_KEY = "reviews";
const IMAGE_STORE_NAME = "devhaven-review-images";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp"
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function getReviewStore() {
  return getStore({ name: REVIEW_STORE_NAME, consistency: "strong" });
}

function getImageStore() {
  return getStore({ name: IMAGE_STORE_NAME, consistency: "strong" });
}

function safeIdSegment(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function makeReviewId(source = "") {
  const cleaned = safeIdSegment(source);
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return cleaned ? `review-${cleaned}-${stamp}-${random}` : `review-${stamp}-${random}`;
}

function getImageExtension(contentType) {
  switch (contentType) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

function trimText(value, max = 4000) {
  return String(value || "").trim().slice(0, max);
}

function normalizeRating(value) {
  const rating = Number(value);
  if (!Number.isFinite(rating)) return 0;
  return Math.min(5, Math.max(1, Math.round(rating)));
}

function publicImageUrl(imageKey = "") {
  return imageKey ? `/api/reviews/image/${encodeURIComponent(imageKey)}` : "";
}

export function getReviewAdminKey() {
  return Netlify.env.get("DEVHAVEN_REVIEW_ADMIN_KEY")
    || Netlify.env.get("DEVHAVEN_REGISTRY_ADMIN_KEY")
    || Netlify.env.get("DEVHAVEN_INVOICE_ADMIN_KEY")
    || "";
}

export function isAuthorized(request) {
  const expected = getReviewAdminKey();
  const received = request.headers.get("x-devhaven-key") || "";
  return Boolean(expected) && received === expected;
}

export function unauthorizedResponse() {
  return json({ error: "Unauthorized review request." }, 403);
}

export async function readReviews() {
  const store = getReviewStore();
  const saved = await store.get(REVIEW_LIST_KEY, { type: "json" });
  return Array.isArray(saved) ? saved : [];
}

export async function writeReviews(reviews) {
  const store = getReviewStore();
  await store.setJSON(REVIEW_LIST_KEY, reviews);
  return reviews;
}

export function serializeReview(review, { includeAdmin = false } = {}) {
  const base = {
    id: review.id,
    clientName: review.clientName,
    clientRole: review.clientRole,
    clientEmail: review.clientEmail,
    organization: review.organization,
    projectName: review.projectName,
    projectCategory: review.projectCategory,
    projectUrl: review.projectUrl,
    reviewText: review.reviewText,
    rating: review.rating,
    imageKey: review.imageKey,
    imageUrl: publicImageUrl(review.imageKey),
    status: review.status,
    submittedAt: review.submittedAt,
    approvedAt: review.approvedAt,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt
  };

  if (includeAdmin) {
    return {
      ...base,
      adminNotes: review.adminNotes || ""
    };
  }

  return base;
}

export function normalizeReview(input = {}, existingReview = null) {
  const now = new Date().toISOString();
  const id = trimText(input.id || existingReview?.id || makeReviewId(input.clientName || input.organization), 96);
  const status = String(input.status || existingReview?.status || "pending").trim().toLowerCase();

  const review = {
    id,
    clientName: trimText(input.clientName, 120),
    clientRole: trimText(input.clientRole, 120),
    clientEmail: trimText(input.clientEmail, 160),
    organization: trimText(input.organization, 160),
    projectName: trimText(input.projectName, 160),
    projectCategory: trimText(input.projectCategory, 120),
    projectUrl: trimText(input.projectUrl, 240),
    reviewText: trimText(input.reviewText, 2400),
    rating: normalizeRating(input.rating),
    imageKey: trimText(input.imageKey || existingReview?.imageKey, 240),
    status: ["pending", "approved", "rejected"].includes(status) ? status : "pending",
    adminNotes: trimText(input.adminNotes || existingReview?.adminNotes, 1000),
    submittedAt: existingReview?.submittedAt || now,
    approvedAt: input.status === "approved"
      ? (existingReview?.approvedAt || now)
      : (status === "approved" ? (existingReview?.approvedAt || now) : ""),
    createdAt: existingReview?.createdAt || now,
    updatedAt: now
  };

  return review;
}

export function validatePublicReviewPayload(payload) {
  const requiredFields = [
    "clientName",
    "clientRole",
    "clientEmail",
    "organization",
    "projectName",
    "projectCategory",
    "reviewText",
    "rating"
  ];

  const missing = requiredFields.find((field) => !trimText(payload?.[field]));
  if (missing) {
    return `${missing} is required.`;
  }

  if (!payload?.imageDataUrl) {
    return "Client image is required.";
  }

  if (!normalizeRating(payload.rating)) {
    return "Rating must be between 1 and 5.";
  }

  return "";
}

export function parseImageDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Uploaded image format is invalid.");
  }

  const [, contentType, encoded] = match;
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new Error("Only JPG, PNG, or WebP images are allowed.");
  }

  const buffer = Buffer.from(encoded, "base64");
  if (!buffer.byteLength || buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Image must be under 4 MB.");
  }

  return { contentType, buffer };
}

export async function saveReviewImage(reviewId, dataUrl) {
  const { contentType, buffer } = parseImageDataUrl(dataUrl);
  const extension = getImageExtension(contentType);
  const imageKey = `review-${safeIdSegment(reviewId)}-${Date.now()}.${extension}`;
  const store = getImageStore();

  await store.set(imageKey, buffer, {
    metadata: {
      contentType,
      reviewId,
      uploadedAt: new Date().toISOString()
    }
  });

  return imageKey;
}

export async function deleteReviewImage(imageKey) {
  if (!imageKey) return;
  const store = getImageStore();
  await store.delete(imageKey);
}

export async function readReviewImage(imageKey) {
  if (!imageKey) return null;
  const store = getImageStore();
  return store.getWithMetadata(imageKey, { type: "arrayBuffer" });
}

export function reviewImageResponse(found) {
  if (!found) {
    return new Response("Image not found.", { status: 404 });
  }

  const contentType = found.metadata?.contentType || "application/octet-stream";
  return new Response(found.data, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=604800, immutable"
    }
  });
}

export function sortReviews(reviews) {
  return clone(reviews).sort((a, b) => {
    const aDate = new Date(a.approvedAt || a.submittedAt || a.createdAt || 0).getTime();
    const bDate = new Date(b.approvedAt || b.submittedAt || b.createdAt || 0).getTime();
    return bDate - aDate;
  });
}

export { json };
