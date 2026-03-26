import { cn } from "@/lib/utils";
import type { Role } from "@/types";

const styles: Record<Role, string> = {
  admin: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  manager: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  client: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize",
        styles[role] ?? "bg-muted text-muted-foreground",
      )}
    >
      {role}
    </span>
  );
}
