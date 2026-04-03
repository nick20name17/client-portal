import { cn } from "@/lib/utils";
import type { Role } from "@/types";

const textColors: Record<Role, string> = {
  admin: "text-role-admin",
  manager: "text-role-manager",
  client: "text-role-sale",
};

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[12px] font-semibold capitalize",
        textColors[role] ?? "text-muted-foreground",
        className,
      )}
    >
      {role}
    </span>
  );
}
