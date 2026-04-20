import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useReducer, useState } from "react";
import { useDebounce } from "use-debounce";
import { format } from "date-fns";
import { Building2, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  useCompanies,
  useCreateCompany,
  useDeleteCompany,
  useUpdateCompany,
} from "@/api/companies/query";
import type { Company } from "@/types";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";

export const Route = createFileRoute("/_authenticated/companies/")({
  component: CompaniesPage,
});

function CompaniesPage() {
  return (
    <RoleGate allow={["admin"]}>
      <CompaniesContent />
    </RoleGate>
  );
}

type CompanyDialogState = {
  dialogOpen: boolean;
  editing: Company | null;
  name: string;
  deleteTarget: Company | null;
};

type CompanyDialogAction =
  | { type: "OPEN_CREATE" }
  | { type: "OPEN_EDIT"; payload: Company }
  | { type: "CLOSE_DIALOG" }
  | { type: "SET_NAME"; payload: string }
  | { type: "SET_DELETE_TARGET"; payload: Company | null };

const initialCompanyDialog: CompanyDialogState = {
  dialogOpen: false,
  editing: null,
  name: "",
  deleteTarget: null,
};

function companyDialogReducer(state: CompanyDialogState, action: CompanyDialogAction): CompanyDialogState {
  switch (action.type) {
    case "OPEN_CREATE":
      return { ...state, dialogOpen: true, editing: null, name: "" };
    case "OPEN_EDIT":
      return { ...state, dialogOpen: true, editing: action.payload, name: action.payload.name };
    case "CLOSE_DIALOG":
      return { ...state, dialogOpen: false };
    case "SET_NAME":
      return { ...state, name: action.payload };
    case "SET_DELETE_TARGET":
      return { ...state, deleteTarget: action.payload };
    default:
      return state;
  }
}

function CompaniesContent() {
  const { data, isPending } = useCompanies();
  const create = useCreateCompany();
  const update = useUpdateCompany();
  const remove = useDeleteCompany();

  const [q, setQ] = useState("");
  const [debouncedQ] = useDebounce(q, 300);
  const [state, dispatch] = useReducer(companyDialogReducer, initialCompanyDialog);
  const { dialogOpen, editing, name, deleteTarget } = state;

  const pendingAction = useUIStore((s) => s.pendingAction);
  const consumePendingAction = useUIStore((s) => s.consumePendingAction);
  useEffect(() => {
    if (pendingAction?.type === "create-company") {
      consumePendingAction();
      dispatch({ type: "OPEN_CREATE" });
    }
  }, [pendingAction, consumePendingAction]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!debouncedQ.trim()) return data;
    const s = debouncedQ.toLowerCase();
    return data.filter((c) => c.name.toLowerCase().includes(s));
  }, [data, debouncedQ]);

  function openCreate() {
    dispatch({ type: "OPEN_CREATE" });
  }

  function openEdit(c: Company) {
    dispatch({ type: "OPEN_EDIT", payload: c });
  }

  async function save() {
    const n = name.trim();
    if (!n) return;
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, name: n });
        toast.success("Company updated");
      } else {
        await create.mutateAsync({ name: n });
        toast.success("Company created");
      }
      dispatch({ type: "CLOSE_DIALOG" });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Something went wrong");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success("Company deleted");
      dispatch({ type: "SET_DELETE_TARGET", payload: null });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Delete failed");
    }
  }

  const isSaving = create.isPending || update.isPending;

  return (
    <div className="flex flex-1 flex-col gap-5 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold tracking-tight text-foreground">Companies</h1>
          <p className="mt-0.5 text-[13px] text-text-secondary">
            {data ? `${data.length} organization${data.length === 1 ? "" : "s"}` : "Manage client organizations"}
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="w-full sm:w-auto">
          <Plus className="size-3.5" />
          New company
        </Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-tertiary" />
        <Input
          placeholder="Search companies…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-8 h-8 text-[13px]"
        />
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
          icon={Building2}
          title={q ? "No matches" : "No companies yet"}
          description={
            q
              ? "Try a different search term."
              : "Create your first company to attach projects and users."
          }
        >
          {!q ? (
            <Button onClick={openCreate} size="sm">
              <Plus className="size-3.5" />
              Create company
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border px-5 py-2.5 text-[12px] font-medium text-text-tertiary">
            <span>Name</span>
            <span className="w-28 text-right hidden sm:block">Created</span>
            <span className="w-8" />
          </div>
          {filtered.map((c, i) => (
            <div
              key={c.id}
              className={cn(
                "grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3 transition-colors hover:bg-bg-hover",
                i < filtered.length - 1 && "border-b border-border",
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Building2 className="size-3.5" />
                </div>
                <span className="truncate text-[13px] font-medium text-foreground">{c.name}</span>
              </div>
              <span className="hidden w-28 text-right text-[13px] text-text-secondary sm:block">
                {c.createdAt ? format(new Date(c.createdAt), "MMM d, yyyy") : "—"}
              </span>
              <div className="w-8 flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm">
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={() => openEdit(c)}>
                      <Pencil className="size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => dispatch({ type: "SET_DELETE_TARGET", payload: c })}>
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

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && dispatch({ type: "CLOSE_DIALOG" })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit company" : "New company"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the company name." : "Add a new client organization."}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="company-name">Name</FieldLabel>
            <Input
              id="company-name"
              value={name}
              onChange={(e) => dispatch({ type: "SET_NAME", payload: e.target.value })}
              placeholder="Acme Corp"
              onKeyDown={(e) => e.key === "Enter" && void save()}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => dispatch({ type: "CLOSE_DIALOG" })}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void save()}
              isPending={isSaving}
              disabled={isSaving || !name.trim()}
            >
              {editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && dispatch({ type: "SET_DELETE_TARGET", payload: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This may fail if projects or users still reference this company. This action cannot
              be undone.
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
