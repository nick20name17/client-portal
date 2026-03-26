"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, CheckCircle, Link2, Reply, RotateCcw } from "lucide-react";

import { ResolvedBadge } from "@/components/comments/ResolvedBadge";
import { TagBadge } from "@/components/comments/TagBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Anchor, Comment } from "@/types";

function hasAssignedAnchor(anchor: Anchor | undefined) {
  if (!anchor) return false;
  return Boolean(anchor.selector || anchor.dataComment);
}

export function CommentItem({
  comment,
  depth,
  onReply,
  onResolve,
  onHover,
  activeThreadId,
  anchorResolvedMap,
}: {
  comment: Comment;
  depth: number;
  onReply: (id: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onHover: (anchor: Anchor | null) => void;
  activeThreadId: string | null;
  /** Per-comment id: iframe DOM check — true = node found, false = was attached but missing from current HTML */
  anchorResolvedMap?: Record<string, boolean>;
}) {
  const authorName = comment.author?.name ?? "Unknown";
  const authorImage = comment.author?.image ?? null;
  const anchorResolved = anchorResolvedMap?.[comment.id];
  const isAssigned = hasAssignedAnchor(comment.anchor as Anchor);
  const elementMissing = isAssigned && anchorResolved === false;
  const showAttachedBadge = isAssigned && anchorResolved === true;
  const isActiveThread = depth === 0 && activeThreadId === comment.id;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow",
        isActiveThread &&
          "ring-2 ring-blue-500/70 ring-offset-2 ring-offset-background dark:ring-blue-400/60",
      )}
      data-comment-root-id={depth === 0 ? comment.id : undefined}
      style={{
        marginLeft: depth > 0 ? 12 : 0,
        borderLeftWidth: 3,
        borderLeftColor: comment.resolved ? "var(--status-resolved)" : "rgba(13, 153, 255, 0.45)",
      }}
      onMouseEnter={() => onHover(comment.anchor as Anchor)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 gap-2">
          <UserAvatar name={authorName} image={authorImage} className="size-8 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{authorName}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
              {comment.anchor?.tagName ? (
                <span>
                  {" "}
                  · <span className="font-mono">&lt;{String(comment.anchor.tagName).toLowerCase()}&gt;</span>
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <ResolvedBadge resolved={comment.resolved} />
      </div>
      {showAttachedBadge ? (
        <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-blue-200/90 bg-blue-50/90 px-2.5 py-1 text-[11px] font-medium text-blue-900 dark:border-blue-500/35 dark:bg-blue-500/10 dark:text-blue-100">
          <Link2 className="size-3.5" />
          Highlighted part attached
        </div>
      ) : null}
      {elementMissing ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-500/90">
          <AlertTriangle className="size-3.5 shrink-0" />
          Element not found in current version
        </p>
      ) : null}
      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {comment.tags?.map((t) => (
          <TagBadge key={t.id} tag={t} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {depth === 0 ? (
          <Button variant="ghost" size="sm" onClick={() => onReply(comment.id)}>
            <Reply className="size-3.5" />
            Reply
          </Button>
        ) : null}
        {!comment.resolved ? (
          <Button variant="outline" size="sm" className="text-(--status-resolved) hover:text-(--status-resolved)" onClick={() => onResolve(comment.id, true)}>
            <CheckCircle className="size-3.5" />
            Resolve
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => onResolve(comment.id, false)}>
            <RotateCcw className="size-3.5" />
            Reopen
          </Button>
        )}
      </div>
      {comment.replies?.length ? (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          {comment.replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              depth={depth + 1}
              onReply={onReply}
              onResolve={onResolve}
              onHover={onHover}
              activeThreadId={activeThreadId}
              anchorResolvedMap={anchorResolvedMap}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
