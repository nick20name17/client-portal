import { cn } from "@/lib/utils";
import type { Tag } from "@/types";

export function TagBadge({ tag, className }: { tag: Pick<Tag, "name" | "color">; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[12px] font-medium leading-none",
        className,
      )}
      style={{
        backgroundColor: `${tag.color}22`,
        color: tag.color,
      }}
    >
      {tag.name}
    </span>
  );
}
