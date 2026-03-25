import { db } from "@/db";
import { projectFiles, projects } from "@/db/schema/app";
import { env } from "@/utils/env";
import { and, eq, notInArray } from "drizzle-orm";
import { status } from "elysia";

type GithubRepo = { owner: string; repo: string };

function parseGithubRepo(repoUrl: string): GithubRepo | null {
    try {
        const u = new URL(repoUrl.trim());
        if (u.hostname !== "github.com" && u.hostname !== "www.github.com")
            return null;
        const parts = u.pathname.split("/").filter(Boolean);
        if (parts.length < 2) return null;
        const owner = parts[0];
        let repo = parts[1];
        if (repo.endsWith(".git")) repo = repo.slice(0, -4);
        return { owner, repo };
    } catch {
        return null;
    }
}

function githubHeaders(): HeadersInit {
    const h: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "client-platform",
    };
    if (env.GITHUB_TOKEN) {
        h.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    }
    return h;
}

function encodePathSegment(path: string): string {
    return path
        .split("/")
        .filter((s) => s.length > 0)
        .map((s) => encodeURIComponent(s))
        .join("/");
}

async function fetchDefaultBranch(
    owner: string,
    repo: string,
): Promise<string | null> {
    const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
        { headers: githubHeaders() },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { default_branch?: string };
    return data.default_branch ?? null;
}

async function fetchRawUrlExists(url: string): Promise<boolean> {
    const auth = env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` }
        : {};
    const head = await fetch(url, { method: "HEAD", headers: auth });
    if (head.ok) return true;
    const partial = await fetch(url, {
        headers: { ...auth, Range: "bytes=0-0" },
    });
    return partial.ok || partial.status === 206;
}

/**
 * Resolves a stable raw URL for a file in a public GitHub repo.
 * Uses the Contents API first, then falls back to raw.githubusercontent.com
 * (avoids API-only failures and helps when rate-limited).
 */
async function resolveGithubRawUrl(
    repoUrl: string,
    filePath: string,
): Promise<string> {
    const parsed = parseGithubRepo(repoUrl);
    if (!parsed) {
        throw status(422, {
            message: "Invalid GitHub repository URL",
        } as const);
    }

    const { owner, repo } = parsed;
    const encodedPath = encodePathSegment(filePath);
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

    const res = await fetch(apiUrl, { headers: githubHeaders() });

    if (res.ok) {
        const data = (await res.json()) as
            | { download_url?: string | null; type?: string }
            | unknown[];

        if (Array.isArray(data)) {
            throw status(422, {
                message: `"${filePath}" is a directory, not a file`,
            } as const);
        }

        if (data.download_url) {
            return data.download_url;
        }
    }

    // API failed (404, rate limit, branch, etc.) — try raw URLs for common default branches
    const branchesToTry = new Set<string>(["main", "master"]);
    const def = await fetchDefaultBranch(owner, repo);
    if (def) branchesToTry.add(def);

    for (const branch of branchesToTry) {
        const raw = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodedPath}`;
        if (await fetchRawUrlExists(raw)) {
            return raw;
        }
    }

    let detail = `Could not find "${filePath}" in this repository.`;
    if (!res.ok) {
        try {
            const err = (await res.json()) as { message?: string };
            if (err.message && typeof err.message === "string") {
                if (res.status === 404) {
                    detail = `File not found in repo: ${filePath}. ${err.message}`;
                } else if (res.status === 403) {
                    detail = `GitHub blocked the request (${err.message}). Set GITHUB_TOKEN in server env for higher limits or private repos.`;
                } else {
                    detail = err.message;
                }
            }
        } catch {
            if (res.status === 404) {
                detail = `File not found in repo: ${filePath}`;
            }
        }
    }

    throw status(422, {
        message: detail,
    } as const);
}

async function fetchHtmlBlobPathsFromGithub(repoUrl: string): Promise<string[]> {
    const parsed = parseGithubRepo(repoUrl);
    if (!parsed) {
        throw status(422, {
            message: "Invalid GitHub repository URL",
        } as const);
    }
    const { owner, repo } = parsed;
    const branch = await fetchDefaultBranch(owner, repo);
    if (!branch) {
        throw status(422, {
            message: "Could not resolve default branch for this repository",
        } as const);
    }

    const refRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
        { headers: githubHeaders() },
    );
    if (!refRes.ok) {
        throw status(422, {
            message: "Could not resolve branch ref from GitHub",
        } as const);
    }
    const refData = (await refRes.json()) as { object?: { sha?: string } };
    const commitSha = refData.object?.sha;
    if (!commitSha) {
        throw status(422, {
            message: "Invalid Git ref response",
        } as const);
    }

    const commitRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/commits/${commitSha}`,
        { headers: githubHeaders() },
    );
    if (!commitRes.ok) {
        throw status(422, {
            message: "Could not fetch commit from GitHub",
        } as const);
    }
    const commitData = (await commitRes.json()) as { tree?: { sha?: string } };
    const treeSha = commitData.tree?.sha;
    if (!treeSha) {
        throw status(422, {
            message: "Invalid commit response from GitHub",
        } as const);
    }

    const treeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`,
        { headers: githubHeaders() },
    );
    if (!treeRes.ok) {
        let msg = "Could not fetch repository tree from GitHub";
        try {
            const err = (await treeRes.json()) as { message?: string };
            if (err.message) msg = err.message;
        } catch {
            /* ignore */
        }
        throw status(422, { message: msg } as const);
    }
    const treeData = (await treeRes.json()) as {
        tree?: Array<{ path?: string; type?: string }>;
        truncated?: boolean;
    };
    if (treeData.truncated) {
        throw status(422, {
            message:
                "Repository tree is too large (truncated). Set GITHUB_TOKEN or use a smaller repo.",
        } as const);
    }

    const paths: string[] = [];
    for (const entry of treeData.tree ?? []) {
        if (
            entry.type === "blob" &&
            entry.path &&
            entry.path.toLowerCase().endsWith(".html")
        ) {
            paths.push(entry.path);
        }
    }
    return paths.sort((a, b) => a.localeCompare(b));
}

async function assertProjectAccess(
    projectId: number,
    userId: string,
    role: string,
) {
    const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
        with: { members: true },
    });

    if (!project)
        throw status(404, { message: "Project not found" } as const);

    if (role !== "admin") {
        const isMember = project.members.some((m) => m.userId === userId);
        if (!isMember)
            throw status(403, { message: "Forbidden" } as const);
    }

    return project;
}

export const FileService = {
    /**
     * Discovers all `.html` blobs in the project's GitHub repo, upserts rows, and removes stale paths.
     */
    async syncHtmlFiles(projectId: number) {
        const project = await db.query.projects.findFirst({
            where: eq(projects.id, projectId),
        });

        if (!project)
            throw status(404, { message: "Project not found" } as const);

        const htmlPaths = await fetchHtmlBlobPathsFromGithub(project.repoUrl);

        for (const path of htmlPaths) {
            const githubUrl = await resolveGithubRawUrl(project.repoUrl, path);
            await db
                .insert(projectFiles)
                .values({ projectId, path, githubUrl })
                .onConflictDoUpdate({
                    target: [projectFiles.projectId, projectFiles.path],
                    set: { githubUrl },
                });
        }

        if (htmlPaths.length === 0) {
            await db
                .delete(projectFiles)
                .where(eq(projectFiles.projectId, projectId));
        } else {
            await db
                .delete(projectFiles)
                .where(
                    and(
                        eq(projectFiles.projectId, projectId),
                        notInArray(projectFiles.path, htmlPaths),
                    ),
                );
        }

        return db.query.projectFiles.findMany({
            where: eq(projectFiles.projectId, projectId),
        });
    },

    async syncHtmlFilesWithAuth(
        projectId: number,
        userId: string,
        role: string,
    ) {
        await assertProjectAccess(projectId, userId, role);
        return FileService.syncHtmlFiles(projectId);
    },

    async create(
        projectId: number,
        _userId: string,
        path: string,
    ) {
        const project = await db.query.projects.findFirst({
            where: eq(projects.id, projectId),
        });

        if (!project)
            throw status(404, { message: "Project not found" } as const);

        const githubUrl = await resolveGithubRawUrl(project.repoUrl, path);

        const [file] = await db
            .insert(projectFiles)
            .values({ projectId, path, githubUrl })
            .onConflictDoUpdate({
                target: [projectFiles.projectId, projectFiles.path],
                set: { githubUrl },
            })
            .returning();

        return file;
    },

    async getAll(projectId: number, userId: string, role: string) {
        await assertProjectAccess(projectId, userId, role);

        return db.query.projectFiles.findMany({
            where: eq(projectFiles.projectId, projectId),
        });
    },

    async getById(
        projectId: number,
        fileId: number,
        userId: string,
        role: string,
    ) {
        await assertProjectAccess(projectId, userId, role);

        const file = await db.query.projectFiles.findFirst({
            where: and(
                eq(projectFiles.id, fileId),
                eq(projectFiles.projectId, projectId),
            ),
        });

        if (!file)
            throw status(404, { message: "File not found" } as const);

        return file;
    },
};
