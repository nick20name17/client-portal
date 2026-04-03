
/** Renders @[Name](userId) tokens as highlighted spans; plain text otherwise. */
export function renderMentionBody(body: string): React.ReactNode {
  const regex = /@\[([^\]]+)\]\([^)]+\)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    if (match.index > last) parts.push(body.slice(last, match.index));
    parts.push(
      <span key={match.index} className="font-medium text-primary">
        @{match[1]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts.length > 0 ? parts : body;
}
