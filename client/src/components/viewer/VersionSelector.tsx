
import { useEffect, useState } from "react";
import { Check, History, Loader2, Search, Trash2 } from "lucide-react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useComments } from "@/api/comments/query";
import { useFileVersions, useDeleteFileVersion, useSyncFileVersions } from "@/api/file-versions/query";
import { cn } from "@/lib/utils";
import type { FileVersion } from "@/types";

interface VersionSelectorProps {
  projectId: string;
  fileId: string;
  selectedVersionId: number | null;
  onSelectVersion: (versionId: number | null) => void;
  canManage: boolean;
  forceOpen?: boolean;
  onForceOpenHandled?: () => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function versionNumberFor(v: FileVersion, all: FileVersion[]): number {
  const idx = all.findIndex((x) => x.id === v.id);
  // newest (idx 0) = highest number; oldest = 1
  return idx >= 0 ? all.length - idx : all.length;
}

export function VersionSelector({
  projectId,
  fileId,
  selectedVersionId,
  onSelectVersion,
  canManage,
  forceOpen,
  onForceOpenHandled,
}: VersionSelectorProps) {
  const { data: versions, isPending } = useFileVersions(projectId, fileId);
  const syncVersions = useSyncFileVersions(projectId, fileId);
  const deleteVersion = useDeleteFileVersion(projectId, fileId);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Render-time state derivation instead of useEffect
  const [prevForceOpen, setPrevForceOpen] = useState(false);
  if (forceOpen && !prevForceOpen) {
    setPrevForceOpen(true);
    setOpen(true);
    onForceOpenHandled?.();
  }
  if (!forceOpen && prevForceOpen) {
    setPrevForceOpen(false);
  }

  const { data: allComments } = useComments(projectId, fileId);
  const commentCountByVersion = (allComments ?? []).reduce<Record<number, number>>((acc, c) => {
    if (c.versionId) acc[c.versionId] = (acc[c.versionId] ?? 0) + 1;
    return acc;
  }, {});

  const selected = versions?.find((v) => v.id === selectedVersionId);

  useEffect(() => {
    syncVersions.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  async function handleDelete(versionId: number, e: React.MouseEvent) {
    e.stopPropagation();
    const remaining = versions?.filter((v) => v.id !== versionId) ?? [];
    const fallbackId = remaining[remaining.length - 1]?.id ?? null;
    const needsFallback = selectedVersionId === versionId;
    setDeleting(versionId);
    await deleteVersion.mutateAsync(versionId)
      .then(() => {
        toast.success("Version deleted");
        if (needsFallback) onSelectVersion(fallbackId);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to delete version";
        toast.error(msg);
      })
      .finally(() => setDeleting(null));
  }

  if (isPending) {
    return (
      <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs" disabled>
        <Loader2 className="size-3 animate-spin" />
        <span>Loading…</span>
      </Button>
    );
  }

  const sortedVersions = versions ?? [];
  const q = search.toLowerCase();
  const filteredVersions = sortedVersions.filter((v) => {
    if (!q) return true;
    const versionNum = versionNumberFor(v, sortedVersions);
    return (
      `version ${versionNum}`.includes(q) ||
      v.commitSha.toLowerCase().includes(q) ||
      v.commitMessage?.toLowerCase().includes(q) ||
      v.label?.toLowerCase().includes(q) ||
      v.commitAuthor?.toLowerCase().includes(q)
    );
  });

  const triggerVersion = selected ?? sortedVersions[0];
  const triggerLabel = triggerVersion
    ? `Version ${versionNumberFor(triggerVersion, sortedVersions)}`
    : "No versions";

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs">
          <History className="size-3 shrink-0" />
          <span className="max-w-24 truncate">{triggerLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="flex items-center border-b border-border px-2">
          <Search className="mr-1.5 size-3.5 shrink-0 opacity-40" />
          <input
            placeholder="Search versions…"
            className="flex h-8 w-full bg-transparent py-2 text-xs outline-none placeholder:text-muted-foreground"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1 flex flex-col gap-1">
          {filteredVersions.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No versions found.</div>
          ) : (
            filteredVersions.map((v) => (
              <div
                key={v.id}
                role="button"
                tabIndex={0}
                onClick={() => { onSelectVersion(v.id); setOpen(false); setSearch(""); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectVersion(v.id); setOpen(false); setSearch(""); } }}
                className={cn(
                  "group flex w-full cursor-pointer items-start justify-between gap-2 rounded-sm px-2 py-2 text-left hover:bg-muted",
                  v.id === selectedVersionId && "bg-muted",
                )}
              >
                <div className="flex min-w-0 flex-1 items-start gap-1.5">
                  <Check className={cn("mt-0.5 size-3 shrink-0", v.id === selectedVersionId ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">
                        Version {versionNumberFor(v, sortedVersions)}
                      </span>
                      {v.label && (
                        <span className="truncate text-xs text-muted-foreground">
                          — {v.label}
                        </span>
                      )}
                      <div className="ml-auto flex shrink-0 items-center gap-1.5">
                        {commentCountByVersion[v.id] ? (
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            {commentCountByVersion[v.id]}
                          </span>
                        ) : null}
                        {v.id === selectedVersionId && (
                          <span className="text-[10px] text-primary">current</span>
                        )}
                      </div>
                    </div>
                    {v.commitMessage && (
                      <div className="mt-0.5 line-clamp-3 text-[11px] text-muted-foreground">
                        {v.commitMessage}
                      </div>
                    )}
                    {(v.commitAuthor || v.commitDate) && (
                      <div className="mt-0.5 truncate text-[10px] text-muted-foreground/70">
                        {[v.commitAuthor, formatDate(v.commitDate)].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                </div>
                {canManage && v.id !== selectedVersionId && (
                  <button
                    className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                    onClick={(e) => void handleDelete(v.id, e)}
                    disabled={deleting === v.id}
                    aria-label="Delete version"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
