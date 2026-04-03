import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MoreHorizontal, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { RoleGate } from "@/components/shared/RoleGate";
import { EmptyState } from "@/components/shared/EmptyState";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanies } from "@/api/companies/query";
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from "@/api/users/query";
import type { Role, User } from "@/types";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/users/")({
  component: UsersPage,
});

function UsersPage() {
  return (
    <RoleGate allow={["admin"]}>
      <UsersContent />
    </RoleGate>
  );
}

function UsersContent() {
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState<string>("");
  const [q, setQ] = useState("");

  const { data: companies } = useCompanies();
  const { data, isPending } = useUsers({
    role: roleFilter || undefined,
    companyId: companyFilter || undefined,
  });
  const create = useCreateUser();
  const update = useUpdateUser();
  const remove = useDeleteUser();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    tmpPassword: "",
    role: "client" as Role,
    companyId: "" as string,
  });
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!q.trim()) return data;
    const s = q.toLowerCase();
    return data.filter(
      (u) => u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s),
    );
  }, [data, q]);

  const companyName = (id: number | null) =>
    companies?.find((c) => c.id === id)?.name ?? "—";

  function openCreate() {
    setEditing(null);
    setForm({ name: "", email: "", tmpPassword: "", role: "client", companyId: "" });
    setDialogOpen(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      tmpPassword: "",
      role: u.role,
      companyId: u.companyId != null ? String(u.companyId) : "",
    });
    setDialogOpen(true);
  }

  async function save() {
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          role: form.role,
          companyId: form.role === "admin" ? null : form.companyId ? Number(form.companyId) : null,
        });
        toast.success("User updated");
      } else {
        if (form.tmpPassword.length < 8) {
          toast.error("Password must be at least 8 characters");
          return;
        }
        await create.mutateAsync({
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          tmpPassword: form.tmpPassword,
          companyId: form.role === "admin" ? null : form.companyId ? Number(form.companyId) : null,
        });
        toast.success("User created");
      }
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Request failed");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success("User removed");
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Delete failed");
    }
  }

  const isSaving = create.isPending || update.isPending;

  return (
    <div className="flex flex-1 flex-col gap-5 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight text-foreground">Users</h1>
          <p className="mt-0.5 text-[13px] text-text-secondary">
            {data ? `${data.length} account${data.length === 1 ? "" : "s"}` : "Create and manage accounts"}
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="size-3.5" />
          New user
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-tertiary" />
          <Input
            placeholder="Search name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 h-8 text-[13px]"
          />
        </div>
        <Select
          value={roleFilter || "__all"}
          onValueChange={(v) => setRoleFilter(v === "__all" ? "" : v)}
        >
          <SelectTrigger className="h-8 w-full text-[13px] sm:w-[130px]">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="client">Client</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={companyFilter || "__all"}
          onValueChange={(v) => setCompanyFilter(v === "__all" ? "" : v)}
        >
          <SelectTrigger className="h-8 w-full text-[13px] sm:w-[160px]">
            <SelectValue placeholder="All companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All companies</SelectItem>
            {companies?.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-0"
            >
              <Skeleton className="size-8 rounded-full shrink-0" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24 ml-auto hidden sm:block" />
              <Skeleton className="size-7 rounded-md" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? "No matches" : "No users yet"}
          description={q ? "Try a different search term." : "Create the first user account."}
        >
          {!q ? (
            <Button onClick={openCreate} size="sm">
              <Plus className="size-3.5" />
              New user
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 border-b border-border px-5 py-2.5 text-[12px] font-medium text-text-tertiary">
            <span>User</span>
            <span className="hidden w-40 sm:block">Email</span>
            <span className="hidden w-20 sm:block">Role</span>
            <span className="hidden w-28 sm:block">Company</span>
            <span className="w-8" />
          </div>
          {filtered.map((u, i) => (
            <div
              key={u.id}
              className={cn(
                "grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-5 py-3 transition-colors hover:bg-bg-hover",
                i < filtered.length - 1 && "border-b border-border",
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <UserAvatar name={u.name} image={u.image} userId={u.id} className="size-7 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-foreground">{u.name}</p>
                  <p className="truncate text-[12px] text-text-tertiary sm:hidden">{u.email}</p>
                </div>
              </div>
              <span className="hidden w-40 truncate text-[13px] text-text-secondary sm:block">
                {u.email}
              </span>
              <span className="hidden w-20 sm:block">
                <RoleBadge role={u.role} />
              </span>
              <span className="hidden w-28 truncate text-[13px] text-text-secondary sm:block">
                {companyName(u.companyId)}
              </span>
              <div className="w-8 flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm">
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={() => openEdit(u)}>
                      <Pencil className="size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(u)}>
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit user" : "New user"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update role or company assignment." : "Create a new workspace account."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {!editing ? (
              <>
                <Field>
                  <FieldLabel htmlFor="user-name">Full name</FieldLabel>
                  <Input
                    id="user-name"
                    placeholder="Jane Smith"
                    autoComplete="off"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="user-email">Email</FieldLabel>
                  <Input
                    id="user-email"
                    type="email"
                    placeholder="jane@company.com"
                    autoComplete="off"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="user-pw">Temporary password</FieldLabel>
                  <Input
                    id="user-pw"
                    type="password"
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    value={form.tmpPassword}
                    onChange={(e) => setForm((f) => ({ ...f, tmpPassword: e.target.value }))}
                  />
                  <p className="text-[12px] text-text-tertiary">User should change on first login</p>
                </Field>
              </>
            ) : null}
            <Field>
              <FieldLabel>Role</FieldLabel>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {form.role !== "admin" ? (
              <Field>
                <FieldLabel>Company</FieldLabel>
                <Select
                  value={form.companyId || "__none"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, companyId: v === "__none" ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No company</SelectItem>
                    {companies?.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void save()} isPending={isSaving} disabled={isSaving}>
              {editing ? "Save changes" : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              Delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
