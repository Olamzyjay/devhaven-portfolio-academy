const { getMethod, readBody } = require("../_utils");
const {
  isAuthorized,
  json,
  normalizeProject,
  readProjects,
  writeProjects
} = require("../_registry-storage");

module.exports = async function handler(req, res) {
  const method = getMethod(req);

  try {
    if (method === "GET") {
      const projects = await readProjects();
      return json(res, 200, { ok: true, projects });
    }

    if (!isAuthorized(req)) {
      return json(res, 403, { error: "Unauthorized registry request." });
    }

    if (method === "POST") {
      const payload = readBody(req);
      if (payload === null) {
        return json(res, 400, { error: "Invalid JSON request body." });
      }
      if (!payload?.client || !payload?.type) {
        return json(res, 400, { error: "client and type are required." });
      }

      const projects = await readProjects();
      const existing = payload.id ? projects.find((item) => item.id === payload.id) : null;
      const nextProject = normalizeProject(payload, existing);
      const index = projects.findIndex((item) => item.id === nextProject.id);
      if (index >= 0) {
        projects[index] = nextProject;
      } else {
        projects.unshift(nextProject);
      }

      await writeProjects(projects);
      return json(res, 200, { ok: true, project: nextProject, projects });
    }

    if (method === "PUT") {
      const payload = readBody(req);
      if (payload === null || !Array.isArray(payload?.projects)) {
        return json(res, 400, { error: "projects array is required." });
      }
      const projects = payload.projects.map((project) => normalizeProject(project));
      await writeProjects(projects);
      return json(res, 200, { ok: true, projects });
    }

    return json(res, 405, { error: "Method not allowed." }, { Allow: "GET, POST, PUT" });
  } catch (error) {
    return json(res, 500, { error: error.message || "Registry request failed." });
  }
};
