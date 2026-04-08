import * as React from "react";
import { Actor, Badge, CtaButton, ProjectTile } from "./_parts";
import { EmailShell } from "./_shell";

export interface MemberAddedEmailProps {
  actorName: string;
  projectName: string;
  ctaUrl: string;
}

export function MemberAddedEmail({ actorName, projectName, ctaUrl }: MemberAddedEmailProps) {
  const previewText = `${actorName} added you to project "${projectName}"`;
  return (
    <EmailShell
      previewText={previewText}
      footerReason="You were added as a member"
    >
      <Badge bg="#E8F0FE" fg="#4285F4" symbol="+" label="You've been added to a project" />
      <Actor name={actorName} description={`added you to project "${projectName}"`} />
      <ProjectTile name={projectName} />
      <CtaButton href={ctaUrl} label="Open project" />
    </EmailShell>
  );
}

export default MemberAddedEmail;

MemberAddedEmail.PreviewProps = {
  actorName: "Ivan",
  projectName: "Website Redesign",
  ctaUrl: "http://localhost:3001/projects/1",
} satisfies MemberAddedEmailProps;
