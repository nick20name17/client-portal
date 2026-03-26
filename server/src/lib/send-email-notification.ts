import { db } from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { comments } from "@/db/schema/comments";
import { projectMembers, projects } from "@/db/schema/projects";
import { getResend } from "@/lib/resend";
import { env } from "@/utils/env";
import { and, eq, ne } from "drizzle-orm";

export type EmailNotificationPayload = {
  type: "comment.created" | "comment.reply" | "comment.resolved";
  commentId: string;
  actorId: string;
};

function commentCreatedTemplate(actorName: string, projectName: string) {
  return `${actorName} залишив коментар у проекті ${projectName}`;
}

function commentReplyTemplate(actorName: string) {
  return `${actorName} відповів на ваш коментар`;
}

function commentResolvedTemplate() {
  return "Ваш коментар позначено як вирішений";
}

/** Fire-and-forget: call with `.catch()` at the call site; do not await in HTTP handlers. */
export async function sendEmailNotification(payload: EmailNotificationPayload): Promise<void> {
  const resend = getResend();
  const from = env.EMAIL_FROM ?? "noreply@example.com";
  if (!resend) return;

  const [row] = await db
    .select({
      comment: comments,
      project: projects,
    })
    .from(comments)
    .innerJoin(projects, eq(comments.projectId, projects.id))
    .where(eq(comments.id, payload.commentId))
    .limit(1);

  if (!row) return;

  const actorRows = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, payload.actorId))
    .limit(1);
  const actorName = actorRows[0]?.name ?? "Користувач";

  if (payload.type === "comment.created") {
    const members = await db
      .select({
        email: userTable.email,
        id: userTable.id,
        notify: userTable.emailNotifications,
      })
      .from(projectMembers)
      .innerJoin(userTable, eq(projectMembers.userId, userTable.id))
      .where(
        and(eq(projectMembers.projectId, row.comment.projectId), ne(userTable.id, payload.actorId)),
      );
    const subject = commentCreatedTemplate(actorName, row.project.name);
    const body = subject;
    for (const m of members) {
      if (m.notify !== false && m.email) {
        await resend.emails.send({ from, to: m.email, subject, text: body });
      }
    }
    return;
  }

  if (payload.type === "comment.reply" && row.comment.parentId) {
    const [parent] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, row.comment.parentId))
      .limit(1);
    if (!parent) return;
    const [parentAuthor] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, parent.authorId))
      .limit(1);
    if (
      !parentAuthor?.email ||
      parentAuthor.id === payload.actorId ||
      parentAuthor.emailNotifications === false
    ) {
      return;
    }
    const subject = commentReplyTemplate(actorName);
    await resend.emails.send({
      from,
      to: parentAuthor.email,
      subject,
      text: subject,
    });
    return;
  }

  if (payload.type === "comment.resolved") {
    const [author] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, row.comment.authorId))
      .limit(1);
    if (!author?.email || author.id === payload.actorId || author.emailNotifications === false) {
      return;
    }
    const subject = commentResolvedTemplate();
    await resend.emails.send({
      from,
      to: author.email,
      subject,
      text: subject,
    });
  }
}
