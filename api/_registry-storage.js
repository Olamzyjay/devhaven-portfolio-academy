const { del, get, list, put } = require("@vercel/blob");
const seedProjects = require("./_registry-seed");

const REGISTRY_PATH = "devhaven-storage/registry-projects.json";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function json(res, status, payload, extraHeaders = {}) {
  res.status(status);
  Object.entries({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders
  }).forEach(([key, value]) => res.setHeader(key, value));
  res.send(JSON.stringify(payload));
}

function ensureBlobConfigured() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set on the server. Add Vercel Blob before using the live registry.");
  }
}

async function findBlob(pathname) {
  ensureBlobConfigured();
  const { blobs = [] } = await list({ prefix: pathname, limit: 20 });
  const matches = blobs
    .filter((blob) => blob.pathname === pathname)
    .sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());
  return matches[0] || null;
}

async function readJsonBlob(pathname, fallback = []) {
  const blob = await findBlob(pathname);
  if (!blob) {
    return clone(fallback);
  }
  const result = await get(blob.url);
  const text = await new Response(result.body).text();
  if (!text.trim()) {
    return clone(fallback);
  }
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : clone(fallback);
  } catch {
    return clone(fallback);
  }
}

async function writeJsonBlob(pathname, payload) {
  ensureBlobConfigured();
  const { blobs = [] } = await list({ prefix: pathname, limit: 20 });
  const matches = blobs.filter((blob) => blob.pathname === pathname);
  if (matches.length) {
    await del(matches.map((blob) => blob.url));
  }
  await put(pathname, JSON.stringify(payload, null, 2), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json"
  });
  return payload;
}

function getRegistryAdminKey() {
  return process.env.DEVHAVEN_REGISTRY_ADMIN_KEY || process.env.DEVHAVEN_INVOICE_ADMIN_KEY || "";
}

function isAuthorized(req) {
  const expected = getRegistryAdminKey();
  const received = req.headers["x-devhaven-key"] || "";
  return Boolean(expected) && received === expected;
}

function slugify(value) {
  return String(value || "project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || `project-${Date.now()}`;
}

function normalizeProject(project = {}, existing = null) {
  const now = new Date().toISOString();
  const id = String(project.id || existing?.id || slugify(project.client || project.domain || now)).trim();
  return {
    id,
    domain: String(project.domain || "").trim(),
    client: String(project.client || "").trim(),
    type: String(project.type || "").trim(),
    category: String(project.category || "").trim(),
    url: String(project.url || "").trim(),
    status: String(project.status || "Live").trim(),
    description: String(project.description || "").trim(),
    screenshot: String(project.screenshot || "").trim(),
    featured: project.featured === true || project.featured === "true" || project.featured === "on",
    stack: String(project.stack || "").trim(),
    seoTitle: String(project.seoTitle || "").trim(),
    seoDescription: String(project.seoDescription || "").trim(),
    seoKeywords: String(project.seoKeywords || "").trim(),
    canonical: String(project.canonical || "").trim(),
    notes: String(project.notes || "").trim(),
    updatedAt: now,
    createdAt: existing?.createdAt || project.createdAt || now
  };
}

async function readProjects() {
  const projects = await readJsonBlob(REGISTRY_PATH, []);
  if (!Array.isArray(projects) || !projects.length) {
    return clone(seedProjects);
  }

  const merged = new Map(projects.map((project) => [project.id, project]));
  seedProjects.forEach((project) => {
    merged.set(project.id, {
      ...(merged.get(project.id) || {}),
      ...project
    });
  });

  return Array.from(merged.values());
}

async function writeProjects(projects) {
  return writeJsonBlob(REGISTRY_PATH, Array.isArray(projects) ? projects : clone(seedProjects));
}

module.exports = {
  ensureBlobConfigured,
  getRegistryAdminKey,
  isAuthorized,
  json,
  normalizeProject,
  readProjects,
  writeProjects
};
