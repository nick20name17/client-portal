import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export function ResolvedBadge({ resolved, className }: { resolved: boolean; className?: string }) {
  if (!resolved) {
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700", className)}>
        Open
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-[var(--status-resolved)]",
        className,
      )}
      style={{ backgroundColor: "oklch(0.527 0.154 150.069 / 12%)" }}
    >
      <Check className="size-3" />
      Resolved
    </span>
  );
}
