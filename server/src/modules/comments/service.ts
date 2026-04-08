import { db } from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { commentTags, comments } from "@/db/schema/comments";
import { fileVersions, projectFiles } from "@/db/schema/projects";
import { tags } from "@/db/schema/tags";
import { canViewProject, getProjectMemberRole } from "@/lib/access";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { parseMentions, sendEmailNotification } from "@/lib/send-email-notification";
import { wsEmit, wsEvents } from "@/plugins/ws";
import type { SessionUser } from "@/types";
import { and, desc, eq, inArray, isNull, isNotNull, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { status } from "elysia";
import { CommentRichSchema, type CommentModel } from "./model";
import type { Static } from "@sinclair/typebox";

type CommentRich = Static<typeof CommentRichSchema>;

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
  async list(sessionUser: SessionUser, projectId: string, query: CommentModel["listQuery"]): Promise<CommentRich[]> {
    await assertCommentProject(sessionUser, projectId);
    const conditions = [eq(comments.projectId, projectId), isNull(comments.deletedAt)];
    if (query.fileId) {
      conditions.push(eq(comments.fileId, query.fileId));
    }
    if (query.versionIdUpperBound) {
      const [upperVer] = await db
        .select({ commitDate: fileVersions.commitDate, fileId: fileVersions.fileId })
        .from(fileVersions)
        .where(eq(fileVersions.id, query.versionIdUpperBound))
        .limit(1);
      if (upperVer?.commitDate) {
        const olderVersions = await db
          .select({ id: fileVersions.id })
          .from(fileVersions)
          .where(and(eq(fileVersions.fileId, upperVer.fileId), isNotNull(fileVersions.commitDate), lte(fileVersions.commitDate, upperVer.commitDate)));
        const ids = olderVersions.map((v) => v.id);
        if (ids.length) conditions.push(inArray(comments.versionId, ids));
        else conditions.push(isNull(comments.id));
      } else if (upperVer) {
        conditions.push(eq(comments.versionId, query.versionIdUpperBound));
      }
    } else if (query.versionId) {
      conditions.push(eq(comments.versionId, query.versionId));
    }
    if (query.resolved === "true") {
      conditions.push(eq(comments.resolved, true));
    } else if (query.resolved === "false") {
      conditions.push(eq(comments.resolved, false));
    }

    const author = alias(userTable, "comment_author");
    const resolver = alias(userTable, "comment_resolver");

    const rows = await db
      .select({
        comment: comments,
        authorId: author.id,
        authorName: author.name,
        authorEmail: author.email,
        authorRole: author.role,
        authorImage: author.image,
        resolverId: resolver.id,
        resolverName: resolver.name,
        resolverEmail: resolver.email,
        resolverRole: resolver.role,
        resolverImage: resolver.image,
      })
      .from(comments)
      .innerJoin(author, eq(comments.authorId, author.id))
      .leftJoin(resolver, eq(comments.resolvedById, resolver.id))
      .where(and(...conditions))
      .orderBy(desc(comments.createdAt));

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.comment.id);
    const tagRows = await db
      .select({
        commentId: commentTags.commentId,
        tag: tags,
      })
      .from(commentTags)
      .innerJoin(tags, eq(commentTags.tagId, tags.id))
      .where(inArray(commentTags.commentId, ids));

    const tagsByComment = new Map<string, { id: string; name: string; color: string }[]>();
    for (const tr of tagRows) {
      const list = tagsByComment.get(tr.commentId) ?? [];
      list.push({ id: tr.tag.id, name: tr.tag.name, color: tr.tag.color });
      tagsByComment.set(tr.commentId, list);
    }

    const map = new Map<string, CommentRich>();
    for (const row of rows) {
      const c = row.comment;
      map.set(c.id, {
        id: c.id,
        projectId: c.projectId,
        fileId: c.fileId,
        versionId: c.versionId,
        authorId: c.authorId,
        parentId: c.parentId,
        body: c.body,
        resolved: c.resolved,
        resolvedById: c.resolvedById,
        resolvedAt: c.resolvedAt,
        anchor: c.anchor,
        deletedAt: c.deletedAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        author: {
          id: row.authorId,
          name: row.authorName,
          email: row.authorEmail,
          role: row.authorRole,
          image: row.authorImage,
        },
        resolvedBy: row.resolverId
          ? {
              id: row.resolverId,
              name: row.resolverName!,
              email: row.resolverEmail!,
              role: row.resolverRole!,
              image: row.resolverImage,
            }
          : null,
        tags: tagsByComment.get(c.id) ?? [],
        replies: [],
      });
    }

    const roots: CommentRich[] = [];
    for (const row of rows) {
      const c = row.comment;
      const node = map.get(c.id)!;
      if (c.parentId) {
        const parent = map.get(c.parentId);
        if (parent) parent.replies.push(node);
        else roots.push(node);
      } else {
        roots.push(node);
      }
    }

    roots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    for (const n of map.values()) {
      n.replies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    return roots;
  },

  async create(
    user: SessionUser,
    projectId: string,
    body: CommentModel["create"],
    request: Request,
  ) {
    await assertCommentProject(user, projectId);
    const key = user.id;
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
    const [version] = await db
      .select()
      .from(fileVersions)
      .where(and(eq(fileVersions.id, body.versionId), eq(fileVersions.fileId, body.fileId)))
      .limit(1);
    if (!version) {
      throw status(400, { error: "Invalid versionId" } satisfies CommentModel["invalidVersion"]);
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
        versionId: body.versionId,
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
    }).catch((err) => logger.error("Email failed:", err));
    if (parseMentions(body.body).length > 0) {
      sendEmailNotification({
        type: "comment.mention",
        commentId: row.id,
        actorId: user.id,
      }).catch((err) => logger.error("Email failed:", err));
    }
    wsEmit(projectId, wsEvents.commentCreated, {
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
    if (body.anchor !== undefined) {
      // null = unlink: use empty anchor so NOT NULL constraint is satisfied
      patch.anchor = body.anchor ?? { dataComment: null, selector: "", textContent: null, tagName: "", xpath: "" };
    }
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
      }).catch((err) => logger.error("Email failed:", err));
      wsEmit(c.projectId, wsEvents.commentResolved, {
        commentId: c.id,
        projectId: c.projectId,
      });
    } else {
      if (body.body !== undefined && parseMentions(body.body).length > 0) {
        sendEmailNotification({
          type: "comment.mention",
          commentId: c.id,
          actorId: user.id,
        }).catch((err) => logger.error("Email failed:", err));
      }
      wsEmit(c.projectId, wsEvents.commentUpdated, {
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
    wsEmit(c.projectId, wsEvents.commentDeleted, {
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
    wsEmit(c.projectId, wsEvents.commentUpdated, {
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
    wsEmit(c.projectId, wsEvents.commentUpdated, {
      commentId: c.id,
      projectId: c.projectId,
    });
    return { ok: true as const };
  },
};
