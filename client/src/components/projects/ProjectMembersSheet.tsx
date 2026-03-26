"use client";

import { useState } from "react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/shared/UserAvatar";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddProjectMember, useProjectMembers, useRemoveProjectMember } from "@/hooks/use-projects";
import { useUsers } from "@/hooks/use-users";
import { ApiError } from "@/lib/api";

export function ProjectMembersSheet({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: session } = authClient.useSession();
  const appRole = (session?.user as { role?: string } | undefined)?.role;

  const { data: members, isPending } = useProjectMembers(projectId ?? undefined);
  const { data: allUsers } = useUsers(undefined, { enabled: appRole === "admin" });
  const add = useAddProjectMember();
  const remove = useRemoveProjectMember();

  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"manager" | "client">("client");

  const memberIds = new Set(members?.map((m) => m.userId) ?? []);
  const candidates =
    allUsers?.filter((u) => !memberIds.has(u.id) && u.role !== "admin") ?? [];

  async function addMember() {
    if (!projectId || !userId) return;
    try {
      await add.mutateAsync({ projectId, userId, role });
      toast.success("Member added");
      setUserId("");
      setRole("client");
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Project members</SheetTitle>
          <SheetDescription>People who can access this project.</SheetDescription>
        </SheetHeader>
        {isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <ul className="flex flex-col gap-2">
            {members?.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <UserAvatar name={m.user.name} image={m.user.image} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.user.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">{m.role}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void removeMember(m.userId)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        {appRole === "admin" ? (
          <div className="mt-auto space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium">Add member</p>
            <div className="grid gap-2">
              <Label>User</Label>
              {candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">Everyone eligible is already a member.</p>
              ) : (
                <Select value={userId || undefined} onValueChange={setUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "manager" | "client")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={!userId || add.isPending} onClick={() => void addMember()}>
              Add
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Only admins can add users from the directory. You can still remove members you manage.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
