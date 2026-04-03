import { Body, Button, Container, Hr, Html, Preview, Section, Text } from "@react-email/components";
import * as React from "react";

interface NotificationEmailProps {
  previewText: string;
  heading: string;
  body: string;
  commentSnippet?: string;
  ctaLabel: string;
  ctaUrl: string;
}

export function NotificationEmail({
  previewText,
  heading,
  body,
  commentSnippet,
  ctaLabel,
  ctaUrl,
}: NotificationEmailProps) {
  return (
    <Html lang="en">
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>EBMS</Text>
          <Hr style={styles.hr} />
          <Section style={styles.section}>
            <Text style={styles.heading}>{heading}</Text>
            <Text style={styles.text}>{body}</Text>
            {commentSnippet && (
              <Text style={styles.snippet}>{commentSnippet}</Text>
            )}
            <Button href={ctaUrl} style={styles.button}>
              {ctaLabel}
            </Button>
          </Section>
          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            You received this email because you are a member of a project in EBMS.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: "#f5f5f5",
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  },
  container: {
    maxWidth: "480px",
    margin: "0 auto",
    padding: "32px 24px",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    marginTop: "32px",
    marginBottom: "32px",
  },
  brand: {
    fontSize: "20px",
    fontWeight: "700" as const,
    color: "#111111",
    margin: "0 0 16px",
  },
  hr: {
    borderColor: "#e5e5e5",
    margin: "0",
  },
  section: {
    padding: "24px 0",
  },
  heading: {
    fontSize: "16px",
    fontWeight: "600" as const,
    color: "#111111",
    margin: "0 0 8px",
  },
  text: {
    fontSize: "14px",
    color: "#444444",
    lineHeight: "1.5",
    margin: "0 0 16px",
  },
  snippet: {
    fontSize: "13px",
    color: "#666666",
    backgroundColor: "#f9f9f9",
    borderLeft: "3px solid #e5e5e5",
    padding: "8px 12px",
    borderRadius: "0 4px 4px 0",
    margin: "0 0 20px",
    fontStyle: "italic",
  },
  button: {
    backgroundColor: "#111111",
    color: "#ffffff",
    padding: "10px 20px",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "500" as const,
    textDecoration: "none",
    display: "inline-block",
  },
  footer: {
    fontSize: "12px",
    color: "#999999",
    margin: "16px 0 0",
  },
} as const;

NotificationEmail.PreviewProps = {
  previewText: "Ivan left a comment in project Website",
  heading: "New comment",
  body: "Ivan left a comment in project Website",
  commentSnippet: "Please pay attention to the spacing in the header.",
  ctaLabel: "View",
  ctaUrl: "http://localhost:3001/projects/1/viewer?file=1",
} satisfies NotificationEmailProps;
