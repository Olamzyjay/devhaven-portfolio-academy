const { getMethod } = require("../_utils");
const {
  isAuthorized,
  json,
  readProjects,
  writeProjects
} = require("../_registry-storage");

module.exports = async function handler(req, res) {
  const method = getMethod(req);
  const id = String(req.query?.id || "").trim();

  if (!id) {
    return json(res, 400, { error: "Project id is required." });
  }

  try {
    if (method === "GET") {
      const projects = await readProjects();
      const project = projects.find((item) => item.id === id);
      return project
        ? json(res, 200, { ok: true, project })
        : json(res, 404, { error: "Project not found." });
    }

    if (!isAuthorized(req)) {
      return json(res, 403, { error: "Unauthorized registry request." });
    }

    if (method === "DELETE") {
      const projects = await readProjects();
      const filtered = projects.filter((item) => item.id !== id);
      if (filtered.length === projects.length) {
        return json(res, 404, { error: "Project not found." });
      }
      await writeProjects(filtered);
      return json(res, 200, { ok: true, deletedId: id });
    }

    return json(res, 405, { error: "Method not allowed." }, { Allow: "GET, DELETE" });
  } catch (error) {
    return json(res, 500, { error: error.message || "Registry request failed." });
  }
};
