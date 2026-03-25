import { db } from "@/db";
import { projectFiles, projects } from "@/db/schema/app";
import { and, eq } from "drizzle-orm";
import { status } from "elysia";

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

async function resolveGithubRawUrl(
    repoUrl: string,
    filePath: string,
): Promise<string> {
    // repoUrl e.g. https://github.com/owner/repo
    const match = repoUrl.match(
        /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/,
    );
    if (!match)
        throw status(422, {
            message: "Failed to fetch file from GitHub",
        } as const);

    const [, owner, repo] = match;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    const res = await fetch(apiUrl, {
        headers: { Accept: "application/vnd.github.v3+json" },
    });

    if (!res.ok)
        throw status(422, {
            message: "Failed to fetch file from GitHub",
        } as const);

    const data = (await res.json()) as { download_url?: string };

    if (!data.download_url)
        throw status(422, {
            message: "Failed to fetch file from GitHub",
        } as const);

    return data.download_url;
}

export const FileService = {
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
            with: { comments: { with: { replies: true, author: true } } },
        });

        if (!file)
            throw status(404, { message: "File not found" } as const);

        return file;
    },
};
