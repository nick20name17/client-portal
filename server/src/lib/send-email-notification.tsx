import { db } from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { comments } from "@/db/schema/comments";
import { projects } from "@/db/schema/projects";
import { CommentMentionEmail } from "@/emails/comment-mention";
import { CommentResolvedEmail } from "@/emails/comment-resolved";
import { MemberAddedEmail } from "@/emails/member-added";
import { getResend } from "@/lib/resend";
import { env } from "@/utils/env";
import { eq, inArray } from "drizzle-orm";
import * as React from "react";

type EmailNotificationPayload =
  | {
      type: "comment.resolved" | "comment.mention";
      commentId: number;
      actorId: string;
    }
  | {
      type: "member.added";
      userId: string;
      projectId: string;
      actorId: string;
    };

function baseUrl(): string {
  return env.APP_URL ?? "http://localhost:3001";
}

function fileUrl(
  projectId: number | string,
  fileId: number | string,
  commentId?: number | string,
): string {
  const comment = commentId ? `&comment=${commentId}` : "";
  return `${baseUrl()}/projects/${projectId}/viewer?file=${fileId}${comment}`;
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

async function sendEmail(to: string, subject: string, element: React.ReactElement) {
  const resend = getResend();
  if (!resend) return;
  const from = env.EMAIL_FROM ?? "noreply@example.com";
  await resend.emails.send({ from, to, subject, react: element });
}

/** Fire-and-forget: do not await in HTTP handlers. */
export async function sendEmailNotification(payload: EmailNotificationPayload): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  if (payload.type === "member.added") {
    const [projectResult, newMember, actor] = await Promise.all([
      db.select().from(projects).where(eq(projects.id, Number(payload.projectId))).limit(1),
      getUser(payload.userId),
      getUser(payload.actorId),
    ]);
    const project = projectResult[0];
    if (!project || !newMember?.email || newMember.emailNotifications === false) return;
    const actorName = actor?.name ?? "Administrator";
    await sendEmail(
      newMember.email,
      `You've been added to project ${project.name}`,
      <MemberAddedEmail
        actorName={actorName}
        projectName={project.name}
        ctaUrl={`${baseUrl()}/projects/${project.id}`}
      />,
    );
    return;
  }

  const row = await getComment(payload.commentId);
  if (!row) return;
  const { comment, project } = row;
  const actor = await getUser(payload.actorId);
  const actorName = actor?.name ?? "Someone";
  const rootCommentId = comment.parentId ?? comment.id;
  const ctaUrl = fileUrl(project.id, comment.fileId, rootCommentId);
  const snippet = comment.body.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1").slice(0, 200) || undefined;

  if (payload.type === "comment.mention") {
    const mentionIds = parseMentions(comment.body).filter((id) => id !== payload.actorId);
    if (mentionIds.length === 0) return;
    const mentioned = await db
      .select({ email: userTable.email, notify: userTable.emailNotifications })
      .from(userTable)
      .where(inArray(userTable.id, mentionIds));
    for (const m of mentioned) {
      if (m.notify !== false && m.email) {
        await sendEmail(
          m.email,
          `${actorName} mentioned you in a comment`,
          <CommentMentionEmail
            actorName={actorName}
            projectName={project.name}
            commentSnippet={snippet}
            ctaUrl={ctaUrl}
          />,
        );
      }
    }
    return;
  }

  if (payload.type === "comment.resolved") {
    const author = await getUser(comment.authorId);
    if (!author?.email || author.id === payload.actorId || author.emailNotifications === false)
      return;
    await sendEmail(
      author.email,
      "Your comment has been resolved",
      <CommentResolvedEmail
        actorName={actorName}
        projectName={project.name}
        ctaUrl={ctaUrl}
      />,
    );
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
