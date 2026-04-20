import { Link } from "@tanstack/react-router";
import { FolderKanban } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { useUsers } from "@/api/users/query";
import { useCompanies } from "@/api/companies/query";
import { authClient } from "@/lib/auth-client";
import { getProjectColor } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";

export function UserDetailDialog() {
  const userDetailId = useUIStore((s) => s.userDetailId);
  const closeUserDetail = useUIStore((s) => s.closeUserDetail);

  const { data: session } = authClient.useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canManage = role === "admin" || role === "manager";

  const { data: users } = useUsers({}, { enabled: canManage && !!userDetailId });
  const { data: companies } = useCompanies({ enabled: canManage && !!userDetailId });

  const user = users?.find((u) => u.id === userDetailId) ?? null;
  const companyName = (id: number | null) =>
    companies?.find((c) => c.id === id)?.name ?? "—";

  return (
    <Dialog open={!!userDetailId} onOpenChange={(o) => !o && closeUserDetail()}>
      <DialogContent className="max-w-sm">
        {user ? (
          <>
            <DialogHeader className="items-center text-center">
              <UserAvatar
                name={user.name}
                image={user.image}
                userId={user.id}
                className="size-14"
              />
              <DialogTitle className="mt-2">{user.name}</DialogTitle>
              <DialogDescription>{user.email}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3.5 py-2.5">
                <span className="text-[12px] font-medium text-text-tertiary uppercase tracking-wide">
                  Role
                </span>
                <RoleBadge role={user.role} />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3.5 py-2.5">
                <span className="text-[12px] font-medium text-text-tertiary uppercase tracking-wide">
                  Company
                </span>
                <span className="text-[13px] font-medium text-foreground">
                  {companyName(user.companyId)}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <FolderKanban className="size-3.5 text-text-tertiary" />
                  <span className="text-[12px] font-medium text-text-tertiary uppercase tracking-wide">
                    Projects ({user.projects?.length ?? 0})
                  </span>
                </div>
                {user.projects?.length ? (
                  <div className="flex flex-col gap-1">
                    {user.projects.map((p) => (
                      <Link
                        key={p.id}
                        to="/projects/$id/viewer"
                        params={{ id: String(p.id) }}
                        className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 transition-colors hover:bg-muted/50"
                        onClick={() => closeUserDetail()}
                      >
                        <div
                          className="flex size-7 shrink-0 items-center justify-center rounded-md"
                          style={{ backgroundColor: getProjectColor(p.id) + "18" }}
                        >
                          <FolderKanban
                            className="size-3.5"
                            style={{ color: getProjectColor(p.id) }}
                          />
                        </div>
                        <span className="truncate text-[13px] font-medium text-foreground">
                          {p.name}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-text-secondary text-center py-3">
                    No projects yet
                  </p>
                )}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
