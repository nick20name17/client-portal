import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useReducer, useState } from "react";
import { FolderKanban, MoreHorizontal, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { RoleGate } from "@/components/shared/RoleGate";
import { EmptyState } from "@/components/shared/EmptyState";
import { authClient } from "@/lib/auth-client";
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
import { Badge } from "@/components/ui/badge";
import { getProjectColor } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanies } from "@/api/companies/query";
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from "@/api/users/query";
import type { Role, User } from "@/types";
import { apiErrorMsg } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/users/")({
  component: UsersPage,
});

function UsersPage() {
  return (
    <RoleGate allow={["admin", "manager"]}>
      <UsersContent />
    </RoleGate>
  );
}

// --- Reducer ---

type UserFormState = {
  name: string;
  email: string;
  tmpPassword: string;
  role: Role;
  companyId: string;
};

type UserDialogState = {
  dialogOpen: boolean;
  editing: User | null;
  form: UserFormState;
  deleteTarget: User | null;
};

const initialUserDialogState: UserDialogState = {
  dialogOpen: false,
  editing: null,
  form: { name: "", email: "", tmpPassword: "", role: "client", companyId: "" },
  deleteTarget: null,
};

type UserDialogAction =
  | { type: "OPEN_CREATE" }
  | { type: "OPEN_EDIT"; payload: User }
  | { type: "CLOSE_DIALOG" }
  | { type: "SET_FORM"; payload: Partial<UserFormState> }
  | { type: "SET_DELETE_TARGET"; payload: User | null };

function userDialogReducer(state: UserDialogState, action: UserDialogAction): UserDialogState {
  switch (action.type) {
    case "OPEN_CREATE":
      return {
        ...state,
        dialogOpen: true,
        editing: null,
        form: { name: "", email: "", tmpPassword: "", role: "client", companyId: "" },
      };
    case "OPEN_EDIT":
      return {
        ...state,
        dialogOpen: true,
        editing: action.payload,
        form: {
          name: action.payload.name,
          email: action.payload.email,
          tmpPassword: "",
          role: action.payload.role,
          companyId: action.payload.companyId != null ? String(action.payload.companyId) : "",
        },
      };
    case "CLOSE_DIALOG":
      return { ...state, dialogOpen: false };
    case "SET_FORM":
      return { ...state, form: { ...state.form, ...action.payload } };
    case "SET_DELETE_TARGET":
      return { ...state, deleteTarget: action.payload };
    default:
      return state;
  }
}

// --- Sub-components ---

function UsersFilterBar({
  q,
  onQChange,
  roleFilter,
  onRoleFilterChange,
  companyFilter,
  onCompanyFilterChange,
  companies,
}: {
  q: string;
  onQChange: (v: string) => void;
  roleFilter: string;
  onRoleFilterChange: (v: string) => void;
  companyFilter: string;
  onCompanyFilterChange: (v: string) => void;
  companies: { id: number; name: string }[] | undefined;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-tertiary" />
        <Input
          placeholder="Search name or email…"
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          className="pl-8 h-8 text-[13px]"
        />
      </div>
      <Select
        value={roleFilter || "__all"}
        onValueChange={(v) => onRoleFilterChange(v === "__all" ? "" : v)}
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
        onValueChange={(v) => onCompanyFilterChange(v === "__all" ? "" : v)}
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
  );
}

function UsersTable({
  users,
  companyName,
  onRowClick,
  onEdit,
  onDelete,
}: {
  users: User[];
  companyName: (id: number | null) => string;
  onRowClick?: (u: User) => void;
  onEdit?: (u: User) => void;
  onDelete?: (u: User) => void;
}) {
  const showActions = !!(onEdit || onDelete);
  const cols = showActions
    ? "grid-cols-[1fr_auto_auto_auto_auto_auto]"
    : "grid-cols-[1fr_auto_auto_auto_auto]";
  return (
    <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
      <div className={cn("grid items-center gap-4 border-b border-border px-5 py-2.5 text-[12px] font-medium text-text-tertiary", cols)}>
        <span>User</span>
        <span className="hidden w-40 sm:block">Email</span>
        <span className="hidden w-20 sm:block">Role</span>
        <span className="hidden w-28 sm:block">Company</span>
        <span className="hidden w-36 sm:block">Projects</span>
        {showActions ? <span className="w-8" /> : null}
      </div>
      {users.map((u, i) => (
        <div
          key={u.id}
          onClick={() => onRowClick?.(u)}
          className={cn(
            "grid items-center gap-4 px-5 py-3 transition-colors hover:bg-bg-hover",
            cols,
            onRowClick && "cursor-pointer",
            i < users.length - 1 && "border-b border-border",
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
          <span className="hidden w-36 sm:flex items-center gap-1">
            {u.projects?.slice(0, 3).map((p) => (
              <Badge key={p.id} variant="secondary" className="text-[11px] truncate max-w-[5rem]" style={{ backgroundColor: getProjectColor(p.id) + "18", color: getProjectColor(p.id) }}>{p.name}</Badge>
            ))}
            {(u.projects?.length ?? 0) > 3 ? (
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                +{u.projects!.length - 3}
              </span>
            ) : null}
            {!u.projects?.length ? <span className="text-[12px] text-text-tertiary">&mdash;</span> : null}
          </span>
          {showActions ? (
            <div className="w-8 flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  {onEdit ? (
                    <DropdownMenuItem onClick={() => onEdit(u)}>
                      <Pencil className="size-4" />
                      Edit
                    </DropdownMenuItem>
                  ) : null}
                  {onDelete ? (
                    <DropdownMenuItem variant="destructive" onClick={() => onDelete(u)}>
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function UserFormDialog({
  open,
  editing,
  form,
  companies,
  isAdmin,
  isSaving,
  onFormChange,
  onSave,
  onClose,
}: {
  open: boolean;
  editing: User | null;
  form: UserFormState;
  companies: { id: number; name: string }[] | undefined;
  isAdmin: boolean;
  isSaving: boolean;
  onFormChange: (patch: Partial<UserFormState>) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
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
                  onChange={(e) => onFormChange({ name: e.target.value })}
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
                  onChange={(e) => onFormChange({ email: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="user-pw">Temporary password</FieldLabel>
                <Input
                  id="user-pw"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={form.tmpPassword}
                  onChange={(e) => onFormChange({ tmpPassword: e.target.value })}
                />
                <p className="text-[12px] text-text-tertiary">User should change on first login</p>
              </Field>
            </>
          ) : null}
          {isAdmin ? (
            <>
              <Field>
                <FieldLabel>Role</FieldLabel>
                <Select
                  value={form.role}
                  onValueChange={(v) => onFormChange({ role: v as Role })}
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
                    onValueChange={(v) => onFormChange({ companyId: v === "__none" ? "" : v })}
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
            </>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} isPending={isSaving} disabled={isSaving}>
            {editing ? "Save changes" : "Create user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: User | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{target?.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Delete user
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// --- Main component ---

function UsersContent() {
  const { data: session } = authClient.useSession();
  const appRole = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = appRole === "admin";

  const [roleFilter, setRoleFilter] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState<string>("");
  const [q, setQ] = useState("");
  const [detailUser, setDetailUser] = useState<User | null>(null);

  const { data: companies } = useCompanies();
  const { data, isPending } = useUsers({
    role: roleFilter || undefined,
    companyId: companyFilter || undefined,
  });
  const create = useCreateUser();
  const update = useUpdateUser();
  const remove = useDeleteUser();

  const [state, dispatch] = useReducer(userDialogReducer, initialUserDialogState);

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

  async function save() {
    const role = isAdmin ? state.form.role : "client";
    const resolvedCompanyId = role === "admin" ? null : isAdmin ? (state.form.companyId ? Number(state.form.companyId) : null) : null;
    const trimmedName = state.form.name.trim();
    const trimmedEmail = state.form.email.trim();
    try {
      if (state.editing) {
        await update.mutateAsync({
          id: state.editing.id,
          role,
          companyId: resolvedCompanyId,
        });
        toast.success("User updated");
      } else {
        if (state.form.tmpPassword.length < 8) {
          toast.error("Password must be at least 8 characters");
          return;
        }
        await create.mutateAsync({
          name: trimmedName,
          email: trimmedEmail,
          role,
          tmpPassword: state.form.tmpPassword,
          companyId: resolvedCompanyId,
        });
        toast.success("User created");
      }
      dispatch({ type: "CLOSE_DIALOG" });
    } catch (e) {
      toast.error(apiErrorMsg(e, "Request failed"));
    }
  }

  async function confirmDelete() {
    if (!state.deleteTarget) return;
    try {
      await remove.mutateAsync(state.deleteTarget.id);
      toast.success("User removed");
      dispatch({ type: "SET_DELETE_TARGET", payload: null });
    } catch (e) {
      toast.error(apiErrorMsg(e, "Delete failed"));
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
        <Button onClick={() => dispatch({ type: "OPEN_CREATE" })} size="sm">
          <Plus className="size-3.5" />
          New user
        </Button>
      </div>

      {isAdmin ? (
        <UsersFilterBar
          q={q}
          onQChange={setQ}
          roleFilter={roleFilter}
          onRoleFilterChange={setRoleFilter}
          companyFilter={companyFilter}
          onCompanyFilterChange={setCompanyFilter}
          companies={companies}
        />
      ) : (
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-tertiary" />
          <Input
            placeholder="Search name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 h-8 text-[13px]"
          />
        </div>
      )}

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
            <Button onClick={() => dispatch({ type: "OPEN_CREATE" })} size="sm">
              <Plus className="size-3.5" />
              New user
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <UsersTable
          users={filtered}
          companyName={companyName}
          onRowClick={setDetailUser}
          onEdit={isAdmin ? (u) => dispatch({ type: "OPEN_EDIT", payload: u }) : undefined}
          onDelete={isAdmin ? (u) => dispatch({ type: "SET_DELETE_TARGET", payload: u }) : undefined}
        />
      )}

      <UserFormDialog
        open={state.dialogOpen}
        editing={state.editing}
        form={state.form}
        companies={companies}
        isAdmin={isAdmin}
        isSaving={isSaving}
        onFormChange={(patch) => dispatch({ type: "SET_FORM", payload: patch })}
        onSave={() => void save()}
        onClose={() => dispatch({ type: "CLOSE_DIALOG" })}
      />

      <DeleteUserDialog
        target={state.deleteTarget}
        onClose={() => dispatch({ type: "SET_DELETE_TARGET", payload: null })}
        onConfirm={() => void confirmDelete()}
      />

      <Dialog open={!!detailUser} onOpenChange={(o) => !o && setDetailUser(null)}>
        <DialogContent className="max-w-sm">
          {detailUser ? (
            <>
              <DialogHeader className="items-center text-center">
                <UserAvatar name={detailUser.name} image={detailUser.image} userId={detailUser.id} className="size-14 text-lg" />
                <DialogTitle className="mt-2">{detailUser.name}</DialogTitle>
                <DialogDescription>{detailUser.email}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3.5 py-2.5">
                  <span className="text-[12px] font-medium text-text-tertiary uppercase tracking-wide">Role</span>
                  <RoleBadge role={detailUser.role} />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3.5 py-2.5">
                  <span className="text-[12px] font-medium text-text-tertiary uppercase tracking-wide">Company</span>
                  <span className="text-[13px] font-medium text-foreground">{companyName(detailUser.companyId)}</span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <FolderKanban className="size-3.5 text-text-tertiary" />
                    <span className="text-[12px] font-medium text-text-tertiary uppercase tracking-wide">
                      Projects ({detailUser.projects?.length ?? 0})
                    </span>
                  </div>
                  {detailUser.projects?.length ? (
                    <div className="flex flex-col gap-1">
                      {detailUser.projects.map((p) => (
                        <Link
                          key={p.id}
                          to="/projects/$id/viewer"
                          params={{ id: String(p.id) }}
                          className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 transition-colors hover:bg-muted/50"
                          onClick={() => setDetailUser(null)}
                        >
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: getProjectColor(p.id) + "18" }}>
                            <FolderKanban className="size-3.5" style={{ color: getProjectColor(p.id) }} />
                          </div>
                          <span className="truncate text-[13px] font-medium text-foreground">{p.name}</span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-text-secondary text-center py-3">No projects yet</p>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
