import type { Comment, User } from "@/types";

function authorLabel(c: Comment, currentUser?: User | null): string {
  const n = c.author?.name?.trim();
  if (n) return n;
  if (currentUser && c.authorId === currentUser.id && currentUser.name?.trim()) return currentUser.name.trim();
  const e = c.author?.email?.trim();
  if (e) return e.split("@")[0] || e;
  return `user-${c.authorId.slice(0, 6)}`;
}

function authorEmail(c: Comment, currentUser?: User | null): string | null {
  const e = c.author?.email?.trim();
  if (e) return e;
  if (currentUser && c.authorId === currentUser.id) return currentUser.email?.trim() ?? null;
  return null;
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toISOString(); } catch { return iso; }
}

function renderReply(r: Comment, currentUser?: User | null): string {
  const who = authorLabel(r, currentUser);
  const when = fmtDate(r.createdAt);
  const body = r.body.split("\n").map((l) => `  ${l}`).join("\n");
  return `- **${who}** (${when}):\n${body}`;
}

function renderHeader(c: Comment, filePath?: string): string {
  const loc = filePath ? `${filePath}` : `comment-${c.id}`;
  const view = c.anchor?.viewId ? ` · view: ${c.anchor.viewId}` : "";
  return `## Comment #${c.id} — ${loc}${view}`;
}

function renderMeta(c: Comment, currentUser?: User | null): string {
  const who = authorLabel(c, currentUser);
  const email = authorEmail(c, currentUser);
  const tags = (c.tags ?? []).map((t) => t.name).join(", ");
  const lines = [
    `- **Author:** ${who}${email ? ` <${email}>` : ""}`,
    `- **Created:** ${fmtDate(c.createdAt)}`,
  ];
  if (c.updatedAt !== c.createdAt) lines.push(`- **Edited:** ${fmtDate(c.updatedAt)}`);
  if (tags) lines.push(`- **Tags:** ${tags}`);
  if (c.anchor?.selector) lines.push(`- **Selector:** \`${c.anchor.selector}\``);
  if (c.anchor?.xpath) lines.push(`- **XPath:** \`${c.anchor.xpath}\``);
  if (c.anchor?.tagName) {
    const txt = c.anchor.textContent?.trim().slice(0, 120) ?? "";
    lines.push(`- **Element:** \`<${c.anchor.tagName}>\`${txt ? ` — "${txt}"` : ""}`);
  }
  if (c.resolved) lines.push(`- **Status:** resolved`);
  return lines.join("\n");
}

export function commentToMarkdown(
  c: Comment,
  opts: { currentUser?: User | null; filePath?: string; parent?: Comment | null } = {},
): string {
  const { currentUser, filePath, parent } = opts;
  const parts: string[] = [];

  if (parent) {
    const pWho = authorLabel(parent, currentUser);
    const pBody = parent.body.split("\n").map((l) => `> ${l}`).join("\n");
    parts.push(`> **In reply to ${pWho}:**\n${pBody}`, "");
  }

  parts.push(renderHeader(c, filePath));
  parts.push("");
  parts.push(renderMeta(c, currentUser));
  parts.push("");
  parts.push(c.body);

  const replies = c.replies ?? [];
  if (replies.length) {
    parts.push("");
    parts.push(`### Replies (${replies.length})`);
    for (const r of replies) parts.push(renderReply(r, currentUser));
  }

  return parts.join("\n");
}

export function commentsToMarkdown(
  list: Comment[],
  opts: { currentUser?: User | null; filePath?: string; title?: string } = {},
): string {
  const { currentUser, filePath, title } = opts;
  const header = [
    `# ${title ?? "Comments export"}`,
    "",
    `- **Exported:** ${new Date().toISOString()}`,
    filePath ? `- **File:** ${filePath}` : null,
    `- **Count:** ${list.length}`,
  ].filter(Boolean).join("\n");

  const body = list
    .map((c) => commentToMarkdown(c, { currentUser, filePath }))
    .join("\n\n---\n\n");

  return `${header}\n\n---\n\n${body}\n`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadMarkdown(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".md") ? filename : `${filename}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function mdFilename(base: string): string {
  const slug = base.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "comments";
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${slug}-${stamp}.md`;
}
