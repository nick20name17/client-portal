import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { comments } from "@/db/schema/comments";
import { projects } from "@/db/schema/projects";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import type { StatsModel } from "./model";

export const StatsService = {
  async getDashboardStats(): Promise<StatsModel["response"]> {
    const [[totalRow], [resolvedRow], [projectsRow], [usersRow]] = await Promise.all([
      db
        .select({ n: count() })
        .from(comments)
        .where(isNull(comments.deletedAt)),
      db
        .select({ n: count() })
        .from(comments)
        .where(and(isNull(comments.deletedAt), eq(comments.resolved, true))),
      db.select({ n: count() }).from(projects),
      db.select({ n: count() }).from(user),
    ]);

    const totalComments = Number(totalRow?.n ?? 0);
    const resolvedComments = Number(resolvedRow?.n ?? 0);
    const openComments = totalComments - resolvedComments;

    const recentActivity = await db
      .select({
        id: comments.id,
        body: comments.body,
        createdAt: comments.createdAt,
        projectId: comments.projectId,
        projectName: projects.name,
        authorName: user.name,
      })
      .from(comments)
      .innerJoin(projects, eq(comments.projectId, projects.id))
      .innerJoin(user, eq(comments.authorId, user.id))
      .where(isNull(comments.deletedAt))
      .orderBy(desc(comments.createdAt))
      .limit(10);

    return {
      totalComments,
      resolvedComments,
      openComments,
      projects: Number(projectsRow?.n ?? 0),
      users: Number(usersRow?.n ?? 0),
      recentActivity,
    };
  },
};
