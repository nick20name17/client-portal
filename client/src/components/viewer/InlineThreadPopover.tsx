"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, CheckCircle, RotateCcw, Trash2, X } from "lucide-react";

import { TagBadge } from "@/components/comments/TagBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Comment, User } from "@/types";

interface InlineThreadPopoverProps {
  comment: Comment;
  currentUser: User | null;
  canComment?: boolean;
  onClose: () => void;
  onResolve: (id: string, resolved: boolean) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onReply: (commentId: string, body: string) => void | Promise<void>;
  isOrphaned?: boolean;
}

function canResolve(user: User | null): boolean {
  if (!user) return false;
  return user.role === "admin" || user.role === "manager";
}

function canDelete(user: User | null, authorId: string): boolean {
  if (!user) return false;
  return user.role === "admin" || user.id === authorId;
}

function ReplyItem({ reply }: { reply: Comment }) {
  const name =
    reply.author?.name?.trim() ||
    reply.author?.email?.split("@")[0] ||
    `user-${reply.authorId.slice(0, 6)}`;
  const image = reply.author?.image ?? null;
  return (
    <div className="flex gap-2 pl-3">
      <UserAvatar name={name} image={image} className="mt-0.5 size-6 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-medium">{name}</span>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-foreground/90">{reply.body}</p>
      </div>
    </div>
  );
}

export function InlineThreadPopover({
  comment,
  currentUser,
  canComment = true,
  onClose,
  onResolve,
  onDelete,
  onReply,
  isOrphaned,
}: InlineThreadPopoverProps) {
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const authorName =
    comment.author?.name?.trim() ||
    comment.author?.email?.split("@")[0] ||
    `user-${comment.authorId.slice(0, 6)}`;
  const authorImage = comment.author?.image ?? null;
  const replies = comment.replies ?? [];

  async function handleReply() {
    const t = replyText.trim();
    if (!t) return;
    setSubmitting(true);
    try {
      await onReply(comment.id, t);
      setReplyText("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={cn(
        "flex w-80 flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-xl",
        comment.resolved && "ring-1 ring-[oklch(0.527_0.154_150.069)]/30",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2 border-b border-border px-3 py-2.5",
          comment.resolved && "bg-[oklch(0.527_0.154_150.069)]/5",
        )}
      >
        <UserAvatar name={authorName} image={authorImage} className="size-7 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{authorName}</p>
          <p className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Body */}
      <div className="space-y-2.5 px-3 py-3">
        {isOrphaned ? (
          <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            ⚠ Element not found in current version
          </p>
        ) : null}
        <p className="whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>
        {comment.tags?.length ? (
          <div className="flex flex-wrap gap-1">
            {comment.tags.map((t) => (
              <TagBadge key={t.id} tag={t} />
            ))}
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex items-center gap-1.5 border-t border-border/60 pt-2">
          {canResolve(currentUser) ? (
            !comment.resolved ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-[oklch(0.527_0.154_150.069)] hover:text-[oklch(0.527_0.154_150.069)]"
                onClick={() => void onResolve(comment.id, true)}
              >
                <CheckCircle className="size-3.5" />
                Resolve
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={() => void onResolve(comment.id, false)}
              >
                <RotateCcw className="size-3.5" />
                Unresolve
              </Button>
            )
          ) : null}
          {canDelete(currentUser, comment.authorId) ? (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 gap-1.5 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => void onDelete(comment.id)}
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 ? (
        <div className="space-y-2.5 border-t border-border/60 px-3 py-2.5">
          {replies.map((r) => (
            <ReplyItem key={r.id} reply={r} />
          ))}
        </div>
      ) : null}

      {/* Reply input */}
      <div className="flex items-center gap-2 border-t border-border/60 bg-muted/30 px-3 py-2">
        {currentUser ? (
          <UserAvatar
            name={currentUser.name}
            image={currentUser.image ?? null}
            className="size-6 shrink-0"
          />
        ) : null}
        <Input
          className="h-7 flex-1 border-0 bg-transparent px-0 text-xs shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
          placeholder={canComment ? "Reply…" : "Switch to Commenting mode to reply"}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleReply();
            }
          }}
          disabled={submitting || !canComment}
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-primary disabled:opacity-40"
          disabled={!replyText.trim() || submitting || !canComment}
          onClick={() => void handleReply()}
        >
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
