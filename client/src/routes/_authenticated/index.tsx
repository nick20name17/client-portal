import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useReducer, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  ChevronDown,
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
  useArchiveProject,
  useArchivedProjects,
  useCreateProject,
  useDeleteProject,
  useProjects,
  useSyncProjectFiles,
  useUnarchiveProject,
  useUpdateProject,
} from "@/api/projects/query";
import { useStats } from "@/api/stats/query";
import { apiErrorMsg } from "@/lib/api";
import type { Project } from "@/types";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardPage,
});

function syncProject(sync: ReturnType<typeof useSyncProjectFiles>, id: number) {
  sync
    .mutateAsync(String(id))
    .then((r) => toast.success(`Synced ${r.synced} file(s)`))
    .catch((e: Error) => {
      const msg = e.message || "Sync failed";
      toast.error(msg);
    });
}

function isGithubUrl(s: string) {
  try {
    const u = new URL(s.trim());
    return u.hostname === "github.com" || u.hostname.endsWith(".github.com");
  } catch {
    return false;
  }
}

// --- Reducer ---

type FormState = { name: string; description: string; repoUrl: string; companyId: string };

type DialogState = {
  dialogOpen: boolean;
  editing: Project | null;
  form: FormState;
  deleteTarget: Project | null;
  archiveTarget: Project | null;
  membersProjectId: number | null;
};

const initialDialogState: DialogState = {
  dialogOpen: false,
  editing: null,
  form: { name: "", description: "", repoUrl: "", companyId: "" },
  deleteTarget: null,
  archiveTarget: null,
  membersProjectId: null,
};

type DialogAction =
  | { type: "OPEN_CREATE"; payload: { companyId: string } }
  | { type: "OPEN_EDIT"; payload: Project }
  | { type: "CLOSE_DIALOG" }
  | { type: "SET_FORM"; payload: Partial<FormState> }
  | { type: "SET_DELETE_TARGET"; payload: Project | null }
  | { type: "SET_ARCHIVE_TARGET"; payload: Project | null }
  | { type: "SET_MEMBERS_PROJECT"; payload: number | null };

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case "OPEN_CREATE":
      return {
        ...state,
        dialogOpen: true,
        editing: null,
        form: { name: "", description: "", repoUrl: "", companyId: action.payload.companyId },
      };
    case "OPEN_EDIT":
      return {
        ...state,
        dialogOpen: true,
        editing: action.payload,
        form: {
          name: action.payload.name,
          description: action.payload.description ?? "",
          repoUrl: action.payload.repoUrl,
          companyId: String(action.payload.companyId),
        },
      };
    case "CLOSE_DIALOG":
      return { ...state, dialogOpen: false };
    case "SET_FORM":
      return { ...state, form: { ...state.form, ...action.payload } };
    case "SET_DELETE_TARGET":
      return { ...state, deleteTarget: action.payload };
    case "SET_ARCHIVE_TARGET":
      return { ...state, archiveTarget: action.payload };
    case "SET_MEMBERS_PROJECT":
      return { ...state, membersProjectId: action.payload };
    default:
      return state;
  }
}

// --- Sub-components ---

function StatsGrid({ stats, statsLoading, resolvedPct }: {
  stats: { totalComments: number; openComments: number; resolvedComments: number; projects: number; users: number } | undefined;
  statsLoading: boolean;
  resolvedPct: number;
}) {
  if (statsLoading || !stats) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {["stat-1", "stat-2", "stat-3", "stat-4", "stat-5"].map((id) => (
          <Skeleton key={id} className="h-[60px] rounded-lg" />
        ))}
      </div>
    );
  }
  const items = [
    { icon: MessageCircle, label: "Total", value: stats.totalComments, iconColor: "text-blue-500", iconBg: "bg-blue-500/10" },
    { icon: TrendingUp, label: "Open", value: stats.openComments, iconColor: "text-orange-500", iconBg: "bg-orange-500/10" },
    { icon: CheckCircle2, label: "Resolved", value: `${resolvedPct}%`, iconColor: "text-emerald-500", iconBg: "bg-emerald-500/10" },
    { icon: FolderKanban, label: "Projects", value: stats.projects, iconColor: "text-violet-500", iconBg: "bg-violet-500/10" },
    { icon: Users2, label: "Users", value: stats.users, iconColor: "text-indigo-500", iconBg: "bg-indigo-500/10" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {items.map(({ icon: Icon, label, value, iconColor, iconBg }) => (
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
    </div>
  );
}

function ProjectFormDialog({
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
  editing: Project | null;
  form: FormState;
  companies: { id: number; name: string }[] | undefined;
  isAdmin: boolean;
  isSaving: boolean;
  onFormChange: (patch: Partial<FormState>) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
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
              onChange={(e) => onFormChange({ name: e.target.value })}
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
              onChange={(e) => onFormChange({ description: e.target.value })}
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
              onChange={(e) => onFormChange({ repoUrl: e.target.value })}
            />
          </Field>
          {!editing && isAdmin ? (
            <Field>
              <FieldLabel>Company</FieldLabel>
              <Select
                value={form.companyId || "__none"}
                onValueChange={(v) => onFormChange({ companyId: v === "__none" ? "" : v })}
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
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} isPending={isSaving} disabled={isSaving}>
            {editing ? "Save changes" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveProjectDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: Project | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive &ldquo;{target?.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            The project will be hidden from all users. You can restore it later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Archive project
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteProjectDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: Project | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{target?.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the project and all related data. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Delete project
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// --- Main component ---

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

  const { data: archivedProjects } = useArchivedProjects({ enabled: isAdmin });

  const create = useCreateProject();
  const update = useUpdateProject();
  const archive = useArchiveProject();
  const unarchive = useUnarchiveProject();
  const remove = useDeleteProject();
  const sync = useSyncProjectFiles();

  const [state, dispatch] = useReducer(dialogReducer, initialDialogState);
  const [showArchived, setShowArchived] = useState(false);

  const resolvedPct = useMemo(() => {
    if (!stats || stats.totalComments === 0) return 0;
    return Math.round((stats.resolvedComments / stats.totalComments) * 100);
  }, [stats]);

  function openCreate() {
    dispatch({ type: "OPEN_CREATE", payload: { companyId: isManager && companyId ? String(companyId) : "" } });
  }

  function openEdit(p: Project) {
    dispatch({ type: "OPEN_EDIT", payload: p });
  }

  async function save() {
    if (!state.form.name.trim() || !state.form.repoUrl.trim()) {
      toast.error("Name and repo URL are required");
      return;
    }
    if (!isGithubUrl(state.form.repoUrl)) {
      toast.error("Repo URL must be a valid github.com link");
      return;
    }
    const trimmedName = state.form.name.trim();
    const trimmedDesc = state.form.description.trim();
    const descOrNull = trimmedDesc || null;
    const descOrUndef = trimmedDesc || undefined;
    const trimmedRepo = state.form.repoUrl.trim();
    const cidRaw = isManager ? companyId! : Number(state.form.companyId);
    let createdId: number | null = null;
    try {
      if (state.editing) {
        await update.mutateAsync({
          id: state.editing.id,
          name: trimmedName,
          description: descOrNull,
          repoUrl: trimmedRepo,
        });
        toast.success("Project updated");
      } else {
        if (!cidRaw) {
          toast.error("Company is required");
          return;
        }
        const created = await create.mutateAsync({
          name: trimmedName,
          description: descOrUndef,
          repoUrl: trimmedRepo,
          companyId: cidRaw,
        });
        createdId = created.id;
        toast.success("Project created");
      }
      dispatch({ type: "CLOSE_DIALOG" });
    } catch (e) {
      toast.error(apiErrorMsg(e, "Request failed"));
    }
    if (createdId !== null) {
      void syncProject(sync, createdId);
    }
  }

  async function confirmArchive() {
    if (!state.archiveTarget) return;
    try {
      await archive.mutateAsync(state.archiveTarget.id);
      toast.success("Project archived");
      dispatch({ type: "SET_ARCHIVE_TARGET", payload: null });
    } catch (e) {
      toast.error(apiErrorMsg(e, "Archive failed"));
    }
  }

  async function handleUnarchive(id: number) {
    try {
      await unarchive.mutateAsync(id);
      toast.success("Project restored");
    } catch (e) {
      toast.error(apiErrorMsg(e, "Restore failed"));
    }
  }

  async function confirmDelete() {
    if (!state.deleteTarget) return;
    try {
      await remove.mutateAsync(state.deleteTarget.id);
      toast.success("Project deleted");
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

      {isAdmin ? <StatsGrid stats={stats} statsLoading={statsLoading} resolvedPct={resolvedPct} /> : null}

      {isPending ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {["proj-1", "proj-2", "proj-3", "proj-4"].map((id) => (
            <div key={id} className="flex flex-col overflow-hidden rounded-xl ring-1 ring-foreground/10">
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
                      <DropdownMenuItem onClick={() => dispatch({ type: "SET_MEMBERS_PROJECT", payload: p.id })}>
                        <Users className="size-4" />
                        Members
                      </DropdownMenuItem>
                      {isAdmin ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => dispatch({ type: "SET_ARCHIVE_TARGET", payload: p })}
                          >
                            <Archive className="size-4" />
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => dispatch({ type: "SET_DELETE_TARGET", payload: p })}
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

      {isAdmin && archivedProjects && archivedProjects.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="flex items-center gap-1.5 text-[13px] font-medium text-text-secondary hover:text-foreground transition-colors"
          >
            <ChevronDown className={`size-3.5 transition-transform ${showArchived ? "" : "-rotate-90"}`} />
            Archived ({archivedProjects.length})
          </button>
          {showArchived ? (
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {archivedProjects.map((p) => (
                <div key={p.id} className="relative group/card opacity-60 hover:opacity-100 transition-opacity">
                  <ProjectPreviewCard project={p} />
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
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => void handleUnarchive(p.id)}>
                          <ArchiveRestore className="size-4" />
                          Restore
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => dispatch({ type: "SET_DELETE_TARGET", payload: p })}
                        >
                          <Trash2 className="size-4" />
                          Delete permanently
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <ProjectFormDialog
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

      <ProjectMembersSheet
        projectId={state.membersProjectId}
        open={!!state.membersProjectId}
        onOpenChange={(o) => !o && dispatch({ type: "SET_MEMBERS_PROJECT", payload: null })}
      />

      <ArchiveProjectDialog
        target={state.archiveTarget}
        onClose={() => dispatch({ type: "SET_ARCHIVE_TARGET", payload: null })}
        onConfirm={() => void confirmArchive()}
      />

      <DeleteProjectDialog
        target={state.deleteTarget}
        onClose={() => dispatch({ type: "SET_DELETE_TARGET", payload: null })}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
