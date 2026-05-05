import { getStore } from "@netlify/blobs";
import { networkSeedProjects } from "./network-seed.mjs";

const STORE_NAME = "devhaven-network-registry";
const STORE_KEY = "projects";

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

function getRegistryStore() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

export function getAdminKey() {
  return Netlify.env.get("DEVHAVEN_REGISTRY_ADMIN_KEY") || "";
}

export function isAuthorized(request) {
  const expected = getAdminKey();
  const received = request.headers.get("x-devhaven-key") || "";
  return Boolean(expected) && received === expected;
}

export function unauthorizedResponse() {
  return json({ error: "Unauthorized registry request." }, 403);
}

export async function readProjects() {
  const store = getRegistryStore();
  const saved = await store.get(STORE_KEY, { type: "json" });

  if (Array.isArray(saved)) {
    return saved;
  }

  return clone(networkSeedProjects);
}

export async function writeProjects(projects) {
  const store = getRegistryStore();
  await store.setJSON(STORE_KEY, projects);
  return projects;
}

export function normalizeProject(input = {}) {
  const now = new Date().toISOString();
  const idSource = input.id || input.client || input.domain || `project-${Date.now()}`;
  const id = String(idSource)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || `project-${Date.now()}`;

  return {
    id,
    domain: String(input.domain || "").trim(),
    client: String(input.client || "").trim(),
    type: String(input.type || "").trim(),
    category: String(input.category || "").trim(),
    url: String(input.url || "").trim(),
    status: String(input.status || "Live").trim(),
    description: String(input.description || "").trim(),
    screenshot: String(input.screenshot || "").trim(),
    featured: input.featured === true || input.featured === "true" || input.featured === "on",
    stack: String(input.stack || "").trim(),
    seoTitle: String(input.seoTitle || "").trim(),
    seoDescription: String(input.seoDescription || "").trim(),
    seoKeywords: String(input.seoKeywords || "").trim(),
    canonical: String(input.canonical || "").trim(),
    notes: String(input.notes || "").trim(),
    createdAt: input.createdAt || now,
    updatedAt: now
  };
}

export { json };
