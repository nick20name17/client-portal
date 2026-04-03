import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, Tags as TagsIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { RoleGate } from "@/components/shared/RoleGate";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
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
import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from "@/api/tags/query";
import type { Tag } from "@/types";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tags/")({
  component: TagsPage,
});

const PRESETS = ["#6366F1", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#EC4899", "#007AFF", "#FF9500"];

function TagsPage() {
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

  const isSaving = create.isPending || update.isPending;

  return (
    <div className="flex flex-1 flex-col gap-5 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight text-foreground">Tags</h1>
          <p className="mt-0.5 text-[13px] text-text-secondary">
            {data ? `${data.length} label${data.length === 1 ? "" : "s"}` : "Labels for categorizing feedback"}
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="size-3.5" />
          New tag
        </Button>
      </div>

      {isPending ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      ) : !data?.length ? (
        <EmptyState
          icon={TagsIcon}
          title="No tags yet"
          description="Create tags to categorize and filter feedback comments."
        >
          <Button onClick={openCreate} size="sm">
            <Plus className="size-3.5" />
            Create first tag
          </Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {data.map((t) => (
            <div
              key={t.id}
              className="group relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 ring-1 ring-foreground/10 transition-colors hover:bg-bg-hover"
            >
              <div
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: t.color }}
              />
              <span
                className="flex-1 truncate text-[13px] font-medium"
                style={{ color: t.color }}
              >
                {t.name}
              </span>
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => openEdit(t)}
                  className="inline-flex size-6 items-center justify-center rounded-md text-text-tertiary hover:bg-bg-active hover:text-foreground"
                  aria-label="Edit tag"
                >
                  <Pencil className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(t)}
                  className="inline-flex size-6 items-center justify-center rounded-md text-text-tertiary hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete tag"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 ring-1 ring-dashed ring-foreground/20 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-foreground"
          >
            <Plus className="size-3.5" />
            <span className="text-[13px]">Add tag</span>
          </button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit tag" : "New tag"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the tag name or color." : "Create a label to categorize comments."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field>
              <FieldLabel htmlFor="tag-name">Name</FieldLabel>
              <Input
                id="tag-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. bug, design, copy"
                onKeyDown={(e) => e.key === "Enter" && void save()}
              />
            </Field>
            <Field>
              <FieldLabel>Color</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      "size-6 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      color === c ? "border-foreground scale-110" : "border-transparent",
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-md bg-bg-secondary px-3 py-2">
                <div className="size-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[13px] font-medium" style={{ color }}>
                  {name || "Preview"}
                </span>
              </div>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void save()}
              isPending={isSaving}
              disabled={isSaving || !name.trim()}
            >
              {editing ? "Save changes" : "Create tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Comments may still reference this tag historically. This cannot be undone.
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
