import { cn } from "@/lib/utils";
import type { Tag } from "@/types";

export function TagBadge({ tag, className }: { tag: Pick<Tag, "name" | "color">; className?: string }) {
  return (
    <span
      className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-medium", className)}
      style={{
        backgroundColor: `${tag.color}22`,
        color: tag.color,
      }}
    >
      {tag.name}
    </span>
  );
}
