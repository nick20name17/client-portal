
import { useMemo, useState } from "react";
import { Search, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { RoleBadge } from "@/components/shared/RoleBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAddProjectMember,
  useProjectMembers,
  useRemoveProjectMember,
} from "@/api/projects/query";
import { useUsers } from "@/api/users/query";
import { ApiError } from "@/lib/api";
import type { Role } from "@/types";

export function ProjectMembersSheet({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: number | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: session } = authClient.useSession();
  const sessionUser = session?.user as { id?: string; role?: string } | undefined;
  const appRole = sessionUser?.role;
  const currentUserId = sessionUser?.id;

  const { data: members, isPending } = useProjectMembers(projectId ?? undefined);
  const { data: allUsers } = useUsers(undefined, { enabled: appRole === "admin" });
  const add = useAddProjectMember();
  const remove = useRemoveProjectMember();

  const [search, setSearch] = useState("");

  const memberIds = new Set(members?.map((m) => m.userId) ?? []);

  const candidates = useMemo(() => {
    const base = allUsers?.filter((u) => !memberIds.has(u.id) && u.role !== "admin") ?? [];
    if (!search.trim()) return base;
    const s = search.toLowerCase();
    return base.filter(
      (u) =>
        u.name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s),
    );
  }, [allUsers, memberIds, search]);

  async function addMember(userId: string, role: "manager" | "client") {
    if (!projectId) return;
    try {
      await add.mutateAsync({ projectId, userId, role });
      toast.success("Member added");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to add");
    }
  }

  async function removeMember(uid: string) {
    if (!projectId) return;
    try {
      await remove.mutateAsync({ projectId, userId: uid });
      toast.success("Member removed");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to remove");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-md flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>Project members</DialogTitle>
          <DialogDescription>People who can access this project.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Current members */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {isPending ? (
              <div className="space-y-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                    <Skeleton className="size-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !members?.length ? (
              <p className="py-6 text-center text-[13px] text-text-secondary">No members yet.</p>
            ) : (
              <ul className="space-y-0.5">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-bg-hover"
                  >
                    <UserAvatar name={m.user.name} image={m.user.image} className="size-8 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-foreground">{m.user.name}</p>
                      <RoleBadge role={m.user.role as Role} className="mt-0.5" />
                    </div>
                    {m.userId !== currentUserId ? (
                      <button
                        type="button"
                        onClick={() => void removeMember(m.userId)}
                        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-text-tertiary opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        aria-label="Remove member"
                      >
                        <UserMinus className="size-3.5" />
                      </button>
                    ) : (
                      <div className="size-7 shrink-0" />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Add people section */}
          {appRole === "admin" ? (
            <div className="border-t border-border">
              {/* Search */}
              <div className="px-3 pt-3 pb-2">
                <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-text-tertiary">
                  Add people
                </p>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-tertiary" />
                  <Input
                    placeholder="Search by name or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-8 text-[13px]"
                  />
                </div>
              </div>

              {/* Candidate list */}
              <div className="max-h-52 overflow-y-auto px-3 pb-3">
                {candidates.length === 0 ? (
                  <p className="py-3 text-center text-[13px] text-text-secondary">
                    {search.trim()
                      ? "No users match your search."
                      : "Everyone eligible is already a member."}
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {candidates.map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-bg-hover"
                      >
                        <UserAvatar name={u.name ?? u.email ?? "?"} image={u.image} className="size-7 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-foreground leading-tight">
                            {u.name ?? "—"}
                          </p>
                          <p className="truncate text-[11px] text-text-tertiary leading-tight">
                            {u.email}
                          </p>
                        </div>
                        <RoleBadge role={u.role as Role} className="shrink-0" />
                        <Button
                          size="icon-sm"
                          variant="outline"
                          className="size-7 shrink-0"
                          disabled={add.isPending}
                          onClick={() => void addMember(u.id, u.role as "manager" | "client")}
                          aria-label={`Add ${u.name}`}
                        >
                          <UserPlus className="size-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <p className="border-t border-border px-5 py-4 text-[13px] text-text-secondary">
              Only admins can add users from the directory.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
