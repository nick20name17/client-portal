"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Search, X } from "lucide-react";

import { CommentForm } from "@/components/viewer/CommentForm";
import { CommentItem } from "@/components/viewer/CommentItem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Anchor, Comment, Tag } from "@/types";

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
  onClose,
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
  onClose?: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [q, setQ] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    if (!comments) return [];
    let rows = comments;
    if (filter === "open") rows = rows.filter((c) => !c.resolved);
    if (filter === "resolved") rows = rows.filter((c) => c.resolved);
    if (q.trim()) {
      const s = q.toLowerCase();
      rows = rows.filter((c) => c.body.toLowerCase().includes(s));
    }
    return rows;
  }, [comments, filter, q]);

  useEffect(() => {
    if (!activeThreadId) return;
    const container = listRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`[data-comment-root-id="${activeThreadId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeThreadId, filtered]);

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold">Comments</h2>
        {onClose ? (
          <Button variant="ghost" size="icon" className="size-8 lg:hidden" onClick={onClose}>
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
      <div className="space-y-2 border-b border-border p-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "open" | "resolved")}>
          <TabsList className="w-full">
            <TabsTrigger className="flex-1" value="all">
              All
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="open">
              Open
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="resolved">
              Resolved
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search comments…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
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
              <p className="text-center text-sm text-muted-foreground">No comments yet.</p>
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
                />
              ))
            )}
          </div>
        )}
      </div>
      {!formOpen ? (
        <div className="border-t border-border p-3">
          <Button className="w-full" onClick={onAddComment}>
            <MessageSquare className="size-4" />
            Add comment
          </Button>
        </div>
      ) : null}
    </div>
  );
}
