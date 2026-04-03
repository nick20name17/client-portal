
import { useEffect, useMemo, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Check, ChevronDown, Link2Off, MessageSquarePlus, Pencil, Search, Tag as TagIcon, Trash2, X } from "lucide-react";

import { MentionTextarea, type MentionMember } from "@/components/comments/MentionTextarea";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { renderMentionBody } from "@/lib/mention-utils";
import { cn, formatRelativeShort } from "@/lib/utils";
import type { Anchor, Comment, FileVersion, Tag, User } from "@/types";

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


function isEdited(comment: Comment): boolean {
  return comment.updatedAt !== comment.createdAt;
}

interface CommentThreadProps {
  comment: Comment;
  index: number;
  currentUser?: User | null;
  members?: MentionMember[];
  isActive: boolean;
  isOrphaned: boolean;
  isUnlinked?: boolean;
  versionSha?: string;
  onClick: () => void;
  onHover: (anchor: Anchor | null) => void;
  onResolve: (id: number, resolved: boolean) => void | Promise<void>;
  onEdit?: (id: number, newBody: string) => void | Promise<void>;
  onDelete?: (id: number) => void | Promise<void>;
  onReLink?: (id: number) => void;
  onUnlink?: (id: number) => void;
}

function CommentThread({
  comment,
  index,
  currentUser,
  members,
  isActive,
  isOrphaned,
  isUnlinked,
  versionSha,
  onClick,
  onHover,
  onResolve,
  onEdit,
  onDelete,
  onReLink,
  onUnlink,
}: CommentThreadProps) {
  const authorName = commentAuthorLabel(comment, currentUser);
  const image = comment.author?.image ?? null;
  const replies = comment.replies ?? [];

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.body);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canEdit = currentUser?.id === comment.authorId && !!onEdit;
  const canDel = currentUser?.id === comment.authorId && !!onDelete && replies.length === 0;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `comment-${comment.id}`,
    data: { commentId: comment.id },
    disabled: !onReLink,
  });

  function handleSaveEdit() {
    const t = editText.trim();
    if (!t || t === comment.body) { setEditing(false); setEditText(comment.body); return; }
    setEditing(false);
    void onEdit!(comment.id, t);
  }

  return (
    <div
      ref={setNodeRef}
      data-comment-root-id={comment.id}
      className={cn(
        "group/card rounded-lg px-3 py-2.5 shadow-[var(--shadow-card)] transition-all duration-100",
        isOrphaned ? "border border-red-500/30 bg-red-500/5" : isUnlinked ? "border border-amber-500/30 bg-amber-500/5" : "bg-background",
        isActive ? "ring-1 ring-primary/30" : "hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)]",
        comment.resolved && "opacity-50",
        onReLink ? "cursor-grab" : "cursor-pointer",
        isDragging && "opacity-40",
      )}
      onClick={() => !editing && onClick()}
      onMouseEnter={() => onHover(comment.anchor as Anchor)}
      onMouseLeave={() => onHover(null)}
      {...(onReLink ? listeners : {})}
      {...(onReLink ? attributes : {})}
    >
      <div className="flex gap-2.5">
        <UserAvatar
          name={authorName}
          image={image}
          userId={comment.authorId}
          className="mt-0.5 size-7 shrink-0 border-0"
        />
        <div className="min-w-0 flex-1">
          {/* status badge */}
          {(isOrphaned || isUnlinked || comment.resolved) ? (
            <div className="mb-0.5 flex items-center gap-1.5">
              {isOrphaned ? (
                <span className="text-[11px] font-medium text-red-500">Related element not found</span>
              ) : isUnlinked ? (
                <span className="text-[11px] font-medium text-amber-500">Needs element link</span>
              ) : comment.resolved ? (
                <span className="text-[11px] font-medium" style={{ color: "var(--status-done)" }}>Resolved</span>
              ) : null}
            </div>
          ) : null}

          {/* Author + time */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-[13px] font-semibold text-foreground">{authorName}</span>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {formatRelativeShort(new Date(comment.createdAt))}
            </span>
            {isEdited(comment) ? (
              <span className="text-[10px] text-muted-foreground/60">(edited)</span>
            ) : null}
          </div>

          {/* Body — edit mode or display */}
          {editing ? (
            <div className="mt-1" onClick={(e) => e.stopPropagation()}>
              <MentionTextarea
                autoFocus
                value={editText}
                onValueChange={setEditText}
                members={members}
                rows={3}
                className="px-2 py-1.5 text-[13px] leading-relaxed focus-visible:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void handleSaveEdit(); }
                  if (e.key === "Escape") { setEditing(false); setEditText(comment.body); }
                }}
              />
              <div className="mt-1 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void handleSaveEdit()}
                  disabled={!editText.trim()}
                  className="rounded-md bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => { setEditing(false); setEditText(comment.body); }}
                  className="rounded-md px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className={cn("mt-0.5 text-[13px] leading-relaxed text-foreground/80", comment.resolved && "line-through")}>
              {renderMentionBody(comment.body)}
            </p>
          )}

          {/* Actions row — always rendered to prevent height shift on hover */}
          {!editing ? (
            <div className="mt-1 flex items-center gap-2 min-h-[20px]">
              {replies.length > 0 ? (
                <span className="text-[12px] font-medium text-primary">
                  {replies.length} {replies.length === 1 ? "reply" : "replies"}
                </span>
              ) : null}
              <div className="ml-auto flex items-center gap-1.5 invisible group-hover/card:visible">
                {confirmDelete ? (
                  <span className="flex items-center gap-1.5 text-[12px]" onClick={(e) => e.stopPropagation()}>
                    <span className="text-destructive">Delete?</span>
                    <button type="button" onClick={() => { void onDelete!(comment.id); setConfirmDelete(false); }} className="font-medium text-destructive hover:underline">Yes</button>
                    <button type="button" onClick={() => setConfirmDelete(false)} className="text-muted-foreground hover:text-foreground">No</button>
                  </span>
                ) : (
                  <>
                    {canEdit ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); setEditText(comment.body); setEditing(true); }}
                      >
                        <Pencil className="size-3" />
                        Edit
                      </button>
                    ) : null}
                    {canDel ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] text-muted-foreground transition-colors hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                      >
                        <Trash2 className="size-3" />
                        Delete
                      </button>
                    ) : null}
                    {isOrphaned && onUnlink ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-red-500/70 transition-colors hover:bg-red-500/10 hover:text-red-500"
                        onClick={(e) => { e.stopPropagation(); onUnlink(comment.id); }}
                      >
                        <Link2Off className="size-3" />
                        Unlink
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CommentsSidebar({
  comments,
  currentUser,
  members,
  loading,
  tagOptions,
  onAddComment: _onAddComment,
  onSubmitDirectComment,
  addCommentDisabled,
  onResolve,
  onHover,
  activeThreadId,
  onSelectThread,
  onClose,
  anchorResolvedMap,
  versions,
  onReLink,
  onUnlink,
  onEditComment,
  onDeleteComment,
}: {
  comments: Comment[] | undefined;
  currentUser?: User | null;
  members?: MentionMember[];
  loading: boolean;
  tagOptions: Tag[];
  onAddComment: () => void;
  onSubmitDirectComment?: (body: string) => void | Promise<void>;
  addCommentDisabled?: boolean;
  onResolve: (id: number, resolved: boolean) => void | Promise<void>;
  onHover: (anchor: Anchor | null) => void;
  activeThreadId: number | null;
  onSelectThread: (commentId: number) => void;
  onClose?: () => void;
  anchorResolvedMap?: Record<string, boolean>;
  versions?: FileVersion[];
  onReLink?: (id: number) => void;
  onUnlink?: (id: number) => void;
  onEditComment?: (id: number, newBody: string) => void | Promise<void>;
  onDeleteComment?: (id: number) => void | Promise<void>;
}) {
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());
  const listRef = useRef<HTMLDivElement | null>(null);

  function toggleTag(id: number) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const versionShaById = useMemo(() => {
    const map: Record<number, string> = {};
    for (const v of versions ?? []) map[v.id] = v.commitSha.slice(0, 7);
    return map;
  }, [versions]);

  const topLevel = useMemo(() => (comments ?? []).filter((c) => !c.parentId), [comments]);
  const openCount = useMemo(() => topLevel.filter((c) => !c.resolved).length, [topLevel]);

  const filtered = useMemo(() => {
    let rows = topLevel;
    if (filter === "open") rows = rows.filter((c) => !c.resolved);
    if (filter === "resolved") rows = rows.filter((c) => c.resolved);
    return rows;
  }, [topLevel, filter]);

  useEffect(() => {
    if (!activeThreadId) return;
    const container = listRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`[data-comment-root-id="${activeThreadId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeThreadId, filtered]);

  const resolvedCount = topLevel.length - openCount;

  const filteredBySearch = useMemo(() => {
    let rows = filtered;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.body.toLowerCase().includes(q) ||
          (c.author?.name ?? "").toLowerCase().includes(q) ||
          (c.replies ?? []).some((r) => r.body.toLowerCase().includes(q)),
      );
    }
    if (selectedTagIds.size > 0) {
      rows = rows.filter((c) => (c.tags ?? []).some((t) => selectedTagIds.has(t.id)));
    }
    return rows;
  }, [filtered, searchQuery, selectedTagIds]);

  const filters = [
    { key: "all" as const, label: `All (${topLevel.length})` },
    { key: "open" as const, label: `Open (${openCount})` },
    { key: "resolved" as const, label: `Resolved (${resolvedCount})` },
  ];

  function renderThreadList(list: Comment[], startIndex: number, opts: { isOrphaned: boolean; isUnlinked?: boolean }) {
    return list.map((c) => {
      const idx = startIndex++;
      return (
        <CommentThread
          key={c.id}
          comment={c}
          index={idx}
          currentUser={currentUser}
          members={members}
          isActive={activeThreadId === c.id}
          isOrphaned={opts.isOrphaned}
          isUnlinked={opts.isUnlinked}
          versionSha={c.versionId ? versionShaById[c.versionId] : undefined}
          onClick={() => onSelectThread(c.id)}
          onHover={onHover}
          onResolve={onResolve}
          onEdit={onEditComment}
          onDelete={onDeleteComment}
          onReLink={onReLink}
          onUnlink={opts.isOrphaned ? onUnlink : undefined}
        />
      );
    });
  }

  return (
    <TooltipProvider delayDuration={300}>
    <div className="flex h-full min-h-0 flex-col bg-bg-secondary">

      {/* ── Header: search + more ── */}
      <div className="flex items-center gap-2 bg-bg-secondary px-3 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
        {/* Search input */}
        <div className="relative flex flex-1 items-center">
          <Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>


        {onClose ? (
          <button
            type="button"
            aria-label="Close"
            className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-bg-hover hover:text-foreground lg:hidden"
            onClick={onClose}
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {/* ── Segmented filter + tag filter ── */}
      <div className="bg-bg-secondary px-3 pt-2.5 pb-2.5 space-y-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex rounded-lg bg-muted/80 p-0.5">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex-1 rounded-md px-2.5 py-1 text-[12px] font-medium transition-all",
                filter === f.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

      {tagOptions.length > 0 ? (
        <div className="space-y-1.5">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-6 items-center gap-1 rounded border border-border bg-background px-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <TagIcon className="size-3 shrink-0" />
                Tags
                {selectedTagIds.size > 0 ? (
                  <span className="text-[11px] font-medium text-foreground">({selectedTagIds.size})</span>
                ) : (
                  <ChevronDown className="size-3 opacity-40" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-40 p-1">
              {tagOptions.map((tag) => {
                const selected = selectedTagIds.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-[12px] text-foreground hover:bg-muted/70 transition-colors"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 text-left">{tag.name}</span>
                    {selected ? <Check className="size-3 text-foreground/60" /> : null}
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>

          {/* Selected tag chips */}
          {selectedTagIds.size > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tagOptions.filter((t) => selectedTagIds.has(t.id)).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                >
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <X className="size-2.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      </div>

      {/* ── Thread list ── */}
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto bg-bg-secondary px-3 py-2.5 space-y-1.5" role="list">
        {loading ? (
          <div className="space-y-1.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex gap-2.5 rounded-lg bg-background px-3 py-3 shadow-[var(--shadow-card)]"
              >
                <Skeleton className="size-6 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2 pt-1">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredBySearch.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted/60">
              <MessageSquarePlus className="size-6 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-foreground">No comments yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {searchQuery
                  ? "No comments match your search."
                  : filter === "all"
                  ? "Click any element in the preview to add feedback."
                  : "No comments match this filter."}
              </p>
            </div>
          </div>
        ) : (() => {
          const unlinked = filteredBySearch.filter(
            (c) => !c.anchor?.selector && !c.anchor?.dataComment,
          );
          const orphaned = filteredBySearch.filter(
            (c) => Boolean(c.anchor?.selector || c.anchor?.dataComment) && anchorResolvedMap?.[String(c.id)] === false,
          );
          const normal = filteredBySearch.filter(
            (c) => !unlinked.includes(c) && !orphaned.includes(c),
          );
          let idx = 0;
          const unlinkedNodes = renderThreadList(unlinked, idx, { isOrphaned: false, isUnlinked: true });
          idx += unlinked.length;
          const orphanedNodes = renderThreadList(orphaned, idx, { isOrphaned: true });
          idx += orphaned.length;
          const normalNodes = renderThreadList(normal, idx, { isOrphaned: false });
          return <>{unlinkedNodes}{orphanedNodes}{normalNodes}</>;
        })()}
      </div>

    </div>
    </TooltipProvider>
  );
}
