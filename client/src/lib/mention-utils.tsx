
export function MentionBody({ text }: { text: string }) {
  const regex = /@\[([^\]]+)\]\([^)]+\)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <span key={match.index} className="font-medium text-primary">
        @{match[1]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts.length > 0 ? parts : text}</>;
}
