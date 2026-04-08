import * as React from "react";
import { Actor, Badge, CtaButton, ProjectTile } from "./_parts";
import { EmailShell } from "./_shell";

export interface CommentResolvedEmailProps {
  actorName: string;
  projectName: string;
  ctaUrl: string;
}

export function CommentResolvedEmail({
  actorName,
  projectName,
  ctaUrl,
}: CommentResolvedEmailProps) {
  const previewText = "Your comment has been resolved";
  return (
    <EmailShell previewText={previewText} footerReason="You authored this comment">
      <Badge bg="#E8F5E9" fg="#4CAF50" symbol="✓" label="Comment resolved" />
      <Actor
        name={actorName}
        description={`marked your comment as resolved in "${projectName}"`}
      />
      <ProjectTile name={projectName} />
      <CtaButton href={ctaUrl} label="View" />
    </EmailShell>
  );
}

export default CommentResolvedEmail;

CommentResolvedEmail.PreviewProps = {
  actorName: "Ivan",
  projectName: "Website Redesign",
  ctaUrl: "http://localhost:3001/projects/1/viewer?file=1&comment=42",
} satisfies CommentResolvedEmailProps;
