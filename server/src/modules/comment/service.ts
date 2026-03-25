import { db } from "@/db";
import { comments, projectFiles, projects, replies } from "@/db/schema/app";
import { sendEmail } from "@/lib/email";
import { and, eq } from "drizzle-orm";
import { status } from "elysia";

async function assertFileAccess(
    projectId: number,
    fileId: number,
    userId: string,
    role: string,
) {
    const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
        with: { members: true },
    });

    if (!project)
        throw status(404, { message: "File not found" } as const);

    if (role !== "admin") {
        const isMember = project.members.some((m) => m.userId === userId);
        if (!isMember)
            throw status(403, { message: "Forbidden" } as const);
    }

    const file = await db.query.projectFiles.findFirst({
        where: and(
            eq(projectFiles.id, fileId),
            eq(projectFiles.projectId, projectId),
        ),
    });

    if (!file)
        throw status(404, { message: "File not found" } as const);

    return file;
}

export const CommentService = {
    async getAll(projectId: number, fileId: number, userId: string, role: string) {
        await assertFileAccess(projectId, fileId, userId, role);

        return db.query.comments.findMany({
            where: eq(comments.fileId, fileId),
            with: { replies: true },
        });
    },

    async create(
        projectId: number,
        fileId: number,
        userId: string,
        role: string,
        body: {
            content: string;
            cssSelector?: string | null;
            anchorJson?: Record<string, unknown> | null;
        },
    ) {
        await assertFileAccess(projectId, fileId, userId, role);

        const hasSelector =
            body.cssSelector != null && String(body.cssSelector).length > 0;
        const hasAnchor =
            body.anchorJson != null &&
            typeof body.anchorJson === "object" &&
            Object.keys(body.anchorJson as object).length > 0;

        if (!hasSelector && !hasAnchor) {
            throw status(422, {
                message: "Provide cssSelector and/or anchorJson",
            } as const);
        }

        const [comment] = await db
            .insert(comments)
            .values({
                fileId,
                authorId: userId,
                cssSelector: hasSelector ? body.cssSelector! : null,
                anchorJson: hasAnchor ? body.anchorJson! : null,
                content: body.content,
            })
            .returning();

        return comment;
    },

    async update(id: number, userId: string, role: string, content: string) {
        const comment = await db.query.comments.findFirst({
            where: eq(comments.id, id),
        });

        if (!comment)
            throw status(404, { message: "Comment not found" } as const);

        if (role !== "admin" && comment.authorId !== userId)
            throw status(403, { message: "Forbidden" } as const);

        const [updated] = await db
            .update(comments)
            .set({ content })
            .where(eq(comments.id, id))
            .returning();

        return updated;
    },

    async delete(id: number, userId: string, role: string) {
        const comment = await db.query.comments.findFirst({
            where: eq(comments.id, id),
        });

        if (!comment)
            throw status(404, { message: "Comment not found" } as const);

        if (role !== "admin" && comment.authorId !== userId)
            throw status(403, { message: "Forbidden" } as const);

        await db.delete(comments).where(eq(comments.id, id));
    },

    async createReply(
        commentId: number,
        userId: string,
        content: string,
    ) {
        const comment = await db.query.comments.findFirst({
            where: eq(comments.id, commentId),
            with: { replies: true },
        });

        if (!comment)
            throw status(404, { message: "Comment not found" } as const);

        const [reply] = await db
            .insert(replies)
            .values({ commentId, authorId: userId, content })
            .returning();

        // Collect unique user IDs to notify (comment author + prior repliers, excluding current user)
        const notifyUserIds = [
            ...new Set([
                comment.authorId,
                ...comment.replies.map((r) => r.authorId),
            ]),
        ].filter((id) => id !== userId);

        if (notifyUserIds.length > 0) {
            const notifyUsers = await db.query.user.findMany({
                where: (u, { inArray }) => inArray(u.id, notifyUserIds),
            });

            await Promise.allSettled(
                notifyUsers.map((u) =>
                    sendEmail(
                        u.email,
                        "New reply on your comment",
                        `Someone replied to a comment you're involved in:\n\n"${content}"`,
                    ),
                ),
            );
        }

        return reply;
    },

    async updateReply(id: number, userId: string, role: string, content: string) {
        const reply = await db.query.replies.findFirst({
            where: eq(replies.id, id),
        });

        if (!reply)
            throw status(404, { message: "Reply not found" } as const);

        if (role !== "admin" && reply.authorId !== userId)
            throw status(403, { message: "Forbidden" } as const);

        const [updated] = await db
            .update(replies)
            .set({ content })
            .where(eq(replies.id, id))
            .returning();

        return updated;
    },

    async deleteReply(id: number, userId: string, role: string) {
        const reply = await db.query.replies.findFirst({
            where: eq(replies.id, id),
        });

        if (!reply)
            throw status(404, { message: "Reply not found" } as const);

        if (role !== "admin" && reply.authorId !== userId)
            throw status(403, { message: "Forbidden" } as const);

        await db.delete(replies).where(eq(replies.id, id));
    },
};
