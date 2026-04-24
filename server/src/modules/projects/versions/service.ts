import { db } from "@/db";
import { comments } from "@/db/schema/comments";
import { fileVersions, projectFiles } from "@/db/schema/projects";
import { canViewProject, getProjectMemberRole, getProjectOrNull } from "@/lib/access";
import { fetchFileCommits, parseGithubRepoUrl } from "@/lib/github";
import { logger } from "@/lib/logger";
import type { SessionUser } from "@/types";
import { and, count, desc, eq } from "drizzle-orm";
import { status } from "elysia";
import type { FileVersionModel } from "./model";

async function canManageVersions(user: SessionUser, projectId: string): Promise<boolean> {
  if (user.role === "admin") return true;
  if (user.role === "client") return false;
  const r = await getProjectMemberRole(user.id, projectId);
  return r === "manager";
}

function forbidden(): never {
  throw status(403, { error: "Forbidden" } satisfies FileVersionModel["forbidden"]);
}

export const FileVersionService = {
  async list(user: SessionUser, projectId: string, fileId: string) {
    if (!(await canViewProject(user, projectId))) forbidden();
    const [file] = await db
      .select()
      .from(projectFiles)
      .where(and(eq(projectFiles.id, fileId), eq(projectFiles.projectId, projectId)))
      .limit(1);
    if (!file) {
      throw status(404, { error: "Not found" } satisfies FileVersionModel["notFound"]);
    }
    return db
      .select()
      .from(fileVersions)
      .where(eq(fileVersions.fileId, fileId))
      .orderBy(desc(fileVersions.commitDate));
  },

  async create(user: SessionUser, projectId: string, fileId: string, body: FileVersionModel["create"]) {
    if (!(await canManageVersions(user, projectId))) forbidden();
    const [file] = await db
      .select()
      .from(projectFiles)
      .where(and(eq(projectFiles.id, fileId), eq(projectFiles.projectId, projectId)))
      .limit(1);
    if (!file) {
      throw status(404, { error: "Not found" } satisfies FileVersionModel["notFound"]);
    }

    let commitSha = body.commitSha;
    let commitMessage: string | null = null;
    let commitAuthor: string | null = null;
    let commitDate: Date | null = null;

    if (!commitSha) {
      // Fetch latest commit for this file from GitHub
      const p = await getProjectOrNull(projectId);
      if (!p) throw status(404, { error: "Not found" } satisfies FileVersionModel["notFound"]);
      const parsed = parseGithubRepoUrl(p.repoUrl);
      if (parsed) {
        const commits = await fetchFileCommits(parsed.owner, parsed.repo, file.path, 1);
        if (commits[0]) {
          commitSha = commits[0].sha;
          commitMessage = commits[0].message;
          commitAuthor = commits[0].author;
          commitDate = commits[0].date ? new Date(commits[0].date) : null;
        }
      }
    }

    if (!commitSha) {
      throw status(400, { error: "Not found" } satisfies FileVersionModel["notFound"]);
    }

    const [existing] = await db
      .select()
      .from(fileVersions)
      .where(and(eq(fileVersions.fileId, fileId), eq(fileVersions.commitSha, commitSha)))
      .limit(1);
    if (existing) {
      throw status(409, { error: "Version already exists" } satisfies FileVersionModel["conflict"]);
    }

    const [row] = await db
      .insert(fileVersions)
      .values({
        fileId,
        commitSha,
        commitMessage,
        commitAuthor,
        commitDate,
        label: body.label ?? null,
        createdById: user.id,
      })
      .returning();
    return row;
  },

  async delete(user: SessionUser, projectId: string, fileId: string, versionId: string) {
    if (!(await canManageVersions(user, projectId))) forbidden();
    const [ver] = await db
      .select()
      .from(fileVersions)
      .where(and(eq(fileVersions.id, versionId), eq(fileVersions.fileId, fileId)))
      .limit(1);
    if (!ver) {
      throw status(404, { error: "Not found" } satisfies FileVersionModel["notFound"]);
    }
    // Block delete if comments exist on this version
    const [{ n }] = await db
      .select({ n: count() })
      .from(comments)
      .where(eq(comments.versionId, versionId));
    if (Number(n) > 0) {
      throw status(409, { error: "Version has comments" } satisfies FileVersionModel["hasComments"]);
    }
    await db.delete(fileVersions).where(eq(fileVersions.id, versionId));
    return { ok: true as const };
  },

  /**
   * Called during syncFiles — upserts a version for each file based on GitHub commit history.
   * Fetches full history for files that have no versions yet, or latest 1 for files that already have versions.
   */
  async syncVersionsForFile(
    _projectId: string,
    fileId: string,
    filePath: string,
    owner: string,
    repo: string,
    createdById: string | null,
  ) {
    const existingVersions = await db
      .select({ commitSha: fileVersions.commitSha })
      .from(fileVersions)
      .where(eq(fileVersions.fileId, fileId));

    const existingShas = new Set(existingVersions.map((v) => v.commitSha));
    const perPage = existingShas.size === 0 ? 100 : 30;

    const commits = await fetchFileCommits(owner, repo, filePath, perPage);

    const toInsert = commits
      .filter((c) => !existingShas.has(c.sha))
      .map((c) => ({
        fileId,
        commitSha: c.sha,
        commitMessage: c.message,
        commitAuthor: c.author,
        commitDate: c.date ? new Date(c.date) : null,
        createdById,
      }));

    if (toInsert.length > 0) {
      await db.insert(fileVersions).values(toInsert).onConflictDoNothing();
    }
    return toInsert.length;
  },

  /** Syncs and returns latest commit SHA per file. Client diffs against its local seen-map. */
  async checkNewVersions(user: SessionUser, projectId: string) {
    if (!(await canViewProject(user, projectId))) forbidden();
    const p = await getProjectOrNull(projectId);
    if (!p) throw status(404, { error: "Not found" } satisfies FileVersionModel["notFound"]);
    const parsed = parseGithubRepoUrl(p.repoUrl);
    if (!parsed) return [];

    // Refresh HEAD file list first: picks up newly added .html files and marks
    // deleted ones as active=false. syncHeadFiles also calls syncVersionsForFile
    // per file, so we don't need a second pass.
    try {
      const { syncHeadFiles } = await import("../service");
      await syncHeadFiles(Number(projectId), parsed.owner, parsed.repo, null);
    } catch (e) {
      logger.error(`[checkNewVersions] head sync failed:`, e);
    }

    const files = await db
      .select()
      .from(projectFiles)
      .where(and(eq(projectFiles.projectId, projectId), eq(projectFiles.active, true)));

    const results = await Promise.all(
      files.map(async (f) => {
        const [latest] = await db
          .select({ commitSha: fileVersions.commitSha, commitDate: fileVersions.commitDate })
          .from(fileVersions)
          .where(eq(fileVersions.fileId, String(f.id)))
          .orderBy(desc(fileVersions.commitDate))
          .limit(1);
        if (!latest) return null;
        return {
          fileId: f.id,
          filePath: f.path,
          latestCommitSha: latest.commitSha,
          latestCommitDate: latest.commitDate,
        };
      }),
    );
    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  },

  /** Fetch full commit history for a file and upsert all versions. Returns updated list. */
  async syncAll(user: SessionUser, projectId: string, fileId: string) {
    if (!(await canViewProject(user, projectId))) {
      throw status(403, { error: "Forbidden" } satisfies FileVersionModel["forbidden"]);
    }
    const [file] = await db
      .select()
      .from(projectFiles)
      .where(and(eq(projectFiles.id, fileId), eq(projectFiles.projectId, projectId)))
      .limit(1);
    if (!file) throw status(404, { error: "Not found" } satisfies FileVersionModel["notFound"]);

    const p = await getProjectOrNull(projectId);
    const parsed = p ? parseGithubRepoUrl(p.repoUrl) : null;
    if (parsed) {
      await FileVersionService.syncVersionsForFile(projectId, fileId, file.path, parsed.owner, parsed.repo, user.id);
    }

    return db
      .select()
      .from(fileVersions)
      .where(eq(fileVersions.fileId, fileId))
      .orderBy(desc(fileVersions.commitDate));
  },
};
