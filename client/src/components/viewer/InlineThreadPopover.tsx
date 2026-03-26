"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
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

function ThreadMessageItem({ item, isParent = false }: { item: Comment; isParent?: boolean }) {
  const name =
    item.author?.name?.trim() ||
    item.author?.email?.split("@")[0] ||
    `user-${item.authorId.slice(0, 6)}`;
  const image = item.author?.image ?? null;

  return (
    <div className={cn("flex gap-2.5", !isParent && "pl-2")}>
      <UserAvatar name={name} image={image} className="mt-0.5 size-8 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{name}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {formatRelativeShort(new Date(item.createdAt))}
          </span>
        </div>
        <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground/95">{item.body}</p>
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
  const repliesEndRef = useRef<HTMLDivElement>(null);

  const replies = comment.replies ?? [];
  const threadItems = [comment, ...replies];

  useEffect(() => {
    repliesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replies.length]);

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
        "flex w-[340px] flex-col overflow-hidden rounded-[22px] border border-border/80 bg-popover shadow-2xl",
        comment.resolved && "ring-1 ring-[oklch(0.527_0.154_150.069)]/25",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b border-border/70 px-4 py-3",
          comment.resolved && "bg-[oklch(0.527_0.154_150.069)]/7",
        )}
      >
        <p className="min-w-0 flex-1 truncate text-[28px] leading-none">💬</p>
        {canDelete(currentUser, comment.authorId) ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-destructive hover:text-destructive"
            onClick={() => void onDelete(comment.id)}
            title="Delete thread"
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => void onResolve(comment.id, !comment.resolved)}
          disabled={!canResolve(currentUser)}
          title={comment.resolved ? "Unresolve thread" : "Resolve thread"}
        >
          {comment.resolved ? <RotateCcw className="size-4" /> : <CheckCircle className="size-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="px-4 pb-2 pt-3">
        {isOrphaned ? (
          <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            ⚠ Element not found in current version
          </p>
        ) : null}
        {comment.tags?.length ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {comment.tags.map((t) => (
              <TagBadge key={t.id} tag={t} />
            ))}
          </div>
        ) : null}
      </div>

      {/* Thread list */}
      <div className="max-h-[380px] overflow-y-auto px-4 pb-2">
        <div className="space-y-4">
          {threadItems.map((item, index) => (
            <ThreadMessageItem key={item.id} item={item} isParent={index === 0} />
          ))}
          <div ref={repliesEndRef} />
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 border-t border-border/70 px-4 py-2">
        <span className="text-xs text-muted-foreground">{replies.length} {replies.length === 1 ? "reply" : "replies"}</span>
        <div className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground/70">
          {comment.resolved ? "Resolved" : "Open"}
        </div>
      </div>

      {/* Reply input */}
      <div className="flex items-center gap-2 border-t border-border/70 bg-muted/20 px-4 py-3">
        {currentUser ? (
          <UserAvatar
            name={currentUser.name}
            image={currentUser.image ?? null}
            className="size-8 shrink-0"
          />
        ) : null}
        <Input
          className="h-10 flex-1 rounded-xl border-0 bg-muted/60 px-3 text-sm shadow-none placeholder:text-muted-foreground/80 focus-visible:ring-1 focus-visible:ring-ring"
          placeholder={canComment ? "Reply" : "Switch to Commenting mode to reply"}
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
          variant="secondary"
          size="icon"
          className="size-9 shrink-0 rounded-full disabled:opacity-40"
          disabled={!replyText.trim() || submitting || !canComment}
          onClick={() => void handleReply()}
        >
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
