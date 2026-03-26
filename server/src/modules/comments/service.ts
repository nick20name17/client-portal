import { db } from "@/db";
import { commentTags, comments } from "@/db/schema/comments";
import { projectFiles } from "@/db/schema/projects";
import { tags } from "@/db/schema/tags";
import { canViewProject, getProjectMemberRole } from "@/lib/access";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmailNotification } from "@/lib/send-email-notification";
import { sseEmit, sseEvents } from "@/plugins/sse";
import type { SessionUser } from "@/types";
import { and, desc, eq, isNull } from "drizzle-orm";
import { status } from "elysia";
import type { CommentModel } from "./model";

async function assertCommentProject(user: SessionUser, projectId: string): Promise<void> {
  if (!(await canViewProject(user, projectId))) {
    throw status(403, { error: "Forbidden" } satisfies CommentModel["forbidden"]);
  }
}

async function canResolveComment(user: SessionUser, projectId: string): Promise<boolean> {
  if (user.role === "admin") return true;
  const r = await getProjectMemberRole(user.id, projectId);
  return r === "manager";
}

async function canDeleteComment(user: SessionUser, authorId: string): Promise<boolean> {
  if (user.role === "admin") return true;
  return user.id === authorId;
}

export const CommentService = {
  async list(user: SessionUser, projectId: string, query: CommentModel["listQuery"]) {
    await assertCommentProject(user, projectId);
    const conditions = [eq(comments.projectId, projectId), isNull(comments.deletedAt)];
    if (query.fileId) {
      conditions.push(eq(comments.fileId, query.fileId));
    }
    if (query.resolved === "true") {
      conditions.push(eq(comments.resolved, true));
    } else if (query.resolved === "false") {
      conditions.push(eq(comments.resolved, false));
    }
    return db
      .select()
      .from(comments)
      .where(and(...conditions))
      .orderBy(desc(comments.createdAt));
  },

  async create(
    user: SessionUser,
    projectId: string,
    body: CommentModel["create"],
    request: Request,
  ) {
    await assertCommentProject(user, projectId);
    const key = `${request.headers.get("x-forwarded-for") ?? "ip"}:${user.id}`;
    if (!rateLimit(key, 30, 60_000)) {
      throw status(429, { error: "Too many requests" } satisfies CommentModel["rateLimited"]);
    }
    const [file] = await db
      .select()
      .from(projectFiles)
      .where(and(eq(projectFiles.id, body.fileId), eq(projectFiles.projectId, projectId)))
      .limit(1);
    if (!file) {
      throw status(400, { error: "Invalid fileId" } satisfies CommentModel["invalidFile"]);
    }
    if (body.parentId) {
      const [parent] = await db
        .select()
        .from(comments)
        .where(and(eq(comments.id, body.parentId), eq(comments.projectId, projectId)))
        .limit(1);
      if (!parent) {
        throw status(400, { error: "Invalid parentId" } satisfies CommentModel["invalidParent"]);
      }
    }
    const [row] = await db
      .insert(comments)
      .values({
        projectId,
        fileId: body.fileId,
        authorId: user.id,
        parentId: body.parentId ?? null,
        body: body.body,
        anchor: body.anchor,
        resolved: false,
      })
      .returning();
    sendEmailNotification({
      type: body.parentId ? "comment.reply" : "comment.created",
      commentId: row.id,
      actorId: user.id,
    }).catch((err) => console.error("Email failed:", err));
    sseEmit(projectId, sseEvents.commentCreated, {
      commentId: row.id,
      projectId,
    });
    return row;
  },

  async patch(user: SessionUser, commentId: string, body: CommentModel["patch"]) {
    const [c] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
    if (!c || c.deletedAt) {
      throw status(404, { error: "Not found" } satisfies CommentModel["notFound"]);
    }
    await assertCommentProject(user, c.projectId);
    if (body.body !== undefined && c.authorId !== user.id && user.role !== "admin") {
      throw status(403, { error: "Forbidden" } satisfies CommentModel["forbidden"]);
    }
    if (body.resolved !== undefined) {
      const ok = await canResolveComment(user, c.projectId);
      if (!ok) {
        throw status(403, { error: "Forbidden" } satisfies CommentModel["forbidden"]);
      }
    }
    const now = new Date();
    const patch: Record<string, unknown> = { updatedAt: now };
    if (body.body !== undefined) patch.body = body.body;
    if (body.resolved === true) {
      patch.resolved = true;
      patch.resolvedById = user.id;
      patch.resolvedAt = now;
    } else if (body.resolved === false) {
      patch.resolved = false;
      patch.resolvedById = null;
      patch.resolvedAt = null;
    }
    const [row] = await db
      .update(comments)
      .set(patch)
      .where(eq(comments.id, commentId))
      .returning();
    if (body.resolved === true) {
      sendEmailNotification({
        type: "comment.resolved",
        commentId: c.id,
        actorId: user.id,
      }).catch((err) => console.error("Email failed:", err));
      sseEmit(c.projectId, sseEvents.commentResolved, {
        commentId: c.id,
        projectId: c.projectId,
      });
    } else {
      sseEmit(c.projectId, sseEvents.commentUpdated, {
        commentId: c.id,
        projectId: c.projectId,
      });
    }
    return row;
  },

  async remove(user: SessionUser, commentId: string) {
    const [c] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
    if (!c || c.deletedAt) {
      throw status(404, { error: "Not found" } satisfies CommentModel["notFound"]);
    }
    await assertCommentProject(user, c.projectId);
    if (!(await canDeleteComment(user, c.authorId))) {
      throw status(403, { error: "Forbidden" } satisfies CommentModel["forbidden"]);
    }
    const now = new Date();
    const [row] = await db
      .update(comments)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(comments.id, commentId))
      .returning();
    sseEmit(c.projectId, sseEvents.commentDeleted, {
      commentId: c.id,
      projectId: c.projectId,
    });
    return { ok: true as const, id: row?.id };
  },

  async addTag(user: SessionUser, commentId: string, tagId: string) {
    const [c] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
    if (!c || c.deletedAt) {
      throw status(404, { error: "Not found" } satisfies CommentModel["notFound"]);
    }
    await assertCommentProject(user, c.projectId);
    const [tag] = await db.select().from(tags).where(eq(tags.id, tagId)).limit(1);
    if (!tag) {
      throw status(400, { error: "Invalid tagId" } satisfies CommentModel["invalidTag"]);
    }
    await db.insert(commentTags).values({ commentId, tagId }).onConflictDoNothing();
    sseEmit(c.projectId, sseEvents.commentUpdated, {
      commentId: c.id,
      projectId: c.projectId,
    });
    return { ok: true as const };
  },

  async removeTag(user: SessionUser, commentId: string, tagId: string) {
    const [c] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
    if (!c || c.deletedAt) {
      throw status(404, { error: "Not found" } satisfies CommentModel["notFound"]);
    }
    await assertCommentProject(user, c.projectId);
    await db
      .delete(commentTags)
      .where(and(eq(commentTags.commentId, commentId), eq(commentTags.tagId, tagId)));
    sseEmit(c.projectId, sseEvents.commentUpdated, {
      commentId: c.id,
      projectId: c.projectId,
    });
    return { ok: true as const };
  },
};
