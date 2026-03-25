"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageSquareIcon, SendIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { createComment, createReply } from "@/api/comments/mutations";
import {
    commentKeys,
    commentsQueryOptions,
    type Comment,
} from "@/api/comments/queries";
import { queryClient } from "@/providers/react-query";

// Injected into the iframe: captures clicks and listens for highlight commands.
const IFRAME_SCRIPT = `
(function() {
  // --- CSS selector builder ---
  function getCssSelector(el) {
    if (!el || el === document.body) return 'body';
    const parts = [];
    let current = el;
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        selector += '#' + current.id;
        parts.unshift(selector);
        break;
      }
      if (current.className) {
        const classes = Array.from(current.classList)
          .filter(c => !c.startsWith('__ba-'))
          .slice(0, 2).join('.');
        if (classes) selector += '.' + classes;
      }
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
        if (siblings.length > 1) {
          selector += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
        }
      }
      parts.unshift(selector);
      current = current.parentElement;
    }
    return parts.join(' > ');
  }

  // --- Click capture ---
  document.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    const selector = getCssSelector(e.target);
    window.parent.postMessage({ type: 'ELEMENT_CLICK', cssSelector: selector }, '*');
  }, true);

  // --- Highlight elements that have comments ---
  const style = document.createElement('style');
  style.textContent = \`
    .__ba-has-comments {
      outline: 2px solid rgba(99,102,241,0.6) !important;
      outline-offset: 2px;
      cursor: pointer;
    }
    .__ba-has-comments:hover {
      outline-color: rgba(99,102,241,1) !important;
    }
    .__ba-badge {
      position: absolute;
      top: -8px;
      right: -8px;
      background: #6366f1;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      line-height: 1;
      padding: 2px 5px;
      border-radius: 999px;
      pointer-events: none;
      z-index: 9999;
    }
    .__ba-wrapper {
      position: relative;
      display: inline-block;
    }
  \`;
  document.head.appendChild(style);

  // Receive highlight commands from parent
  window.addEventListener('message', function(e) {
    if (!e.data || e.data.type !== 'HIGHLIGHT_COMMENTS') return;
    const counts = e.data.counts; // { [cssSelector]: count }

    // Remove old highlights
    document.querySelectorAll('.__ba-has-comments').forEach(function(el) {
      el.classList.remove('__ba-has-comments');
    });
    document.querySelectorAll('.__ba-wrapper').forEach(function(wrapper) {
      const parent = wrapper.parentNode;
      while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
      parent.removeChild(wrapper);
    });

    Object.entries(counts).forEach(function([selector, count]) {
      try {
        const el = document.querySelector(selector);
        if (!el) return;
        el.classList.add('__ba-has-comments');
        // Add badge
        const wrapper = document.createElement('span');
        wrapper.className = '__ba-wrapper';
        el.parentNode.insertBefore(wrapper, el);
        wrapper.appendChild(el);
        const badge = document.createElement('span');
        badge.className = '__ba-badge';
        badge.textContent = String(count);
        wrapper.appendChild(badge);
      } catch (_) {}
    });
  });
})();
`;

function injectScript(html: string): string {
    const scriptTag = `<script>${IFRAME_SCRIPT}<\/script>`;
    if (html.includes("</head>")) {
        return html.replace("</head>", `${scriptTag}</head>`);
    }
    return scriptTag + html;
}

// ─── Comment Panel ────────────────────────────────────────────────────────────

interface CommentPanelProps {
    projectId: number;
    fileId: number;
    cssSelector: string;
    onClose: () => void;
}

function CommentPanel({
    projectId,
    fileId,
    cssSelector,
    onClose,
}: CommentPanelProps) {
    const { data: session } = authClient.useSession();
    const [newComment, setNewComment] = useState("");
    const [replyContent, setReplyContent] = useState<Record<number, string>>(
        {},
    );

    const { data: allComments, isLoading } = useQuery(
        commentsQueryOptions(projectId, fileId),
    );

    const comments =
        allComments?.filter((c) => c.cssSelector === cssSelector) ?? [];

    const addCommentMutation = useMutation({
        mutationFn: () =>
            createComment(projectId, fileId, {
                cssSelector,
                content: newComment,
            }),
        onSuccess: () => {
            toast.success("Comment added");
            setNewComment("");
            queryClient.invalidateQueries({
                queryKey: commentKeys.all(projectId, fileId),
            });
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
            toast.success("Reply added");
            setReplyContent((prev) => ({ ...prev, [commentId]: "" }));
            queryClient.invalidateQueries({
                queryKey: commentKeys.all(projectId, fileId),
            });
        },
        onError: (err) => toast.error(err.message),
    });

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                    <MessageSquareIcon className="size-4 text-primary" />
                    <span className="text-sm font-medium">Comments</span>
                    {comments.length > 0 && (
                        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                            {comments.length}
                        </span>
                    )}
                </div>
                <Button variant="ghost" size="icon-sm" onClick={onClose}>
                    <XIcon />
                </Button>
            </div>

            <div className="border-b px-4 py-2">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {cssSelector}
                </code>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
                {isLoading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-16" />
                        <Skeleton className="h-16" />
                    </div>
                ) : comments.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                        No comments on this element yet
                    </p>
                ) : (
                    comments.map((comment) => (
                        <CommentThread
                            key={comment.id}
                            comment={comment}
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
                            currentUserId={session?.user?.id}
                        />
                    ))
                )}
            </div>

            <Separator />
            <div className="px-4 py-3">
                <div className="flex gap-2">
                    <textarea
                        className="flex-1 resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        rows={2}
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
                        disabled={
                            !newComment.trim() || addCommentMutation.isPending
                        }
                        onClick={() => addCommentMutation.mutate()}
                    >
                        <SendIcon />
                    </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                    ⌘+Enter to submit
                </p>
            </div>
        </div>
    );
}

// ─── Comment Thread ───────────────────────────────────────────────────────────

interface CommentThreadProps {
    comment: Comment;
    replyContent: string;
    onReplyChange: (val: string) => void;
    onReplySubmit: () => void;
    currentUserId?: string;
}

function CommentThread({
    comment,
    replyContent,
    onReplyChange,
    onReplySubmit,
}: CommentThreadProps) {
    return (
        <div className="space-y-2">
            <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                <p className="mb-1 text-xs text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleString()}
                </p>
                <p className="text-sm">{comment.content}</p>
            </div>

            {comment.replies.length > 0 && (
                <div className="ml-4 space-y-2 border-l-2 border-border pl-3">
                    {comment.replies.map((reply) => (
                        <div
                            key={reply.id}
                            className="rounded-lg bg-muted/30 px-3 py-2"
                        >
                            <p className="mb-1 text-xs text-muted-foreground">
                                {new Date(reply.createdAt).toLocaleString()}
                            </p>
                            <p className="text-sm">{reply.content}</p>
                        </div>
                    ))}
                </div>
            )}

            <div className="ml-4 flex gap-2">
                <input
                    className="flex-1 rounded-lg border border-input bg-transparent px-2.5 py-1 text-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none"
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
                    size="icon-sm"
                    variant="ghost"
                    disabled={!replyContent.trim()}
                    onClick={onReplySubmit}
                >
                    <SendIcon />
                </Button>
            </div>
        </div>
    );
}

// ─── Comment Overlay (root) ───────────────────────────────────────────────────

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
    const [activeSelector, setActiveSelector] = useState<string | null>(null);
    const [iframeReady, setIframeReady] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const srcDoc = injectScript(htmlContent);

    // Load all comments to build the highlight map
    const { data: allComments } = useQuery(
        commentsQueryOptions(projectId, fileId),
    );

    // Listen for clicks from the iframe
    useEffect(() => {
        const handler = (e: MessageEvent) => {
            if (e.data?.type === "ELEMENT_CLICK" && e.data.cssSelector) {
                setActiveSelector(e.data.cssSelector);
            }
        };
        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
    }, []);

    // Mark iframe ready on load
    const handleIframeLoad = () => setIframeReady(true);

    // Send highlight map to iframe whenever comments or iframe readiness changes
    useEffect(() => {
        if (!iframeReady || !iframeRef.current?.contentWindow) return;

        const counts: Record<string, number> = {};
        for (const c of allComments ?? []) {
            counts[c.cssSelector] = (counts[c.cssSelector] ?? 0) + 1;
        }

        iframeRef.current.contentWindow.postMessage(
            { type: "HIGHLIGHT_COMMENTS", counts },
            "*",
        );
    }, [allComments, iframeReady]);

    return (
        <div className="flex h-full min-h-0">
            <div className="relative min-w-0 flex-1">
                {!activeSelector && (
                    <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center pb-6">
                        <div className="rounded-full bg-foreground/80 px-4 py-2 text-sm text-background backdrop-blur-sm">
                            Click any element to comment
                        </div>
                    </div>
                )}
                <iframe
                    ref={iframeRef}
                    srcDoc={srcDoc}
                    sandbox="allow-scripts allow-same-origin"
                    className="h-full w-full border-0"
                    title="File preview"
                    onLoad={handleIframeLoad}
                />
            </div>

            {activeSelector && (
                <div className="flex w-80 shrink-0 flex-col border-l bg-background">
                    <CommentPanel
                        projectId={projectId}
                        fileId={fileId}
                        cssSelector={activeSelector}
                        onClose={() => setActiveSelector(null)}
                    />
                </div>
            )}
        </div>
    );
}
