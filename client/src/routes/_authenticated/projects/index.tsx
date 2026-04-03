import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ExternalLink,
  FolderKanban,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { ProjectMembersSheet } from "@/components/projects/ProjectMembersSheet";
import { RoleGate } from "@/components/shared/RoleGate";
import { EmptyState } from "@/components/shared/EmptyState";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Textarea } from "@/components/ui/textarea";
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
import {
  useCreateProject,
  useDeleteProject,
  useProjects,
  useSyncProjectFiles,
  useUpdateProject,
} from "@/api/projects/query";
import type { Project } from "@/types";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: ProjectsPage,
});

function isGithubUrl(s: string) {
  try {
    const u = new URL(s.trim());
    return u.hostname === "github.com" || u.hostname.endsWith(".github.com");
  } catch {
    return false;
  }
}

function ProjectsPage() {
  return (
    <RoleGate allow={["admin", "manager"]}>
      <ProjectsContent />
    </RoleGate>
  );
}

function ProjectsContent() {
  const { data: sessionData } = authClient.useSession();
  const appRole = (sessionData?.user as { role?: string } | undefined)?.role;
  const companyId =
    (sessionData?.user as { companyId?: number | null } | undefined)?.companyId ?? null;

  const { data: companies } = useCompanies({ enabled: appRole === "admin" });
  const { data, isPending } = useProjects();
  const create = useCreateProject();
  const update = useUpdateProject();
  const remove = useDeleteProject();
  const sync = useSyncProjectFiles();

  const [q, setQ] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    repoUrl: "",
    companyId: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [membersProjectId, setMembersProjectId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data;
    if (appRole === "manager" && companyId) {
      rows = rows.filter((p) => p.companyId === companyId);
    }
    if (companyFilter) {
      rows = rows.filter((p) => String(p.companyId) === companyFilter);
    }
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        (p.company?.name ?? "").toLowerCase().includes(s),
    );
  }, [data, q, companyFilter, appRole, companyId]);

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      description: "",
      repoUrl: "",
      companyId: appRole === "manager" && companyId ? String(companyId) : "",
    });
    setDialogOpen(true);
  }

  function openEdit(p: Project) {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      repoUrl: p.repoUrl,
      companyId: String(p.companyId),
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.repoUrl.trim()) {
      toast.error("Name and repo URL are required");
      return;
    }
    if (!isGithubUrl(form.repoUrl)) {
      toast.error("Repo URL must be a valid github.com link");
      return;
    }
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          name: form.name.trim(),
          description: form.description.trim() || null,
          repoUrl: form.repoUrl.trim(),
        });
        toast.success("Project updated");
      } else {
        const cidRaw = appRole === "manager" ? companyId! : Number(form.companyId);
        if (!cidRaw) {
          toast.error("Company is required");
          return;
        }
        const created = await create.mutateAsync({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          repoUrl: form.repoUrl.trim(),
          companyId: cidRaw,
        });
        toast.success("Project created");
        void sync
          .mutateAsync(String(created.id))
          .then((r) => toast.success(`Synced ${r.synced} file(s)`))
          .catch((e: Error) => toast.error(e.message ?? "Sync failed"));
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
      toast.success("Project deleted");
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
          <h1 className="text-[15px] font-semibold tracking-tight text-foreground">Projects</h1>
          <p className="mt-0.5 text-[13px] text-text-secondary">
            {data ? `${data.length} project${data.length === 1 ? "" : "s"}` : "Repositories and review workspaces"}
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="size-3.5" />
          New project
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-tertiary" />
          <Input
            placeholder="Search projects…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 h-8 text-[13px]"
          />
        </div>
        {appRole === "admin" && companies?.length ? (
          <Select
            value={companyFilter || "__all"}
            onValueChange={(v) => setCompanyFilter(v === "__all" ? "" : v)}
          >
            <SelectTrigger className="h-8 w-full text-[13px] sm:w-[180px]">
              <SelectValue placeholder="All companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All companies</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {isPending ? (
        <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-border px-5 py-3.5 last:border-0"
            >
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24 ml-auto" />
              <Skeleton className="size-7 rounded-md" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={q ? "No matches" : "No projects yet"}
          description={
            q
              ? "Try a different search term."
              : "Create a project linked to a GitHub repository."
          }
        >
          {!q ? (
            <Button onClick={openCreate} size="sm">
              <Plus className="size-3.5" />
              New project
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 border-b border-border px-5 py-2.5 text-[12px] font-medium text-text-tertiary">
            <span>Name</span>
            <span className="hidden w-32 sm:block">Company</span>
            <span className="hidden w-14 text-right sm:block">Files</span>
            <span className="hidden w-20 text-right sm:block">Comments</span>
            <span className="w-8" />
          </div>
          {filtered.map((p, i) => (
            <ProjectRow
              key={p.id}
              project={p}
              isLast={i === filtered.length - 1}
              onEdit={() => openEdit(p)}
              onMembers={() => setMembersProjectId(p.id)}
              onDelete={appRole === "admin" ? () => setDeleteTarget(p) : undefined}
            />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit project" : "New project"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update project name, description, or repo URL."
                : "Connect a GitHub repository to start reviewing HTML."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field>
              <FieldLabel htmlFor="proj-name">Name</FieldLabel>
              <Input
                id="proj-name"
                placeholder="My Project"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="proj-desc">
                Description <span className="text-text-tertiary font-normal">(optional)</span>
              </FieldLabel>
              <Textarea
                id="proj-desc"
                placeholder="Short description…"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="resize-none"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="proj-repo">GitHub repo URL</FieldLabel>
              <Input
                id="proj-repo"
                placeholder="https://github.com/org/repo"
                value={form.repoUrl}
                onChange={(e) => setForm((f) => ({ ...f, repoUrl: e.target.value }))}
              />
            </Field>
            {!editing && appRole === "admin" ? (
              <Field>
                <FieldLabel>Company</FieldLabel>
                <Select
                  value={form.companyId || "__none"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, companyId: v === "__none" ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
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
              {editing ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProjectMembersSheet
        projectId={membersProjectId}
        open={!!membersProjectId}
        onOpenChange={(o) => !o && setMembersProjectId(null)}
      />


      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the project and all related data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProjectRow({
  project: p,
  isLast,
  onEdit,
  onMembers,
  onDelete,
}: {
  project: Project;
  isLast: boolean;
  onEdit: () => void;
  onMembers: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-5 py-3 transition-colors hover:bg-bg-hover",
        !isLast && "border-b border-border",
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-foreground">{p.name}</p>
        {p.company?.name ? (
          <p className="truncate text-[12px] text-text-tertiary">{p.company.name}</p>
        ) : null}
      </div>
      <span className="hidden w-32 truncate text-[13px] text-text-secondary sm:block">
        {p.company?.name ?? "—"}
      </span>
      <span className="hidden w-14 text-right text-[13px] tabular-nums text-text-secondary sm:block">
        {p._count?.files ?? "—"}
      </span>
      <span className="hidden w-20 text-right text-[13px] tabular-nums text-text-secondary sm:block">
        {p._count?.comments ?? "—"}
      </span>
      <div className="w-8 flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem asChild>
              <Link to="/projects/$id/viewer" params={{ id: String(p.id) }}>
                <ExternalLink className="size-4" />
                Open viewer
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMembers}>
              <Users className="size-4" />
              Members
            </DropdownMenuItem>
            {onDelete ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
