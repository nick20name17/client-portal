"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, FolderKanban, Loader2, MoreHorizontal, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { ProjectMembersSheet } from "@/components/projects/ProjectMembersSheet";
import { RoleGate } from "@/components/shared/RoleGate";
import { EmptyState } from "@/components/shared/EmptyState";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useCompanies } from "@/hooks/use-companies";
import { useCreateProject, useDeleteProject, useProjects, useSyncProjectFiles, useUpdateProject } from "@/hooks/use-projects";
import type { Project } from "@/types";
import { ApiError } from "@/lib/api";

function isGithubUrl(s: string) {
  try {
    const u = new URL(s.trim());
    return u.hostname === "github.com" || u.hostname.endsWith(".github.com");
  } catch {
    return false;
  }
}

export default function ProjectsPage() {
  return (
    <RoleGate allow={["admin", "manager"]}>
      <ProjectsContent />
    </RoleGate>
  );
}

function ProjectsContent() {
  const { data: sessionData } = authClient.useSession();
  const appRole = (sessionData?.user as { role?: string } | undefined)?.role;
  const companyId = (sessionData?.user as { companyId?: string | null } | undefined)?.companyId ?? null;

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
  const [membersProjectId, setMembersProjectId] = useState<string | null>(null);
  const [syncProjectId, setSyncProjectId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data;
    if (appRole === "manager" && companyId) {
      rows = rows.filter((p) => p.companyId === companyId);
    }
    if (companyFilter) {
      rows = rows.filter((p) => p.companyId === companyFilter);
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
      companyId: appRole === "manager" && companyId ? companyId : "",
    });
    setDialogOpen(true);
  }

  function openEdit(p: Project) {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      repoUrl: p.repoUrl,
      companyId: p.companyId,
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
        const cid = appRole === "manager" ? companyId! : form.companyId;
        if (!cid) {
          toast.error("Company is required");
          return;
        }
        const created = await create.mutateAsync({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          repoUrl: form.repoUrl.trim(),
          companyId: cid,
        });
        toast.success("Project created");
        setSyncProjectId(created.id);
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

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">Repositories and review workspaces.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          New project
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        {appRole === "admin" ? (
          <Select value={companyFilter || "__all"} onValueChange={(v) => setCompanyFilter(v === "__all" ? "" : v)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All companies</SelectItem>
              {companies?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All projects</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {isPending ? (
            <div className="space-y-2 px-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 pb-6">
              <EmptyState icon={FolderKanban} title="No projects" description="Create a project linked to a GitHub repo.">
                <Button onClick={openCreate}>
                  <FolderKanban className="size-4" />
                  New project
                </Button>
              </EmptyState>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-6 py-3 font-medium">Company</th>
                    <th className="px-6 py-3 font-medium">Files</th>
                    <th className="px-6 py-3 font-medium">Comments</th>
                    <th className="w-12 px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b border-border/80 last:border-0">
                      <td className="px-6 py-3 font-medium">{p.name}</td>
                      <td className="px-6 py-3 text-muted-foreground">{p.company?.name ?? "—"}</td>
                      <td className="px-6 py-3">{p._count?.files ?? "—"}</td>
                      <td className="px-6 py-3">{p._count?.comments ?? "—"}</td>
                      <td className="px-6 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/projects/${p.id}/viewer`}>
                                <ExternalLink className="size-4" />
                                Open viewer
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(p)}>
                              <Pencil className="size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setMembersProjectId(p.id)}>
                              <Users className="size-4" />
                              Members
                            </DropdownMenuItem>
                            {appRole === "admin" ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteTarget(p)}
                                >
                                  <Trash2 className="size-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit project" : "New project"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>GitHub repo URL</Label>
              <Input
                placeholder="https://github.com/org/repo"
                value={form.repoUrl}
                onChange={(e) => setForm((f) => ({ ...f, repoUrl: e.target.value }))}
              />
            </div>
            {!editing && appRole === "admin" ? (
              <div className="space-y-2">
                <Label>Company</Label>
                <Select
                  value={form.companyId || "__none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, companyId: v === "__none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {companies?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={create.isPending || update.isPending}>
              {(create.isPending || update.isPending) ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProjectMembersSheet
        projectId={membersProjectId}
        open={!!membersProjectId}
        onOpenChange={(o) => !o && setMembersProjectId(null)}
      />

      <AlertDialog open={!!syncProjectId} onOpenChange={(o) => !o && setSyncProjectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sync HTML files?</AlertDialogTitle>
            <AlertDialogDescription>
              Pull the latest HTML files from GitHub now? You can also sync later from the project menu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSyncProjectId(null)}>Later</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const id = syncProjectId;
              setSyncProjectId(null);
              if (id) {
                void sync.mutateAsync(id).then((r) => toast.success(`Synced ${r.synced} file(s)`)).catch((e: Error) => toast.error(e.message ?? "Sync failed"));
              }
            }}>
              Sync now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the project and related data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
