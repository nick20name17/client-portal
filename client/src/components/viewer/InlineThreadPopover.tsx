
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle, CornerDownRight, Link2Off, MessageSquare, Pencil, Reply, RotateCcw, Trash2, X } from "lucide-react";

import { MentionTextarea, type MentionMember } from "@/components/comments/MentionTextarea";
import { TagBadge } from "@/components/comments/TagBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { renderMentionBody } from "@/lib/mention-utils";
import { cn, formatRelativeShort } from "@/lib/utils";
import type { Comment, Tag, User } from "@/types";

interface InlineThreadPopoverProps {
  comment: Comment;
  relatedComments?: Comment[];
  currentUser: User | null;
  canComment?: boolean;
  members?: MentionMember[];
  onClose: () => void;
  onResolve: (id: number, resolved: boolean) => void | Promise<void>;
  onDelete: (id: number) => void | Promise<void>;
  onReply: (commentId: number, body: string) => void | Promise<void>;
  onNewComment: (commentId: number, body: string) => void | Promise<void>;
  onEditMessage?: (id: number, newBody: string) => void | Promise<void>;
  onUnlink?: (id: number) => void;
  isOrphaned?: boolean;
}

function canResolve(user: User | null): boolean {
  if (!user) return false;
  return user.role === "admin" || user.role === "manager";
}

function canDeleteComment(user: User | null, authorId: string): boolean {
  if (!user) return false;
  return user.role === "admin" || user.id === authorId;
}

function isEdited(item: Comment): boolean {
  return item.updatedAt !== item.createdAt;
}

function ThreadMessageItem({
  item,
  isRoot = false,
  tags,
  currentUser,
  members,
  onReply,
  onEdit,
  onDelete,
}: {
  item: Comment;
  isRoot?: boolean;
  tags?: Tag[];
  currentUser?: User | null;
  members?: MentionMember[];
  onReply?: () => void;
  onEdit?: (id: number, newBody: string) => void | Promise<void>;
  onDelete?: (id: number) => void | Promise<void>;
}) {
  const name =
    item.author?.name?.trim() ||
    item.author?.email?.split("@")[0] ||
    `user-${item.authorId.slice(0, 6)}`;
  const image = item.author?.image ?? null;

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.body);

  const canEdit = currentUser?.id === item.authorId && !!onEdit;
  const canDel = !isRoot && canDeleteComment(currentUser ?? null, item.authorId) && !!onDelete;
  const hasReplies = isRoot && (item.replies?.length ?? 0) > 0;

  function handleSaveEdit() {
    const t = editText.trim();
    if (!t || t === item.body) { setEditing(false); setEditText(item.body); return; }
    setEditing(false);
    void onEdit!(item.id, t);
  }

  return (
    <div className={cn("group/msg flex gap-2.5", !isRoot && "ml-7 border-l-2 border-border/40 pl-3")}>
      <UserAvatar
        name={name}
        image={image}
        userId={item.authorId}
        className={cn("shrink-0", isRoot ? "mt-0.5 size-7" : "mt-0.5 size-6")}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13px] font-semibold text-foreground">{name}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {formatRelativeShort(new Date(item.createdAt))}
          </span>
          {isEdited(item) ? (
            <span className="text-[10px] text-muted-foreground/60">(edited)</span>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            {tags?.length ? (
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => (
                  <TagBadge key={t.id} tag={t} />
                ))}
              </div>
            ) : null}
            {!editing && canEdit ? (
              <button
                type="button"
                onClick={() => { setEditText(item.body); setEditing(true); }}
                className="invisible group-hover/msg:visible flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <Pencil className="size-3" />
              </button>
            ) : null}
            {!editing && canDel && !hasReplies ? (
              <button
                type="button"
                onClick={() => onDelete!(item.id)}
                className="invisible group-hover/msg:visible flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </button>
            ) : null}
            {onReply && !editing ? (
              <button
                type="button"
                onClick={onReply}
                className="invisible group-hover/msg:visible flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <Reply className="size-3" />
                Reply
              </button>
            ) : null}
          </div>
        </div>
        {editing ? (
          <div className="mt-1">
            <MentionTextarea
              autoFocus
              value={editText}
              onValueChange={setEditText}
              members={members}
              rows={3}
              className="px-2 py-1.5 text-[13px] leading-relaxed focus-visible:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/30"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void handleSaveEdit(); }
                if (e.key === "Escape") { setEditing(false); setEditText(item.body); }
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
                onClick={() => { setEditing(false); setEditText(item.body); }}
                className="rounded-md px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">{renderMentionBody(item.body)}</p>
        )}
      </div>
    </div>
  );
}

export function InlineThreadPopover({
  comment,
  relatedComments,
  currentUser,
  canComment = true,
  members,
  onClose,
  onResolve,
  onDelete,
  onReply,
  onNewComment,
  onEditMessage,
  onUnlink,
  isOrphaned,
}: InlineThreadPopoverProps) {
  const hasAnchor = Boolean(comment.anchor?.selector || comment.anchor?.dataComment);
  const isUnlinked = !hasAnchor;
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resolvePending, setResolvePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ threadRootId: number; name: string } | null>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const allThreads = [comment, ...(relatedComments ?? [])];
  const totalReplies = allThreads.reduce((n, t) => n + (t.replies?.length ?? 0), 0);
  const hasReplies = (comment.replies?.length ?? 0) > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [totalReplies]);

  function handleSetReplyingTo(threadRoot: Comment) {
    const name =
      threadRoot.author?.name?.trim() ||
      threadRoot.author?.email?.split("@")[0] ||
      "user";
    setReplyingTo({ threadRootId: threadRoot.id, name });
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleCancelReply() {
    setReplyingTo(null);
    setReplyText("");
  }

  async function handleSubmit() {
    const t = replyText.trim();
    if (!t) return;
    const pendingReplyingTo = replyingTo;
    setSubmitting(true);
    setReplyText("");
    setReplyingTo(null);
    try {
      if (pendingReplyingTo) {
        await onReply(pendingReplyingTo.threadRootId, t);
      } else {
        await onNewComment(comment.id, t);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
    <div
      className={cn(
        "flex w-[360px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-popover shadow-2xl",
        comment.resolved && "ring-1 ring-[var(--status-done)]/25",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2 border-b border-border/60 px-3.5 py-2.5",
          comment.resolved && "bg-[var(--status-done)]/[0.07]",
        )}
      >
        <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-[13px] font-semibold text-foreground">Comment</span>
        <div className="flex items-center gap-0.5">
          {canDeleteComment(currentUser, comment.authorId) && !hasReplies ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={deletePending}
                  onClick={async () => {
                    setDeletePending(true);
                    try { await onDelete(comment.id); } finally { setDeletePending(false); }
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Delete thread</TooltipContent>
            </Tooltip>
          ) : null}
          {onUnlink && hasAnchor ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onUnlink(comment.id)}
                >
                  <Link2Off className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Unlink from element</TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={async () => {
                  setResolvePending(true);
                  try { await onResolve(comment.id, !comment.resolved); } finally { setResolvePending(false); }
                }}
                disabled={!canResolve(currentUser) || resolvePending}
              >
                {comment.resolved ? <RotateCcw className="size-3.5" /> : <CheckCircle className="size-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{comment.resolved ? "Unresolve" : "Resolve"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={onClose}
              >
                <X className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Close</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {isUnlinked ? (
        <div className="px-3.5 pt-2">
          <p className="text-[11px] text-amber-400">⚠ This comment must be linked to an element. Drag it from the sidebar onto an element.</p>
        </div>
      ) : isOrphaned ? (
        <div className="px-3.5 pt-2">
          <p className="text-[11px] text-amber-400">⚠ Element not found in current version</p>
        </div>
      ) : null}

      {/* Thread list */}
      <div className="max-h-[360px] overflow-y-auto px-3.5 pb-2 pt-2.5">
        {allThreads.map((thread, threadIndex) => (
          <div key={thread.id}>
            {threadIndex > 0 && <div className="my-3 border-t border-border/40" />}
            <div className="space-y-3.5">
              <ThreadMessageItem
                item={thread}
                isRoot={true}
                tags={threadIndex === 0 ? (comment.tags ?? []) : undefined}
                currentUser={currentUser}
                members={members}
                onReply={canComment ? () => handleSetReplyingTo(thread) : undefined}
                onEdit={onEditMessage}
                onDelete={onDelete}
              />
              {(thread.replies ?? []).map((reply) => (
                <ThreadMessageItem
                  key={reply.id}
                  item={reply}
                  isRoot={false}
                  currentUser={currentUser}
                  members={members}
                  onEdit={onEditMessage}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border/60 bg-muted/20">
        {replyingTo ? (
          <div className="flex items-center gap-1.5 border-b border-border/40 px-3.5 py-1.5">
            <CornerDownRight className="size-3 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-[11px] text-muted-foreground">
              Replying to <span className="font-medium text-foreground">{replyingTo.name}</span>
            </span>
            <button
              type="button"
              onClick={handleCancelReply}
              className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        ) : null}
        <div className="flex items-center gap-2 px-3.5 py-2.5">
          {currentUser ? (
            <UserAvatar
              name={currentUser.name}
              image={currentUser.image ?? null}
              userId={currentUser.id}
              className="size-7 shrink-0"
            />
          ) : null}
          <div className="relative flex-1">
            <MentionTextarea
              ref={inputRef}
              rows={1}
              members={members}
              className="rounded-lg border-0 bg-muted/60 py-1.5 pr-8 pl-2.5 shadow-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder={canComment ? (replyingTo ? "Reply…" : "New comment…") : "Switch to Commenting mode"}
              placeholderClassName="pl-2.5 py-1.5 text-[13px]"
              value={replyText}
              onValueChange={setReplyText}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSubmit();
                }
                if (e.key === "Escape" && replyingTo) {
                  handleCancelReply();
                }
              }}
              disabled={submitting || !canComment}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 size-8 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
              disabled={!replyText.trim() || submitting || !canComment}
              onClick={() => void handleSubmit()}
            >
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
