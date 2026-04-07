import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useReducer, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
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
  useArchiveProject,
  useArchivedProjects,
  useCreateProject,
  useDeleteProject,
  useProjects,
  useSyncProjectFiles,
  useUnarchiveProject,
  useUpdateProject,
} from "@/api/projects/query";
import type { Project } from "@/types";
import { apiErrorMsg } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: ProjectsPage,
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

function ProjectsPage() {
  return (
    <RoleGate allow={["admin", "manager"]}>
      <ProjectsContent />
    </RoleGate>
  );
}

// --- Reducer ---

type ProjFormState = { name: string; description: string; repoUrl: string; companyId: string };

type ProjDialogState = {
  dialogOpen: boolean;
  editing: Project | null;
  form: ProjFormState;
  deleteTarget: Project | null;
  archiveTarget: Project | null;
  membersProjectId: number | null;
};

const initialProjDialogState: ProjDialogState = {
  dialogOpen: false,
  editing: null,
  form: { name: "", description: "", repoUrl: "", companyId: "" },
  deleteTarget: null,
  archiveTarget: null,
  membersProjectId: null,
};

type ProjDialogAction =
  | { type: "OPEN_CREATE"; payload: { companyId: string } }
  | { type: "OPEN_EDIT"; payload: Project }
  | { type: "CLOSE_DIALOG" }
  | { type: "SET_FORM"; payload: Partial<ProjFormState> }
  | { type: "SET_DELETE_TARGET"; payload: Project | null }
  | { type: "SET_ARCHIVE_TARGET"; payload: Project | null }
  | { type: "SET_MEMBERS_PROJECT"; payload: number | null };

function projDialogReducer(state: ProjDialogState, action: ProjDialogAction): ProjDialogState {
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
  form: ProjFormState;
  companies: { id: number; name: string }[] | undefined;
  isAdmin: boolean;
  isSaving: boolean;
  onFormChange: (patch: Partial<ProjFormState>) => void;
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

function ProjectsContent() {
  const { data: sessionData } = authClient.useSession();
  const appRole = (sessionData?.user as { role?: string } | undefined)?.role;
  const companyId =
    (sessionData?.user as { companyId?: number | null } | undefined)?.companyId ?? null;

  const { data: companies } = useCompanies({ enabled: appRole === "admin" });
  const { data, isPending } = useProjects();
  const { data: archivedProjects } = useArchivedProjects({ enabled: appRole === "admin" });
  const create = useCreateProject();
  const update = useUpdateProject();
  const archive = useArchiveProject();
  const unarchive = useUnarchiveProject();
  const remove = useDeleteProject();
  const sync = useSyncProjectFiles();

  const [q, setQ] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("");
  const [showArchived, setShowArchived] = useState(false);
  const [state, dispatch] = useReducer(projDialogReducer, initialProjDialogState);

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
    dispatch({ type: "OPEN_CREATE", payload: { companyId: appRole === "manager" && companyId ? String(companyId) : "" } });
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
    const cidRaw = appRole === "manager" ? companyId! : Number(state.form.companyId);
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
              onEdit={() => dispatch({ type: "OPEN_EDIT", payload: p })}
              onMembers={() => dispatch({ type: "SET_MEMBERS_PROJECT", payload: p.id })}
              onArchive={appRole === "admin" ? () => dispatch({ type: "SET_ARCHIVE_TARGET", payload: p }) : undefined}
              onDelete={appRole === "admin" ? () => dispatch({ type: "SET_DELETE_TARGET", payload: p }) : undefined}
            />
          ))}
        </div>
      )}

      {appRole === "admin" && archivedProjects && archivedProjects.length > 0 ? (
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
            <div className="mt-3 overflow-hidden rounded-lg ring-1 ring-foreground/10">
              {archivedProjects.map((p, i) => (
                <div
                  key={p.id}
                  className={cn(
                    "grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-5 py-3 opacity-60 transition-colors hover:opacity-100 hover:bg-bg-hover",
                    i < archivedProjects.length - 1 && "border-b border-border",
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
        isAdmin={appRole === "admin"}
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

function ProjectRow({
  project: p,
  isLast,
  onEdit,
  onMembers,
  onArchive,
  onDelete,
}: {
  project: Project;
  isLast: boolean;
  onEdit: () => void;
  onMembers: () => void;
  onArchive?: () => void;
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
            {onArchive || onDelete ? (
              <>
                <DropdownMenuSeparator />
                {onArchive ? (
                  <DropdownMenuItem onClick={onArchive}>
                    <Archive className="size-4" />
                    Archive
                  </DropdownMenuItem>
                ) : null}
                {onDelete ? (
                  <DropdownMenuItem variant="destructive" onClick={onDelete}>
                    <Trash2 className="size-4" />
                    Delete
                  </DropdownMenuItem>
                ) : null}
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
