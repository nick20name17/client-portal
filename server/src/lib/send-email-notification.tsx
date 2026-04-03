import { db } from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { comments } from "@/db/schema/comments";
import { projectMembers, projects } from "@/db/schema/projects";
import { NotificationEmail } from "@/emails/notification";
import { getResend } from "@/lib/resend";
import { env } from "@/utils/env";
import { and, eq, inArray, ne, or } from "drizzle-orm";
import * as React from "react";

export type EmailNotificationPayload =
  | {
      type: "comment.created" | "comment.reply" | "comment.resolved" | "comment.mention";
      commentId: number;
      actorId: string;
    }
  | {
      type: "member.added";
      userId: string;
      projectId: string;
      actorId: string;
    };

function fileUrl(projectId: number | string, fileId: number | string, commentId?: number | string): string {
  const base = env.APP_URL ?? "http://localhost:3001";
  const comment = commentId ? `&comment=${commentId}` : "";
  return `${base}/projects/${projectId}/viewer?file=${fileId}${comment}`;
}

const TEST_RECIPIENT = "nick20name17@gmail.com"; // TODO: remove after testing

async function send(_to: string, subject: string, props: React.ComponentProps<typeof NotificationEmail>) {
  const resend = getResend();
  if (!resend) return;
  const from = env.EMAIL_FROM ?? "noreply@example.com";
  await resend.emails.send({ from, to: TEST_RECIPIENT, subject, react: <NotificationEmail {...props} /> });
}

async function getComment(commentId: number) {
  const [row] = await db
    .select({ comment: comments, project: projects })
    .from(comments)
    .innerJoin(projects, eq(comments.projectId, projects.id))
    .where(eq(comments.id, commentId))
    .limit(1);
  return row ?? null;
}

async function getUser(userId: string) {
  const [row] = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1);
  return row ?? null;
}

/** Fire-and-forget: do not await in HTTP handlers. */
export async function sendEmailNotification(payload: EmailNotificationPayload): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  if (payload.type === "member.added") {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, Number(payload.projectId)))
      .limit(1);
    const newMember = await getUser(payload.userId);
    const actor = await getUser(payload.actorId);
    if (!project || !newMember?.email || newMember.emailNotifications === false) return;
    const actorName = actor?.name ?? "Administrator";
    const subject = `You've been added to project ${project.name}`;
    await send(newMember.email, subject, {
      previewText: subject,
      heading: "You've been added to a project",
      body: `${actorName} added you to project "${project.name}".`,
      ctaLabel: "Open project",
      ctaUrl: `${env.APP_URL ?? "http://localhost:3001"}/projects/${project.id}`,
    });
    return;
  }

  const row = await getComment(payload.commentId);
  if (!row) return;
  const { comment, project } = row;
  const actor = await getUser(payload.actorId);
  const actorName = actor?.name ?? "Someone";
  const rootCommentId = comment.parentId ?? comment.id;
  const url = fileUrl(project.id, comment.fileId, rootCommentId);

  function withSnippet(base: Omit<React.ComponentProps<typeof NotificationEmail>, "commentSnippet">): React.ComponentProps<typeof NotificationEmail> {
    const snippet = comment.body.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1").slice(0, 200);
    return snippet ? { ...base, commentSnippet: snippet } : base;
  }

  // comment.created — root comment → notify project managers only
  if (payload.type === "comment.created") {
    const managers = await db
      .select({ email: userTable.email, notify: userTable.emailNotifications })
      .from(projectMembers)
      .innerJoin(userTable, eq(projectMembers.userId, userTable.id))
      .where(
        and(
          eq(projectMembers.projectId, project.id),
          eq(projectMembers.role, "manager"),
          ne(userTable.id, payload.actorId),
        ),
      );
    const subject = `${actorName} left a comment in "${project.name}"`;
    for (const m of managers) {
      if (m.notify !== false && m.email) {
        await send(m.email, subject, withSnippet({ previewText: subject, heading: "New comment", body: subject, ctaLabel: "View", ctaUrl: url }));
      }
    }
    return;
  }

  // comment.reply — notify all thread participants (root author + all reply authors)
  if (payload.type === "comment.reply" && comment.parentId) {
    const threadComments = await db
      .select({ authorId: comments.authorId })
      .from(comments)
      .where(or(eq(comments.id, comment.parentId), eq(comments.parentId, comment.parentId)));
    const participantIds = [...new Set(threadComments.map((c) => c.authorId))].filter(
      (id) => id !== payload.actorId,
    );
    if (participantIds.length === 0) return;
    const participants = await db
      .select({ email: userTable.email, notify: userTable.emailNotifications })
      .from(userTable)
      .where(inArray(userTable.id, participantIds));
    const subject = `${actorName} replied in a thread`;
    for (const p of participants) {
      if (p.notify !== false && p.email) {
        await send(p.email, subject, withSnippet({ previewText: subject, heading: "New reply", body: subject, ctaLabel: "View", ctaUrl: url }));
      }
    }
    return;
  }

  // comment.mention — notify mentioned users parsed from body
  if (payload.type === "comment.mention") {
    const mentionIds = parseMentions(comment.body).filter((id) => id !== payload.actorId);
    if (mentionIds.length === 0) return;
    const mentioned = await db
      .select({ email: userTable.email, notify: userTable.emailNotifications })
      .from(userTable)
      .where(inArray(userTable.id, mentionIds));
    const subject = `${actorName} mentioned you in a comment`;
    for (const m of mentioned) {
      if (m.notify !== false && m.email) {
        await send(m.email, subject, withSnippet({ previewText: subject, heading: "You were mentioned", body: subject, ctaLabel: "View", ctaUrl: url }));
      }
    }
    return;
  }

  // comment.resolved — notify comment author
  if (payload.type === "comment.resolved") {
    const author = await getUser(comment.authorId);
    if (!author?.email || author.id === payload.actorId || author.emailNotifications === false) return;
    const subject = "Your comment has been resolved";
    await send(author.email, subject, {
      previewText: subject,
      heading: "Comment resolved",
      body: `${actorName} marked your comment as resolved in "${project.name}".`,
      ctaLabel: "View",
      ctaUrl: url,
    });
  }
}

/** Extracts user IDs from @[Name](userId) mentions in comment body. */
export function parseMentions(body: string): string[] {
  const regex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const ids: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    if (match[2]) ids.push(match[2]);
  }
  return [...new Set(ids)];
}
