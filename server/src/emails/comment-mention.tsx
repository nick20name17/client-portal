import * as React from "react";
import { Actor, Badge, CtaButton, ProjectTile, Snippet } from "./_parts";
import { EmailShell } from "./_shell";

export interface CommentMentionEmailProps {
  actorName: string;
  projectName: string;
  commentSnippet?: string | undefined;
  ctaUrl: string;
}

export function CommentMentionEmail({
  actorName,
  projectName,
  commentSnippet,
  ctaUrl,
}: CommentMentionEmailProps) {
  const previewText = `${actorName} mentioned you in a comment`;
  return (
    <EmailShell previewText={previewText} footerReason="You were directly mentioned">
      <Badge bg="#E8FAF6" fg="#4ECDC4" symbol="@" label="You were mentioned" />
      <Actor name={actorName} description="mentioned you in a comment" />
      {commentSnippet ? <Snippet text={commentSnippet} /> : null}
      <ProjectTile name={projectName} />
      <CtaButton href={ctaUrl} label="View comment" />
    </EmailShell>
  );
}

export default CommentMentionEmail;

CommentMentionEmail.PreviewProps = {
  actorName: "Ivan",
  projectName: "Website Redesign",
  commentSnippet: "Hey @Nazar, can you take a look at the header spacing on mobile?",
  ctaUrl: "http://localhost:3001/projects/1/viewer?file=1&comment=42",
} satisfies CommentMentionEmailProps;
