"use client";

import {
    createComment,
    createReply,
    deleteComment,
    deleteReply,
    updateComment,
    updateReply,
} from "@/api/comments/mutations";
import {
    commentKeys,
    commentsQueryOptions,
    type Comment,
    type CommentAuthor,
} from "@/api/comments/queries";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { queryClient } from "@/providers/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
    CheckCheck,
    ChevronDown,
    ChevronRight,
    Clock,
    FilterIcon,
    ListIcon,
    MessageSquareIcon,
    MousePointer2Icon,
    PencilIcon,
    SendIcon,
    Trash2Icon,
    XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Coordinate anchor (v2): percentage-based position within the page.
 * x and y are fractions [0,1] of the iframe's scrollWidth / scrollHeight.
 */
export type CoordAnchorV2 = {
    v: 2;
    x: number;
    y: number;
};

type ViewerMode = "browse" | "comment";
type SortOrder = "newest" | "oldest";
type SidebarTab = "thread" | "all";

function isCoordAnchorV2(x: unknown): x is CoordAnchorV2 {
    if (!x || typeof x !== "object") return false;
    const o = x as CoordAnchorV2;
    return o.v === 2 && typeof o.x === "number" && typeof o.y === "number";
}

function anchorsMatch(c: Comment, target: CoordAnchorV2 | null): boolean {
    if (!target || !c.anchorJson) return false;
    if (!isCoordAnchorV2(c.anchorJson)) return false;
    return (
        Math.abs(c.anchorJson.x - target.x) < 0.001 &&
        Math.abs(c.anchorJson.y - target.y) < 0.001
    );
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

function formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });
}

function UserAvatar({
    author,
    size = "sm",
}: {
    author: CommentAuthor;
    size?: "sm" | "xs" | "md";
}) {
    const dim = size === "xs" ? "size-5" : size === "md" ? "size-8" : "size-6";
    const text =
        size === "xs"
            ? "text-[9px]"
            : size === "md"
              ? "text-sm"
              : "text-[10px]";
    if (author.image) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={author.image}
                alt={author.name}
                className={cn(
                    dim,
                    "rounded-full object-cover shrink-0 ring-1 ring-border",
                )}
            />
        );
    }
    return (
        <span
            className={cn(
                dim,
                text,
                "rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold shrink-0 ring-1 ring-primary/20",
            )}>
            {getInitials(author.name)}
        </span>
    );
}

// ─── Iframe script ────────────────────────────────────────────────────────────

const IFRAME_SCRIPT = `
(function() {
  var mode = 'browse';

  function getContentSize() {
    var sw = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth, 1);
    var sh = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 1);
    return { sw: sw, sh: sh };
  }

  function postSize() {
    var s = getContentSize();
    window.parent.postMessage({ type: 'IFRAME_SIZE', sw: s.sw, sh: s.sh }, '*');
  }

  // Post size on load and whenever content might change
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', postSize);
  } else {
    setTimeout(postSize, 0);
  }
  window.addEventListener('load', postSize);

  // Watch for DOM mutations that might change height
  if (window.ResizeObserver) {
    new ResizeObserver(postSize).observe(document.body);
  }

  window.addEventListener('message', function(e) {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'SET_MODE') {
      mode = e.data.mode === 'comment' ? 'comment' : 'browse';
      document.body.style.cursor = mode === 'comment' ? 'crosshair' : '';
      document.body.style.userSelect = mode === 'comment' ? 'none' : '';
    }
    if (e.data.type === 'GET_SIZE') {
      postSize();
    }
  });

  document.addEventListener('click', function(e) {
    if (mode !== 'comment') return;
    if (e.target && e.target.closest && e.target.closest('a')) return;
    e.preventDefault();
    e.stopPropagation();

    var s = getContentSize();
    var x = e.pageX / s.sw;
    var y = e.pageY / s.sh;

    window.parent.postMessage({
      type: 'PLACE_COMMENT',
      anchor: { v: 2, x: x, y: y }
    }, '*');
  }, true);
})();
`;

function injectScript(html: string): string {
    const scriptTag = `<script>${IFRAME_SCRIPT}<\/script>`;
    if (html.includes("</head>")) {
        return html.replace("</head>", `${scriptTag}</head>`);
    }
    return scriptTag + html;
}

// ─── Comment pin badge ────────────────────────────────────────────────────────

interface PinProps {
    index: number;
    anchor: CoordAnchorV2;
    active: boolean;
    count: number;
    onClick: () => void;
}

function CommentPin({ index, anchor, active, count, onClick }: PinProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                left: `${anchor.x * 100}%`,
                top: `${anchor.y * 100}%`,
                transform: "translate(-50%, -100%)",
                pointerEvents: "auto",
            }}
            className={cn(
                "absolute z-10 flex items-center gap-0.5",
                "transition-transform duration-150 ease-out hover:scale-110 hover:z-20",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
            )}
            title={`Comment thread #${index + 1} (${count} comment${count !== 1 ? "s" : ""})`}>
            <div className="relative flex flex-col items-center">
                <div
                    className={cn(
                        "flex h-7 min-w-[1.75rem] items-center justify-center gap-0.5 rounded-full px-1.5 text-xs font-bold shadow-lg",
                        "transition-colors duration-150",
                        active
                            ? "bg-primary text-primary-foreground shadow-primary/30"
                            : "bg-background text-foreground border border-border shadow-black/10",
                    )}>
                    <MessageSquareIcon className="size-3 shrink-0" />
                    <span>{count}</span>
                </div>
                <div
                    className={cn(
                        "w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px]",
                        active ? "border-t-primary" : "border-t-background",
                    )}
                />
            </div>
        </button>
    );
}

// ─── Pending pin ──────────────────────────────────────────────────────────────

function PendingPin({ anchor }: { anchor: CoordAnchorV2 }) {
    return (
        <div
            style={{
                left: `${anchor.x * 100}%`,
                top: `${anchor.y * 100}%`,
                transform: "translate(-50%, -100%)",
            }}
            className="pointer-events-none absolute z-20 flex flex-col items-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 ring-2 ring-primary/30 animate-pulse">
                <MessageSquareIcon className="size-3" />
            </div>
            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-primary" />
        </div>
    );
}

// ─── Comment bubble ───────────────────────────────────────────────────────────

interface CommentBubbleProps {
    authorId: string;
    author: CommentAuthor;
    content: string;
    createdAt: string;
    currentUserId: string | undefined;
    isReply?: boolean;
    onDelete: () => void;
    onUpdate: (content: string) => void;
}

function CommentBubble({
    authorId,
    author,
    content,
    createdAt,
    currentUserId,
    isReply = false,
    onDelete,
    onUpdate,
}: CommentBubbleProps) {
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState(content);
    const editRef = useRef<HTMLInputElement>(null);
    const isOwn = currentUserId === authorId;

    const handleSaveEdit = () => {
        const trimmed = editValue.trim();
        if (!trimmed || trimmed === content) {
            setEditing(false);
            return;
        }
        onUpdate(trimmed);
        setEditing(false);
    };

    return (
        <div className={cn("group relative", isReply && "ml-0")}>
            <div className="flex gap-2">
                <div className="shrink-0 mt-0.5">
                    <UserAvatar author={author} size={isReply ? "xs" : "sm"} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 mb-0.5">
                        <span className="text-xs font-semibold truncate">
                            {author.name}
                        </span>
                        <span
                            className="text-[10px] text-muted-foreground shrink-0"
                            title={new Date(createdAt).toLocaleString()}>
                            {formatRelativeTime(createdAt)}
                        </span>
                    </div>

                    {editing ? (
                        <div className="flex gap-1.5 mt-1">
                            <input
                                ref={editRef}
                                autoFocus
                                className="flex-1 rounded-md border border-primary/50 bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 transition-shadow"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveEdit();
                                    if (e.key === "Escape") setEditing(false);
                                }}
                            />
                            <Button
                                size="icon-xs"
                                onClick={handleSaveEdit}
                                className="h-6 w-6">
                                <CheckCheck className="size-3" />
                            </Button>
                            <Button
                                size="icon-xs"
                                variant="ghost"
                                onClick={() => setEditing(false)}
                                className="h-6 w-6">
                                <XIcon className="size-3" />
                            </Button>
                        </div>
                    ) : (
                        <p className="text-xs leading-relaxed text-foreground/90 break-words">
                            {content}
                        </p>
                    )}
                </div>

                {isOwn && !editing && (
                    <div className="flex shrink-0 items-start gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-100 mt-0.5">
                        <Button
                            size="icon-xs"
                            variant="ghost"
                            className="size-5 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                                setEditValue(content);
                                setEditing(true);
                            }}>
                            <PencilIcon className="size-3" />
                        </Button>
                        <Button
                            size="icon-xs"
                            variant="ghost"
                            className="size-5 text-muted-foreground hover:text-destructive"
                            onClick={onDelete}>
                            <Trash2Icon className="size-3" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Comment thread ───────────────────────────────────────────────────────────

interface CommentThreadProps {
    comment: Comment;
    currentUserId: string | undefined;
    replyContent: string;
    onReplyChange: (val: string) => void;
    onReplySubmit: () => void;
    onDeleteComment: () => void;
    onDeleteReply: (replyId: number) => void;
    onUpdateComment: (content: string) => void;
    onUpdateReply: (replyId: number, content: string) => void;
    isSubmittingReply?: boolean;
}

function CommentThread({
    comment,
    currentUserId,
    replyContent,
    onReplyChange,
    onReplySubmit,
    onDeleteComment,
    onDeleteReply,
    onUpdateComment,
    onUpdateReply,
    isSubmittingReply,
}: CommentThreadProps) {
    const [showReplies, setShowReplies] = useState(true);
    const replyRef = useRef<HTMLInputElement>(null);

    return (
        <div className="group/thread">
            <CommentBubble
                authorId={comment.authorId}
                author={comment.author}
                content={comment.content}
                createdAt={comment.createdAt}
                currentUserId={currentUserId}
                onDelete={onDeleteComment}
                onUpdate={onUpdateComment}
            />

            {comment.replies.length > 0 && (
                <div className="mt-2 ml-8">
                    <button
                        onClick={() => setShowReplies((v) => !v)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors mb-1.5">
                        {showReplies ? (
                            <ChevronDown className="size-3" />
                        ) : (
                            <ChevronRight className="size-3" />
                        )}
                        {comment.replies.length}{" "}
                        {comment.replies.length === 1 ? "reply" : "replies"}
                    </button>
                    {showReplies && (
                        <div className="space-y-2.5 border-l-2 border-border/60 pl-3 ml-0.5">
                            {comment.replies.map((reply) => (
                                <CommentBubble
                                    key={reply.id}
                                    authorId={reply.authorId}
                                    author={reply.author}
                                    content={reply.content}
                                    createdAt={reply.createdAt}
                                    currentUserId={currentUserId}
                                    isReply
                                    onDelete={() => onDeleteReply(reply.id)}
                                    onUpdate={(content) =>
                                        onUpdateReply(reply.id, content)
                                    }
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Reply input */}
            <div className="mt-2 ml-8 flex gap-1.5 items-center">
                <input
                    ref={replyRef}
                    className="flex-1 h-7 rounded-md border border-input bg-transparent px-2 text-xs placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 transition-all"
                    placeholder="Reply…"
                    value={replyContent}
                    onChange={(e) => onReplyChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && replyContent.trim()) {
                            e.preventDefault();
                            onReplySubmit();
                        }
                    }}
                />
                <Button
                    size="icon-xs"
                    variant="ghost"
                    className="size-7 shrink-0"
                    disabled={!replyContent.trim() || isSubmittingReply}
                    onClick={onReplySubmit}>
                    <SendIcon className="size-3" />
                </Button>
            </div>
        </div>
    );
}

// ─── Thread panel (side panel for a specific anchor) ─────────────────────────

interface ThreadPanelProps {
    projectId: number;
    fileId: number;
    anchor: CoordAnchorV2;
    currentUserId: string | undefined;
    onClose: () => void;
    onCommentCreated: () => void;
    allComments: Comment[] | undefined;
    isLoading: boolean;
}

function ThreadPanel({
    projectId,
    fileId,
    anchor,
    currentUserId,
    onClose,
    onCommentCreated,
    allComments,
    isLoading,
}: ThreadPanelProps) {
    const [newComment, setNewComment] = useState("");
    const [replyContent, setReplyContent] = useState<Record<number, string>>(
        {},
    );
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const comments = allComments?.filter((c) => anchorsMatch(c, anchor)) ?? [];

    useEffect(() => {
        const t = setTimeout(() => textareaRef.current?.focus(), 80);
        return () => clearTimeout(t);
    }, [anchor]);

    const invalidate = () =>
        queryClient.invalidateQueries({
            queryKey: commentKeys.all(projectId, fileId),
        });

    const addCommentMutation = useMutation({
        mutationFn: () =>
            createComment(projectId, fileId, {
                content: newComment.trim(),
                anchorJson: { v: anchor.v, x: anchor.x, y: anchor.y },
            }),
        onSuccess: () => {
            setNewComment("");
            invalidate();
            onCommentCreated();
        },
        onError: (err) => toast.error(err.message),
    });

    const addReplyMutation = useMutation({
        mutationFn: ({
            commentId,
            content,
        }: {
            commentId: number;
            content: string;
        }) => createReply(commentId, content),
        onSuccess: (_, { commentId }) => {
            setReplyContent((prev) => ({ ...prev, [commentId]: "" }));
            invalidate();
        },
        onError: (err) => toast.error(err.message),
    });

    const deleteCommentMutation = useMutation({
        mutationFn: (id: number) => deleteComment(id),
        onSuccess: invalidate,
        onError: (err) => toast.error(err.message),
    });

    const deleteReplyMutation = useMutation({
        mutationFn: (id: number) => deleteReply(id),
        onSuccess: invalidate,
        onError: (err) => toast.error(err.message),
    });

    return (
        <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b bg-muted/20">
                <div className="flex items-center gap-2">
                    <MessageSquareIcon className="size-3.5 text-primary shrink-0" />
                    <span className="text-xs font-semibold">Thread</span>
                    {comments.length > 0 && (
                        <span className="rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-bold leading-none">
                            {comments.length}
                        </span>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={onClose}
                    className="size-6 text-muted-foreground hover:text-foreground">
                    <XIcon className="size-3" />
                </Button>
            </div>

            {/* Thread list */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scroll-smooth">
                {isLoading ? (
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <Skeleton className="size-6 rounded-full shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="h-8" />
                            </div>
                        </div>
                    </div>
                ) : comments.length === 0 ? (
                    <div className="py-6 text-center">
                        <MessageSquareIcon className="size-8 mx-auto mb-2 text-muted-foreground/40" />
                        <p className="text-xs text-muted-foreground">
                            No comments here yet.
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-0.5">
                            Be the first to add one!
                        </p>
                    </div>
                ) : (
                    comments.map((comment, idx) => (
                        <div key={comment.id}>
                            {idx > 0 && <Separator className="mb-4" />}
                            <CommentThread
                                comment={comment}
                                currentUserId={currentUserId}
                                replyContent={replyContent[comment.id] ?? ""}
                                onReplyChange={(val) =>
                                    setReplyContent((prev) => ({
                                        ...prev,
                                        [comment.id]: val,
                                    }))
                                }
                                onReplySubmit={() =>
                                    addReplyMutation.mutate({
                                        commentId: comment.id,
                                        content: replyContent[comment.id] ?? "",
                                    })
                                }
                                isSubmittingReply={addReplyMutation.isPending}
                                onDeleteComment={() =>
                                    deleteCommentMutation.mutate(comment.id)
                                }
                                onDeleteReply={(replyId) =>
                                    deleteReplyMutation.mutate(replyId)
                                }
                                onUpdateComment={(content) =>
                                    updateComment(comment.id, content).then(
                                        invalidate,
                                    )
                                }
                                onUpdateReply={(replyId, content) =>
                                    updateReply(replyId, content).then(
                                        invalidate,
                                    )
                                }
                            />
                        </div>
                    ))
                )}
            </div>

            {/* New comment input */}
            <div className="shrink-0 border-t bg-background px-3 py-2.5">
                <div className="flex gap-2 items-end">
                    <textarea
                        ref={textareaRef}
                        className="flex-1 resize-none rounded-lg border border-input bg-muted/30 px-2.5 py-2 text-xs placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 transition-all min-h-[60px] max-h-[120px]"
                        placeholder="Add a comment…"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault();
                                if (newComment.trim())
                                    addCommentMutation.mutate();
                            }
                        }}
                    />
                    <Button
                        size="icon-sm"
                        className="shrink-0 mb-0.5"
                        disabled={
                            !newComment.trim() || addCommentMutation.isPending
                        }
                        onClick={() => addCommentMutation.mutate()}>
                        <SendIcon className="size-3.5" />
                    </Button>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground/60">
                    ⌘+Enter to submit
                </p>
            </div>
        </div>
    );
}

// ─── All Comments Panel ────────────────────────────────────────────────────────

interface AllCommentsPanelProps {
    comments: Comment[] | undefined;
    isLoading: boolean;
    currentUserId: string | undefined;
    onSelectAnchor: (anchor: CoordAnchorV2) => void;
    activeAnchor: CoordAnchorV2 | null;
    projectId: number;
    fileId: number;
}

function AllCommentsPanel({
    comments,
    isLoading,
    currentUserId,
    onSelectAnchor,
    activeAnchor,
    projectId,
    fileId,
}: AllCommentsPanelProps) {
    const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

    const invalidate = () =>
        queryClient.invalidateQueries({
            queryKey: commentKeys.all(projectId, fileId),
        });

    const deleteCommentMutation = useMutation({
        mutationFn: (id: number) => deleteComment(id),
        onSuccess: invalidate,
        onError: (err) => toast.error(err.message),
    });

    const sorted = [...(comments ?? [])].sort((a, b) => {
        const da = new Date(a.createdAt).getTime();
        const db = new Date(b.createdAt).getTime();
        return sortOrder === "newest" ? db - da : da - db;
    });

    return (
        <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b bg-muted/20">
                <div className="flex items-center gap-2">
                    <ListIcon className="size-3.5 text-primary shrink-0" />
                    <span className="text-xs font-semibold">All Comments</span>
                    {comments && comments.length > 0 && (
                        <span className="rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-bold leading-none">
                            {comments.length}
                        </span>
                    )}
                </div>
                <button
                    onClick={() =>
                        setSortOrder((s) =>
                            s === "newest" ? "oldest" : "newest",
                        )
                    }
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors rounded px-1.5 py-0.5 hover:bg-muted">
                    <FilterIcon className="size-3" />
                    {sortOrder === "newest" ? "Newest" : "Oldest"}
                </button>
            </div>

            {/* Comment list */}
            <div className="flex-1 overflow-y-auto scroll-smooth">
                {isLoading ? (
                    <div className="p-3 space-y-2">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex gap-2 p-2">
                                <Skeleton className="size-6 rounded-full shrink-0" />
                                <div className="flex-1 space-y-1.5">
                                    <Skeleton className="h-2.5 w-20" />
                                    <Skeleton className="h-6" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : sorted.length === 0 ? (
                    <div className="py-10 text-center px-4">
                        <MessageSquareIcon className="size-10 mx-auto mb-3 text-muted-foreground/30" />
                        <p className="text-sm font-medium text-muted-foreground">
                            No comments yet
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                            Switch to Comment mode and click anywhere to add one
                        </p>
                    </div>
                ) : (
                    <div className="p-2 space-y-1">
                        {sorted.map((comment) => {
                            const anchor = isCoordAnchorV2(comment.anchorJson)
                                ? comment.anchorJson
                                : null;
                            const isActive =
                                anchor &&
                                activeAnchor &&
                                Math.abs(anchor.x - activeAnchor.x) < 0.001 &&
                                Math.abs(anchor.y - activeAnchor.y) < 0.001;

                            return (
                                <button
                                    key={comment.id}
                                    onClick={() =>
                                        anchor && onSelectAnchor(anchor)
                                    }
                                    className={cn(
                                        "w-full text-left rounded-lg px-2.5 py-2.5 transition-all duration-100",
                                        "hover:bg-muted/60 group",
                                        isActive
                                            ? "bg-primary/8 border border-primary/20"
                                            : "border border-transparent",
                                    )}>
                                    <div className="flex items-start gap-2">
                                        <UserAvatar
                                            author={comment.author}
                                            size="sm"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline justify-between gap-1 mb-0.5">
                                                <span className="text-xs font-semibold truncate">
                                                    {comment.author.name}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-0.5">
                                                    <Clock className="size-2.5" />
                                                    {formatRelativeTime(
                                                        comment.createdAt,
                                                    )}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                                {comment.content}
                                            </p>
                                            {comment.replies.length > 0 && (
                                                <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                                                    <MessageSquareIcon className="size-2.5" />
                                                    {comment.replies.length}{" "}
                                                    {comment.replies.length ===
                                                    1
                                                        ? "reply"
                                                        : "replies"}
                                                </div>
                                            )}
                                        </div>
                                        {currentUserId === comment.authorId && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteCommentMutation.mutate(
                                                        comment.id,
                                                    );
                                                }}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground shrink-0">
                                                <Trash2Icon className="size-3" />
                                            </button>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

interface CommentOverlayProps {
    projectId: number;
    fileId: number;
    htmlContent: string;
}

export function CommentOverlay({
    projectId,
    fileId,
    htmlContent,
}: CommentOverlayProps) {
    const [mode, setMode] = useState<ViewerMode>("browse");
    const [activeAnchor, setActiveAnchor] = useState<CoordAnchorV2 | null>(
        null,
    );
    const [pendingAnchor, setPendingAnchor] = useState<CoordAnchorV2 | null>(
        null,
    );
    const [iframeReady, setIframeReady] = useState(false);
    const [sidebarTab, setSidebarTab] = useState<SidebarTab>("thread");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    // Content size reported by the iframe — used to size the pin overlay
    const [iframeSize, setIframeSize] = useState<{
        w: number;
        h: number;
    } | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const { data: session } = authClient.useSession();
    const currentUserId = session?.user?.id;

    const srcDoc = injectScript(htmlContent);

    const { data: allComments, isLoading } = useQuery(
        commentsQueryOptions(projectId, fileId),
    );

    // Deduplicate pins: one pin per unique anchor position
    const pins = (() => {
        if (!allComments) return [];
        const seen = new Set<string>();
        const result: { anchor: CoordAnchorV2; comments: Comment[] }[] = [];
        for (const c of allComments) {
            if (!isCoordAnchorV2(c.anchorJson)) continue;
            const key = `${c.anchorJson.x.toFixed(4)},${c.anchorJson.y.toFixed(4)}`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push({
                    anchor: c.anchorJson,
                    comments: allComments.filter((cc) =>
                        anchorsMatch(cc, c.anchorJson as CoordAnchorV2),
                    ),
                });
            }
        }
        return result;
    })();

    // Listen for messages from iframe
    useEffect(() => {
        const handler = (e: MessageEvent) => {
            if (!e.data || typeof e.data !== "object") return;
            if (
                e.data.type === "PLACE_COMMENT" &&
                isCoordAnchorV2(e.data.anchor)
            ) {
                const anchor = e.data.anchor as CoordAnchorV2;
                setPendingAnchor(anchor);
                setActiveAnchor(anchor);
                setSidebarTab("thread");
                setSidebarOpen(true);
            }
            if (e.data.type === "IFRAME_SIZE") {
                const { sw, sh } = e.data;
                if (
                    typeof sw === "number" &&
                    typeof sh === "number" &&
                    sw > 0 &&
                    sh > 0
                ) {
                    setIframeSize({ w: sw, h: sh });
                }
            }
        };
        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
    }, []);

    // Send mode changes to iframe
    useEffect(() => {
        if (!iframeReady || !iframeRef.current?.contentWindow) return;
        iframeRef.current.contentWindow.postMessage(
            { type: "SET_MODE", mode },
            "*",
        );
        if (mode === "comment") {
            setActiveAnchor(null);
            setPendingAnchor(null);
            setSidebarOpen(false);
        }
    }, [mode, iframeReady]);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (activeAnchor) {
                    setActiveAnchor(null);
                    setPendingAnchor(null);
                    setSidebarOpen(false);
                } else if (mode === "comment") {
                    setMode("browse");
                }
            }
            if (
                e.key === "c" &&
                !e.metaKey &&
                !e.ctrlKey &&
                (e.target as HTMLElement)?.tagName !== "INPUT" &&
                (e.target as HTMLElement)?.tagName !== "TEXTAREA"
            ) {
                setMode((m) => (m === "comment" ? "browse" : "comment"));
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [activeAnchor, mode]);

    const handleIframeLoad = () => {
        setIframeReady(true);
        setTimeout(() => {
            iframeRef.current?.contentWindow?.postMessage(
                { type: "GET_SIZE" },
                "*",
            );
        }, 100);
    };

    const handlePanelClose = () => {
        setActiveAnchor(null);
        setPendingAnchor(null);
        setSidebarOpen(false);
    };

    const handleCommentCreated = () => {
        setPendingAnchor(null);
    };

    const handlePinClick = (anchor: CoordAnchorV2) => {
        setActiveAnchor(anchor);
        setPendingAnchor(null);
        setMode("browse");
        setSidebarTab("thread");
        setSidebarOpen(true);
    };

    const showSidebar = sidebarOpen && (activeAnchor || sidebarTab === "all");

    return (
        <div className="flex h-full min-h-0 flex-col bg-muted/10">
            {/* Toolbar */}
            <div className="flex shrink-0 items-center gap-1.5 border-b bg-background/95 backdrop-blur-sm px-3 py-1.5">
                {/* Mode buttons */}
                <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-lg">
                    <Button
                        type="button"
                        size="sm"
                        variant={mode === "browse" ? "default" : "ghost"}
                        className={cn(
                            "h-7 gap-1.5 text-xs",
                            mode !== "browse" && "text-muted-foreground",
                        )}
                        onClick={() => setMode("browse")}>
                        <MousePointer2Icon className="size-3.5" />
                        Browse
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant={mode === "comment" ? "default" : "ghost"}
                        className={cn(
                            "h-7 gap-1.5 text-xs",
                            mode !== "comment" && "text-muted-foreground",
                        )}
                        onClick={() => setMode("comment")}>
                        <MessageSquareIcon className="size-3.5" />
                        Comment
                        {mode !== "comment" && (
                            <kbd className="ml-0.5 hidden sm:inline-flex h-4 items-center rounded border border-border bg-background/60 px-1 text-[10px] text-muted-foreground font-mono">
                                C
                            </kbd>
                        )}
                    </Button>
                </div>

                {/* Status text */}
                {mode === "comment" && (
                    <span className="text-xs text-muted-foreground animate-in fade-in duration-200">
                        Click anywhere on the canvas to leave a comment
                    </span>
                )}

                {/* Right side - all comments toggle */}
                <div className="ml-auto flex items-center gap-1.5">
                    {allComments && allComments.length > 0 && (
                        <span className="text-xs text-muted-foreground hidden sm:block">
                            {allComments.length} comment
                            {allComments.length !== 1 ? "s" : ""}
                        </span>
                    )}
                    <Button
                        type="button"
                        size="sm"
                        variant={
                            sidebarTab === "all" && sidebarOpen
                                ? "default"
                                : "ghost"
                        }
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => {
                            if (sidebarTab === "all" && sidebarOpen) {
                                setSidebarOpen(false);
                            } else {
                                setSidebarTab("all");
                                setSidebarOpen(true);
                                setActiveAnchor(null);
                            }
                        }}>
                        <ListIcon className="size-3.5" />
                        <span className="hidden sm:inline">All</span>
                    </Button>
                </div>
            </div>

            <div className="flex min-h-0 flex-1">
                {/* Scrollable canvas area */}
                <div
                    className={cn(
                        "relative min-w-0 flex-1 overflow-auto",
                        mode === "comment" &&
                            "ring-2 ring-inset ring-primary/20",
                    )}>
                    {/*
                     * Inner wrapper sized to the iframe's content dimensions.
                     * The iframe is set to that same size so it doesn't scroll internally.
                     * The pin overlay sits on top at 100%×100% of this wrapper.
                     * Pins use left/top as CSS percentages → they resize correctly.
                     */}
                    <div
                        style={{
                            width: iframeSize ? iframeSize.w : "100%",
                            height: iframeSize ? iframeSize.h : "100%",
                            minWidth: "100%",
                            minHeight: "100%",
                            position: "relative",
                        }}>
                        <iframe
                            ref={iframeRef}
                            srcDoc={srcDoc}
                            sandbox="allow-scripts allow-same-origin"
                            style={{
                                width: "100%",
                                height: "100%",
                                border: 0,
                                display: "block",
                            }}
                            title="File preview"
                            onLoad={handleIframeLoad}
                        />

                        {/* Pin overlay — same size as iframe, percentage-positioned pins */}
                        <div
                            className="absolute inset-0"
                            style={{ pointerEvents: "none" }}>
                            {pins.map(
                                ({ anchor, comments: pinComments }, i) => {
                                    const isActive =
                                        activeAnchor !== null &&
                                        Math.abs(anchor.x - activeAnchor.x) <
                                            0.001 &&
                                        Math.abs(anchor.y - activeAnchor.y) <
                                            0.001;

                                    return (
                                        <CommentPin
                                            key={`${anchor.x.toFixed(4)}-${anchor.y.toFixed(4)}`}
                                            index={i}
                                            anchor={anchor}
                                            active={isActive}
                                            count={pinComments.length}
                                            onClick={() =>
                                                handlePinClick(anchor)
                                            }
                                        />
                                    );
                                },
                            )}

                            {pendingAnchor && (
                                <PendingPin anchor={pendingAnchor} />
                            )}
                        </div>
                    </div>

                    {/* Comment mode hint — fixed to the scroll viewport */}
                    {mode === "comment" &&
                        pins.length === 0 &&
                        !pendingAnchor && (
                            <div className="sticky bottom-8 left-0 right-0 pointer-events-none flex justify-center">
                                <div className="bg-background/90 backdrop-blur-sm border border-border rounded-full px-4 py-2 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <MessageSquareIcon className="size-3.5 text-primary" />
                                        Click anywhere to place a comment
                                        <kbd className="ml-1 h-4 inline-flex items-center rounded border border-border bg-muted px-1 text-[10px] font-mono">
                                            Esc
                                        </kbd>
                                        to cancel
                                    </p>
                                </div>
                            </div>
                        )}
                </div>

                {/* Side panel */}
                {showSidebar && (
                    <div
                        className={cn(
                            "flex w-72 shrink-0 flex-col border-l bg-background",
                            "animate-in slide-in-from-right-4 duration-200",
                        )}>
                        {/* Tab switcher (when there's an active anchor AND all tab is accessible) */}
                        {activeAnchor && sidebarTab === "thread" && (
                            <div className="flex shrink-0 border-b">
                                <button
                                    onClick={() => setSidebarTab("thread")}
                                    className={cn(
                                        "flex-1 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border-b-2",
                                        sidebarTab === "thread"
                                            ? "border-primary text-primary"
                                            : "border-transparent text-muted-foreground hover:text-foreground",
                                    )}>
                                    <MessageSquareIcon className="size-3" />
                                    Thread
                                </button>
                                <button
                                    onClick={() => {
                                        setSidebarTab("all");
                                        setActiveAnchor(null);
                                    }}
                                    className={cn(
                                        "flex-1 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border-b-2",
                                        false
                                            ? "border-primary text-primary"
                                            : "border-transparent text-muted-foreground hover:text-foreground",
                                    )}>
                                    <ListIcon className="size-3" />
                                    All
                                </button>
                            </div>
                        )}

                        {sidebarTab === "thread" && activeAnchor ? (
                            <ThreadPanel
                                projectId={projectId}
                                fileId={fileId}
                                anchor={activeAnchor}
                                currentUserId={currentUserId}
                                onClose={handlePanelClose}
                                onCommentCreated={handleCommentCreated}
                                allComments={allComments}
                                isLoading={isLoading}
                            />
                        ) : (
                            <div className="flex flex-col h-full">
                                <div className="flex items-center justify-between px-3 py-2.5 border-b bg-muted/20">
                                    <div className="flex items-center gap-2">
                                        <ListIcon className="size-3.5 text-primary shrink-0" />
                                        <span className="text-xs font-semibold">
                                            All Comments
                                        </span>
                                        {allComments &&
                                            allComments.length > 0 && (
                                                <span className="rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-bold leading-none">
                                                    {allComments.length}
                                                </span>
                                            )}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() => setSidebarOpen(false)}
                                        className="size-6 text-muted-foreground hover:text-foreground">
                                        <XIcon className="size-3" />
                                    </Button>
                                </div>
                                <AllCommentsPanel
                                    comments={allComments}
                                    isLoading={isLoading}
                                    currentUserId={currentUserId}
                                    onSelectAnchor={(anchor) => {
                                        setActiveAnchor(anchor);
                                        setSidebarTab("thread");
                                    }}
                                    activeAnchor={activeAnchor}
                                    projectId={projectId}
                                    fileId={fileId}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
