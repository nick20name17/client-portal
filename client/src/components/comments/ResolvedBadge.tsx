import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export function ResolvedBadge({ resolved, className }: { resolved: boolean; className?: string }) {
  if (!resolved) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive",
          className,
        )}
      >
        Open
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-status-done",
        className,
      )}
      style={{ backgroundColor: "color-mix(in oklch, var(--status-done) 12%, transparent)" }}
    >
      <Check className="size-3" />
      Resolved
    </span>
  );
}
