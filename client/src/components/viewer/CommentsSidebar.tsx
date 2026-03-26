"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Search, X } from "lucide-react";

import { CommentForm } from "@/components/viewer/CommentForm";
import { CommentItem } from "@/components/viewer/CommentItem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Anchor, Comment, Tag } from "@/types";

function anchorKey(anchor: Anchor | null | undefined): string {
  if (!anchor) return "";
  if (anchor.dataComment) return `dc:${anchor.dataComment}`;
  if (anchor.selector) return `sel:${anchor.selector}`;
  return "";
}

export function CommentsSidebar({
  comments,
  loading,
  tagOptions,
  formOpen,
  anchor,
  replyParentId,
  selectedTagIds,
  onToggleTag,
  onSubmit,
  onCancelForm,
  onReply,
  onAddComment,
  onResolve,
  onHover,
  activeThreadId,
  focusedAnchorKey,
  onClearFocus,
  onClose,
  anchorResolvedMap,
}: {
  comments: Comment[] | undefined;
  loading: boolean;
  tagOptions: Tag[];
  formOpen: boolean;
  anchor: Anchor | null;
  replyParentId: string | null;
  selectedTagIds: string[];
  onToggleTag: (id: string) => void;
  onSubmit: (body: string) => void | Promise<void>;
  onCancelForm: () => void;
  onReply: (id: string) => void;
  onAddComment: () => void;
  onResolve: (id: string, resolved: boolean) => void | Promise<void>;
  onHover: (anchor: Anchor | null) => void;
  activeThreadId: string | null;
  focusedAnchorKey: string | null;
  onClearFocus: () => void;
  onClose?: () => void;
  anchorResolvedMap?: Record<string, boolean>;
}) {
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [q, setQ] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    if (!comments) return [];
    let rows = comments;
    if (focusedAnchorKey) rows = rows.filter((c) => anchorKey(c.anchor as Anchor) === focusedAnchorKey);
    if (filter === "open") rows = rows.filter((c) => !c.resolved);
    if (filter === "resolved") rows = rows.filter((c) => c.resolved);
    if (q.trim()) {
      const s = q.toLowerCase();
      rows = rows.filter((c) => c.body.toLowerCase().includes(s));
    }
    return rows;
  }, [comments, filter, q, focusedAnchorKey]);

  useEffect(() => {
    if (!activeThreadId) return;
    const container = listRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`[data-comment-root-id="${activeThreadId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeThreadId, filtered]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      <div className="flex items-center justify-between border-b border-sidebar-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/90">Comments</h2>
          {comments !== undefined ? (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {comments.length}
            </Badge>
          ) : null}
        </div>
        {onClose ? (
          <Button variant="ghost" size="icon" className="size-8 lg:hidden" onClick={onClose}>
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
      <div className="space-y-2 border-b border-sidebar-border p-2.5">
        {focusedAnchorKey ? (
          <div className="flex items-center justify-between rounded-md border border-blue-500/25 bg-blue-500/5 px-2.5 py-1.5 text-xs dark:border-blue-400/30 dark:bg-blue-500/10">
            <span className="font-medium text-blue-700 dark:text-blue-300">Showing comments for selected pin</span>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClearFocus}>
              Show all
            </Button>
          </div>
        ) : null}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "open" | "resolved")}>
          <TabsList className="h-8 w-full gap-0.5 rounded-md bg-muted/60 p-0.5">
            <TabsTrigger className="flex-1 rounded-sm py-1 text-xs font-medium" value="all">
              All
            </TabsTrigger>
            <TabsTrigger className="flex-1 rounded-sm py-1 text-xs font-medium" value="open">
              Open
            </TabsTrigger>
            <TabsTrigger className="flex-1 rounded-sm py-1 text-xs font-medium" value="resolved">
              Resolved
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 border-sidebar-border bg-background/80 pl-8 text-xs placeholder:text-muted-foreground/80"
            placeholder="Search comments…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        ) : (
          <div ref={listRef} className="space-y-3">
            {formOpen ? (
              <CommentForm
                anchor={anchor}
                parentId={replyParentId}
                tagOptions={tagOptions}
                selectedTagIds={selectedTagIds}
                onToggleTag={onToggleTag}
                onSubmit={onSubmit}
                onCancel={onCancelForm}
              />
            ) : null}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <MessageSquare className="size-8 text-muted-foreground/40" />
                <p className="text-sm font-medium">No comments</p>
                <p className="text-xs text-muted-foreground">
                  {filter === "all" ? "Click any element in the preview to add feedback." : "No comments match this filter."}
                </p>
              </div>
            ) : (
              filtered.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  depth={0}
                  onReply={onReply}
                  onResolve={onResolve}
                  onHover={onHover}
                  activeThreadId={activeThreadId}
                  anchorResolvedMap={anchorResolvedMap}
                />
              ))
            )}
          </div>
        )}
      </div>
      {!formOpen ? (
        <div className="border-t border-sidebar-border bg-sidebar p-2.5">
          <Button className="w-full" size="sm" onClick={onAddComment}>
            <MessageSquare className="size-4" />
            Add comment
          </Button>
        </div>
      ) : null}
    </div>
  );
}
