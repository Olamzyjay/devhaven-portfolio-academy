import {
  isAuthorized,
  json,
  normalizeProject,
  readProjects,
  unauthorizedResponse,
  writeProjects
} from "./_shared/network-store.mjs";

export default async (request, context) => {
  const id = context.params?.id ? String(context.params.id).trim() : "";

  if (request.method === "GET") {
    const projects = await readProjects();
    if (id) {
      const project = projects.find((item) => item.id === id);
      return project
        ? json({ ok: true, project })
        : json({ error: "Project not found." }, 404);
    }
    return json({ ok: true, projects });
  }

  if (!isAuthorized(request)) {
    return unauthorizedResponse();
  }

  if (request.method === "POST") {
    const payload = await request.json().catch(() => null);
    if (!payload?.client || !payload?.type) {
      return json({ error: "client and type are required." }, 400);
    }

    const projects = await readProjects();
    const nextProject = normalizeProject(payload);
    const index = projects.findIndex((item) => item.id === nextProject.id);

    if (index >= 0) {
      nextProject.createdAt = projects[index].createdAt || nextProject.createdAt;
      projects[index] = nextProject;
    } else {
      projects.unshift(nextProject);
    }

    await writeProjects(projects);
    return json({ ok: true, project: nextProject });
  }

  if (request.method === "PUT") {
    const payload = await request.json().catch(() => null);
    if (!payload || !Array.isArray(payload.projects)) {
      return json({ error: "projects array is required." }, 400);
    }

    const projects = payload.projects.map((project) => normalizeProject(project));
    await writeProjects(projects);
    return json({ ok: true, projects });
  }

  if (request.method === "DELETE") {
    if (!id) {
      return json({ error: "Project id is required." }, 400);
    }

    const projects = await readProjects();
    const filtered = projects.filter((item) => item.id !== id);

    if (filtered.length === projects.length) {
      return json({ error: "Project not found." }, 404);
    }

    await writeProjects(filtered);
    return json({ ok: true, deletedId: id });
  }

  return json({ error: "Method not allowed." }, 405);
};

export const config = {
  path: ["/api/network/projects", "/api/network/projects/:id"],
  method: ["GET", "POST", "PUT", "DELETE"]
};
