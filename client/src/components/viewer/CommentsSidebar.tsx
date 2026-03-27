"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, CheckCircle2, Filter, MessageSquarePlus, MoreHorizontal, Search, X } from "lucide-react";

import { TagBadge } from "@/components/comments/TagBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Anchor, Comment, Tag, User } from "@/types";

function anchorKey(anchor: Anchor | null | undefined): string {
  if (!anchor) return "";
  if (anchor.dataComment) return `dc:${anchor.dataComment}`;
  if (anchor.selector) return `sel:${anchor.selector}`;
  return "";
}

function commentAuthorLabel(comment: Comment, currentUser?: User | null): string {
  const fromName = comment.author?.name?.trim();
  if (fromName) return fromName;
  if (currentUser && comment.authorId === currentUser.id && currentUser.name?.trim()) {
    return currentUser.name.trim();
  }
  const fromEmail = comment.author?.email?.trim();
  if (fromEmail) return fromEmail.split("@")[0] || fromEmail;
  if (currentUser && comment.authorId === currentUser.id && currentUser.email?.trim()) {
    const local = currentUser.email.trim().split("@")[0];
    if (local) return local;
  }
  return `user-${comment.authorId.slice(0, 6)}`;
}

function formatRelativeShort(date: Date): string {
  const raw = formatDistanceToNowStrict(date, { addSuffix: true });
  return raw
    .replace(" seconds", " sec")
    .replace(" second", " sec")
    .replace(" minutes", " min")
    .replace(" minute", " min")
    .replace(" hours", " hr")
    .replace(" hour", " hr")
    .replace(" days", " d")
    .replace(" day", " d")
    .replace(" months", " mo")
    .replace(" month", " mo")
    .replace(" years", " yr")
    .replace(" year", " yr");
}

interface ThreadCardProps {
  comment: Comment;
  currentUser?: User | null;
  isActive: boolean;
  isOrphaned: boolean;
  onClick: () => void;
  onHover: (anchor: Anchor | null) => void;
}

function ThreadCard({ comment, currentUser, isActive, isOrphaned, onClick, onHover }: ThreadCardProps) {
  const authorName = commentAuthorLabel(comment, currentUser);
  const replyCount = comment.replies?.length ?? 0;

  return (
    <button
      type="button"
      data-comment-root-id={comment.id}
      className={cn(
        "group w-full rounded-lg border border-border bg-background text-left shadow-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-muted/30",
        isActive && "ring-1 ring-primary/30 border-primary/30",
        comment.resolved && "opacity-50",
      )}
      onClick={onClick}
      onMouseEnter={() => onHover(comment.anchor as Anchor)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="min-w-0 truncate text-sm font-semibold leading-tight">{authorName}</span>
              {comment.resolved ? (
                <CheckCircle2 className="size-3.5 shrink-0 text-muted-foreground" />
              ) : null}
              {isOrphaned ? (
                <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
              ) : null}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-[10px] text-muted-foreground">#{comment.id.slice(0, 6)}</span>
              <span className="text-[10px] text-muted-foreground">
                {formatRelativeShort(new Date(comment.createdAt))}
              </span>
            </div>
          </div>
        </div>
        <p className="line-clamp-2 text-sm text-foreground/90">{comment.body}</p>
        <div className="mt-2.5 flex items-center gap-1.5">
          {comment.tags?.map((t) => (
            <TagBadge key={t.id} tag={t} className="text-[10px]" />
          ))}
          {replyCount > 0 ? (
            <span className="ml-auto text-xs text-muted-foreground">
              ↩ {replyCount} {replyCount === 1 ? "reply" : "replies"}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export function CommentsSidebar({
  comments,
  currentUser,
  loading,
  tagOptions,
  onAddComment,
  addCommentDisabled,
  onResolve,
  onHover,
  activeThreadId,
  onSelectThread,
  onClose,
  anchorResolvedMap,
}: {
  comments: Comment[] | undefined;
  currentUser?: User | null;
  loading: boolean;
  tagOptions: Tag[];
  onAddComment: () => void;
  addCommentDisabled?: boolean;
  onResolve: (id: string, resolved: boolean) => void | Promise<void>;
  onHover: (anchor: Anchor | null) => void;
  activeThreadId: string | null;
  onSelectThread: (commentId: string) => void;
  onClose?: () => void;
  anchorResolvedMap?: Record<string, boolean>;
}) {
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [q, setQ] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeTagIds, setActiveTagIds] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);

  function toggleTagFilter(id: string) {
    setActiveTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const filtered = useMemo(() => {
    if (!comments) return [];
    let rows = comments.filter((c) => !c.parentId);
    if (filter === "open") rows = rows.filter((c) => !c.resolved);
    if (filter === "resolved") rows = rows.filter((c) => c.resolved);
    if (activeTagIds.length > 0) {
      rows = rows.filter((c) => c.tags?.some((t) => activeTagIds.includes(t.id)));
    }
    if (q.trim()) {
      const s = q.toLowerCase();
      rows = rows.filter((c) => {
        if (c.body.toLowerCase().includes(s)) return true;
        if (commentAuthorLabel(c, currentUser).toLowerCase().includes(s)) return true;
        if (c.tags?.some((t) => t.name.toLowerCase().includes(s))) return true;
        return (c.replies ?? []).some((r) => r.body.toLowerCase().includes(s));
      });
    }
    return rows;
  }, [comments, filter, q, activeTagIds, currentUser]);

  useEffect(() => {
    if (!activeThreadId) return;
    const container = listRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`[data-comment-root-id="${activeThreadId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeThreadId, filtered]);

  const topLevel = comments?.filter((c) => !c.parentId) ?? [];
  const totalCount = topLevel.length;
  const openCount = topLevel.filter((c) => !c.resolved).length;
  const resolvedCount = topLevel.filter((c) => c.resolved).length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      {/* Header */}
      <div className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-sidebar-foreground">Comments</h2>
          {comments !== undefined ? (
            <span className="text-xs text-muted-foreground">({totalCount})</span>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn("size-7", filterOpen && "bg-accent text-accent-foreground")}
              onClick={() => setFilterOpen((v) => !v)}
              aria-label="Toggle filters"
            >
              <Filter className="size-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" aria-label="More options">
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => {
                    const unresolved = (comments ?? []).filter((c) => !c.parentId && !c.resolved);
                    for (const c of unresolved) void onResolve(c.id, true);
                  }}
                >
                  Mark all resolved
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {onClose ? (
              <Button variant="ghost" size="icon" className="size-7 lg:hidden" onClick={onClose}>
                <X className="size-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
        {comments !== undefined ? (
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => setFilter("open")}
              className={cn("transition-colors duration-150 hover:text-foreground", filter === "open" && "text-foreground font-medium")}
            >
              {openCount} open
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => setFilter("resolved")}
              className={cn("transition-colors duration-150 hover:text-foreground", filter === "resolved" && "text-foreground font-medium")}
            >
              {resolvedCount} resolved
            </button>
            {filter !== "all" ? (
              <>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className="transition-colors duration-150 hover:text-foreground"
                >
                  All
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Filter row */}
      {filterOpen ? (
        <div className="space-y-2 border-b border-sidebar-border p-4">
          {tagOptions.length > 0 ? (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {tagOptions.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTagFilter(t.id)}
                  className="shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={
                    activeTagIds.includes(t.id)
                      ? { backgroundColor: `${t.color}22`, color: t.color, borderColor: `${t.color}55` }
                      : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
                  }
                >
                  {t.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Search */}
      <div className="border-b border-sidebar-border px-4 py-2">
        <div className="relative">
          <Search className="absolute left-0 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 w-full rounded-none border-0 border-b border-border bg-transparent pl-5 text-xs shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60"
            placeholder="Search..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {/* Thread list */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <MessageSquarePlus className="size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">No comments</p>
            <p className="text-xs text-muted-foreground">
              {filter === "all" && !q
                ? "Click any element in the preview to add feedback."
                : "No comments match this filter."}
            </p>
          </div>
        ) : (
          <div ref={listRef} className="space-y-2">
            {filtered.map((c) => {
              const isOrphaned =
                Boolean(c.anchor?.selector || c.anchor?.dataComment) &&
                anchorResolvedMap?.[c.id] === false;
              return (
                <ThreadCard
                  key={c.id}
                  comment={c}
                  currentUser={currentUser}
                  isActive={activeThreadId === c.id}
                  isOrphaned={isOrphaned}
                  onClick={() => onSelectThread(c.id)}
                  onHover={onHover}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Add comment button */}
      <div className="sticky bottom-0 border-t border-sidebar-border bg-sidebar p-2.5">
        <Button
          className="w-full gap-2"
          size="sm"
          variant="outline"
          onClick={onAddComment}
          disabled={addCommentDisabled}
        >
          <MessageSquarePlus className="size-4" />
          Add Comment
        </Button>
      </div>
    </div>
  );
}
