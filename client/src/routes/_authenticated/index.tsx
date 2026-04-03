import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  FolderKanban,
  FolderOpen,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  Users,
  Users2,
} from "lucide-react";
import { toast } from "sonner";

import { ProjectPreviewCard } from "@/components/dashboard/ProjectPreviewCard";
import { ProjectMembersSheet } from "@/components/projects/ProjectMembersSheet";
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
import { useStats } from "@/api/stats/query";
import { ApiError } from "@/lib/api";
import type { Project } from "@/types";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardPage,
});

function isGithubUrl(s: string) {
  try {
    const u = new URL(s.trim());
    return u.hostname === "github.com" || u.hostname.endsWith(".github.com");
  } catch {
    return false;
  }
}

function DashboardPage() {
  const { data: session } = authClient.useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const companyId =
    (session?.user as { companyId?: number | null } | undefined)?.companyId ?? null;
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const canManage = isAdmin || isManager;

  const { data: projects, isPending } = useProjects();
  const { data: stats, isPending: statsLoading } = useStats({ enabled: isAdmin });
  const { data: companies } = useCompanies({ enabled: isAdmin });

  const create = useCreateProject();
  const update = useUpdateProject();
  const remove = useDeleteProject();
  const sync = useSyncProjectFiles();

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

  const resolvedPct = useMemo(() => {
    if (!stats || stats.totalComments === 0) return 0;
    return Math.round((stats.resolvedComments / stats.totalComments) * 100);
  }, [stats]);

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      description: "",
      repoUrl: "",
      companyId: isManager && companyId ? String(companyId) : "",
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
        const cidRaw = isManager ? companyId! : Number(form.companyId);
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
          <h1 className="text-[15px] font-semibold tracking-tight text-foreground">
            {isAdmin ? "All projects" : "My projects"}
          </h1>
          <p className="mt-0.5 text-[13px] text-text-secondary">
            {projects ? `${projects.length} project${projects.length === 1 ? "" : "s"}` : "Loading…"}
          </p>
        </div>
        {canManage ? (
          <Button onClick={openCreate} variant="outline" size="sm">
            <Plus className="size-3.5" />
            New project
          </Button>
        ) : null}
      </div>

      {isAdmin ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {statsLoading || !stats ? (
            <>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-[60px] rounded-lg" />
              ))}
            </>
          ) : (
            <>
              {[
                { icon: MessageCircle, label: "Total", value: stats.totalComments, iconColor: "text-blue-500", iconBg: "bg-blue-500/10" },
                { icon: TrendingUp, label: "Open", value: stats.openComments, iconColor: "text-orange-500", iconBg: "bg-orange-500/10" },
                { icon: CheckCircle2, label: "Resolved", value: `${resolvedPct}%`, iconColor: "text-emerald-500", iconBg: "bg-emerald-500/10" },
                { icon: FolderKanban, label: "Projects", value: stats.projects, iconColor: "text-violet-500", iconBg: "bg-violet-500/10" },
                { icon: Users2, label: "Users", value: stats.users, iconColor: "text-indigo-500", iconBg: "bg-indigo-500/10" },
              ].map(({ icon: Icon, label, value, iconColor, iconBg }) => (
                <div
                  key={label}
                  className="group rounded-lg bg-card px-4 py-3 ring-1 ring-foreground/10 transition-all duration-150 hover:-translate-y-px hover:shadow-md hover:shadow-black/4 hover:ring-foreground/15"
                >
                  <div className="flex items-center gap-2 text-[12px] text-text-secondary">
                    <div className={`flex size-5 items-center justify-center rounded-md ${iconBg}`}>
                      <Icon className={`size-3 ${iconColor}`} />
                    </div>
                    {label}
                  </div>
                  <p className="mt-1.5 text-xl font-bold tracking-tight tabular-nums">{value}</p>
                </div>
              ))}
            </>
          )}
        </div>
      ) : null}

      {isPending ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex flex-col overflow-hidden rounded-xl ring-1 ring-foreground/10">
              <Skeleton className="h-40 w-full rounded-none" />
              <div className="px-4 py-3 flex flex-col gap-2">
                <Skeleton className="h-3.5 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : !projects?.length ? (
        <EmptyState
          icon={FolderOpen}
          title="No projects yet"
          description={
            canManage
              ? "Create your first project and sync HTML from GitHub."
              : "You have not been added to any project yet."
          }
        >
          {canManage ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Create your first project
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {projects.map((p) => (
            <div key={p.id} className="relative group/card">
              <ProjectPreviewCard project={p} />
              {canManage ? (
                <div className="absolute right-2 top-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon-sm"
                        className="size-7 rounded-md bg-background/90 backdrop-blur-sm shadow-sm"
                        onClick={(e) => e.preventDefault()}
                      >
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => openEdit(p)}>
                        <Pencil className="size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setMembersProjectId(p.id)}>
                        <Users className="size-4" />
                        Members
                      </DropdownMenuItem>
                      {isAdmin ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(p)}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
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
            {!editing && isAdmin ? (
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
