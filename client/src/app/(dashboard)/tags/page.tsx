"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Tags as TagsIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { RoleGate } from "@/components/shared/RoleGate";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from "@/hooks/use-tags";
import type { Tag } from "@/types";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const PRESETS = ["#6366F1", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#EC4899"];

export default function TagsPage() {
  return (
    <RoleGate allow={["admin"]}>
      <TagsContent />
    </RoleGate>
  );
}

function TagsContent() {
  const { data, isPending } = useTags();
  const create = useCreateTag();
  const update = useUpdateTag();
  const remove = useDeleteTag();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESETS[0]);
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);

  function openCreate() {
    setEditing(null);
    setName("");
    setColor(PRESETS[0]);
    setDialogOpen(true);
  }

  function openEdit(t: Tag) {
    setEditing(t);
    setName(t.name);
    setColor(t.color.startsWith("#") ? t.color : PRESETS[0]);
    setDialogOpen(true);
  }

  async function save() {
    const n = name.trim();
    if (!n) return;
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, name: n, color });
        toast.success("Tag updated");
      } else {
        await create.mutateAsync({ name: n, color });
        toast.success("Tag created");
      }
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success("Tag deleted");
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Delete failed");
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tags</h1>
          <p className="text-sm text-muted-foreground">Labels for comments.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          New tag
        </Button>
      </div>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All tags</CardTitle>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !data?.length ? (
            <EmptyState icon={TagsIcon} title="No tags yet" description="Create tags to categorize feedback.">
              <Button onClick={openCreate}>Create tag</Button>
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
                >
                  <Badge
                    className="border-0 px-3 py-1 text-sm font-normal"
                    style={{ backgroundColor: `${t.color}22`, color: t.color }}
                  >
                    {t.name}
                  </Badge>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(t)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      onClick={() => setDeleteTarget(t)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit tag" : "New tag"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="bug" />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      "size-8 rounded-full border-2 border-transparent ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      color === c && "ring-2 ring-primary",
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag?</AlertDialogTitle>
            <AlertDialogDescription>Comments may still reference this tag historically.</AlertDialogDescription>
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
