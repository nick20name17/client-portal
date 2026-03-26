import { db } from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { comments } from "@/db/schema/comments";
import { companies } from "@/db/schema/companies";
import { projectFiles, projectMembers, projects } from "@/db/schema/projects";
import { canViewProject, getProjectMemberRole, getProjectOrNull } from "@/lib/access";
import { buildGithubRawUrl, fetchGithubTreeRecursive, parseGithubRepoUrl } from "@/lib/github";
import type { SessionUser } from "@/types";
import { and, asc, count, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { status } from "elysia";
import type { ProjectModel } from "./model";

async function canEditProject(user: SessionUser, projectId: string): Promise<boolean> {
  if (user.role === "admin") return true;
  const r = await getProjectMemberRole(user.id, projectId);
  return r === "manager";
}

async function canAddMember(user: SessionUser, projectId: string) {
  if (user.role === "admin") return true;
  if (user.role !== "manager") return false;
  const r = await getProjectMemberRole(user.id, projectId);
  return r === "manager";
}

async function canSyncFiles(user: SessionUser, projectId: string) {
  if (user.role === "admin") return true;
  if (user.role === "client") return false;
  const r = await getProjectMemberRole(user.id, projectId);
  return r === "manager";
}

function forbidden(): never {
  throw status(403, { error: "Forbidden" } satisfies ProjectModel["forbidden"]);
}

async function enrichProjectRows(
  rows: { project: typeof projects.$inferSelect; company: typeof companies.$inferSelect }[],
): Promise<ProjectModel["listResponse"]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.project.id);

  const [commentAgg, fileAgg, memberAgg] = await Promise.all([
    db
      .select({ projectId: comments.projectId, n: count() })
      .from(comments)
      .where(and(inArray(comments.projectId, ids), isNull(comments.deletedAt)))
      .groupBy(comments.projectId),
    db
      .select({ projectId: projectFiles.projectId, n: count() })
      .from(projectFiles)
      .where(inArray(projectFiles.projectId, ids))
      .groupBy(projectFiles.projectId),
    db
      .select({ projectId: projectMembers.projectId, n: count() })
      .from(projectMembers)
      .where(inArray(projectMembers.projectId, ids))
      .groupBy(projectMembers.projectId),
  ]);

  const memberRows = await db
    .select({
      projectId: projectMembers.projectId,
      userId: userTable.id,
      name: userTable.name,
      image: userTable.image,
    })
    .from(projectMembers)
    .innerJoin(userTable, eq(projectMembers.userId, userTable.id))
    .where(inArray(projectMembers.projectId, ids))
    .orderBy(asc(projectMembers.projectId), asc(projectMembers.addedAt));

  const commentMap = Object.fromEntries(commentAgg.map((c) => [c.projectId, Number(c.n)]));
  const fileMap = Object.fromEntries(fileAgg.map((c) => [c.projectId, Number(c.n)]));
  const memberMap = Object.fromEntries(memberAgg.map((c) => [c.projectId, Number(c.n)]));

  const previewByProject = new Map<string, { id: string; name: string; image: string | null }[]>();
  for (const m of memberRows) {
    const list = previewByProject.get(m.projectId) ?? [];
    if (list.length < 5) {
      list.push({ id: m.userId, name: m.name, image: m.image });
      previewByProject.set(m.projectId, list);
    }
  }

  return rows.map(({ project, company }) => ({
    ...project,
    company: { id: company.id, name: company.name },
    _count: {
      comments: commentMap[project.id] ?? 0,
      files: fileMap[project.id] ?? 0,
      members: memberMap[project.id] ?? 0,
    },
    memberPreview: previewByProject.get(project.id) ?? [],
  }));
}

export const ProjectService = {
  async listForUser(user: SessionUser): Promise<ProjectModel["listResponse"]> {
    if (user.role === "admin") {
      const rows = await db
        .select({ project: projects, company: companies })
        .from(projects)
        .innerJoin(companies, eq(projects.companyId, companies.id))
        .orderBy(projects.createdAt);
      return enrichProjectRows(rows);
    }
    const rows = await db
      .select({ project: projects, company: companies })
      .from(projects)
      .innerJoin(companies, eq(projects.companyId, companies.id))
      .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(eq(projectMembers.userId, user.id))
      .orderBy(projects.createdAt);
    return enrichProjectRows(rows);
  },

  async create(user: SessionUser, body: ProjectModel["create"]) {
    if (user.role === "client") forbidden();
    if (user.role === "manager") {
      if (!user.companyId || user.companyId !== body.companyId) forbidden();
    }
    const [row] = await db
      .insert(projects)
      .values({
        name: body.name,
        description: body.description ?? null,
        repoUrl: body.repoUrl,
        companyId: body.companyId,
        createdById: user.id,
      })
      .returning();
    await db.insert(projectMembers).values({
      projectId: row.id,
      userId: user.id,
      role: "manager",
      addedById: user.id,
    });
    const [comp] = await db.select().from(companies).where(eq(companies.id, row.companyId)).limit(1);
    return {
      ...row,
      company: comp ? { id: comp.id, name: comp.name } : null,
    };
  },

  async getById(user: SessionUser, id: string): Promise<ProjectModel["select"]> {
    if (!(await canViewProject(user, id))) forbidden();
    const p = await getProjectOrNull(id);
    if (!p)
      throw status(404, {
        error: "Not found",
      } satisfies ProjectModel["notFound"]);
    const [c] = await db.select().from(companies).where(eq(companies.id, p.companyId)).limit(1);
    return {
      ...p,
      company: c ? { id: c.id, name: c.name } : null,
    };
  },

  async update(user: SessionUser, id: string, body: ProjectModel["update"]) {
    if (!(await canEditProject(user, id))) forbidden();
    const patch: {
      name?: string;
      description?: string | null;
      repoUrl?: string;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    if (body.name !== undefined) patch.name = body.name;
    if (body.description !== undefined) patch.description = body.description;
    if (body.repoUrl !== undefined) patch.repoUrl = body.repoUrl;
    const [row] = await db.update(projects).set(patch).where(eq(projects.id, id)).returning();
    if (!row)
      throw status(404, {
        error: "Not found",
      } satisfies ProjectModel["notFound"]);
    const [comp] = await db.select().from(companies).where(eq(companies.id, row.companyId)).limit(1);
    return {
      ...row,
      company: comp ? { id: comp.id, name: comp.name } : null,
    };
  },

  async delete(user: SessionUser, id: string) {
    if (user.role !== "admin") forbidden();
    const [row] = await db.delete(projects).where(eq(projects.id, id)).returning();
    if (!row)
      throw status(404, {
        error: "Not found",
      } satisfies ProjectModel["notFound"]);
    return { ok: true as const };
  },

  async listMembers(user: SessionUser, projectId: string): Promise<ProjectModel["memberList"]> {
    if (!(await canViewProject(user, projectId))) forbidden();
    const rows = await db
      .select({
        member: projectMembers,
        userId: userTable.id,
        userName: userTable.name,
        userEmail: userTable.email,
        userEmailVerified: userTable.emailVerified,
        userImage: userTable.image,
        userRole: userTable.role,
      })
      .from(projectMembers)
      .innerJoin(userTable, eq(projectMembers.userId, userTable.id))
      .where(eq(projectMembers.projectId, projectId))
      .orderBy(projectMembers.addedAt);

    return rows.map((r) => ({
      ...r.member,
      user: {
        id: r.userId,
        name: r.userName,
        email: r.userEmail,
        emailVerified: r.userEmailVerified,
        image: r.userImage,
        role: r.userRole,
      },
    }));
  },

  async addMember(user: SessionUser, projectId: string, body: ProjectModel["addMember"]) {
    if (!(await canAddMember(user, projectId))) forbidden();
    if (user.role === "manager" && body.role !== "client") forbidden();
    const [row] = await db
      .insert(projectMembers)
      .values({
        projectId,
        userId: body.userId,
        role: body.role,
        addedById: user.id,
      })
      .onConflictDoNothing()
      .returning();
    if (!row) {
      throw status(409, {
        error: "Already a member",
      } satisfies ProjectModel["memberConflict"]);
    }
    return row;
  },

  async removeMember(user: SessionUser, projectId: string, memberUserId: string) {
    if (!(await canAddMember(user, projectId))) forbidden();
    const [row] = await db
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, memberUserId)))
      .returning();
    if (!row)
      throw status(404, {
        error: "Not found",
      } satisfies ProjectModel["notFound"]);
    return { ok: true as const };
  },

  async listFiles(user: SessionUser, projectId: string) {
    if (!(await canViewProject(user, projectId))) forbidden();
    return db
      .select()
      .from(projectFiles)
      .where(eq(projectFiles.projectId, projectId))
      .orderBy(projectFiles.path);
  },

  async syncFiles(user: SessionUser, projectId: string) {
    if (!(await canSyncFiles(user, projectId))) forbidden();
    const p = await getProjectOrNull(projectId);
    if (!p)
      throw status(404, {
        error: "Not found",
      } satisfies ProjectModel["notFound"]);
    const parsed = parseGithubRepoUrl(p.repoUrl);
    if (!parsed) {
      throw status(400, {
        error: "Invalid repoUrl",
      } satisfies ProjectModel["invalidRepo"]);
    }
    const { owner, repo } = parsed;
    let tree: Awaited<ReturnType<typeof fetchGithubTreeRecursive>>;
    try {
      tree = await fetchGithubTreeRecursive(owner, repo, "HEAD");
    } catch (e) {
      throw status(502, {
        error: "GitHub sync failed",
        detail: e instanceof Error ? e.message : String(e),
      } satisfies ProjectModel["syncUpstreamError"]);
    }
    const htmlPaths = tree
      .filter((node) => node.type === "blob" && node.path.toLowerCase().endsWith(".html"))
      .map((node) => node.path);
    const now = new Date();
    for (const path of htmlPaths) {
      const raw = buildGithubRawUrl(owner, repo, "HEAD", path);
      await db
        .insert(projectFiles)
        .values({
          projectId: p.id,
          path,
          githubRawUrl: raw,
          active: true,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [projectFiles.projectId, projectFiles.path],
          set: {
            githubRawUrl: raw,
            active: true,
            updatedAt: now,
          },
        });
    }
    if (htmlPaths.length > 0) {
      await db
        .update(projectFiles)
        .set({ active: false, updatedAt: now })
        .where(and(eq(projectFiles.projectId, p.id), notInArray(projectFiles.path, htmlPaths)));
    } else {
      await db
        .update(projectFiles)
        .set({ active: false, updatedAt: now })
        .where(eq(projectFiles.projectId, p.id));
    }
    return { synced: htmlPaths.length, paths: htmlPaths };
  },

  async getFileHtml(user: SessionUser, projectId: string, fileId: string): Promise<string> {
    if (!(await canViewProject(user, projectId))) forbidden();
    const [file] = await db
      .select()
      .from(projectFiles)
      .where(and(eq(projectFiles.id, fileId), eq(projectFiles.projectId, projectId)))
      .limit(1);
    if (!file)
      throw status(404, {
        error: "Not found",
      } satisfies ProjectModel["notFound"]);
    const res = await fetch(file.githubRawUrl);
    if (!res.ok) {
      throw status(502, {
        error: "Upstream fetch failed",
      } satisfies ProjectModel["upstreamFetch"]);
    }
    return res.text();
  },
};
