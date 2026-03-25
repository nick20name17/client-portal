"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageSquareIcon, MousePointer2Icon, SendIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { createComment, createReply } from "@/api/comments/mutations";
import {
    commentKeys,
    commentsQueryOptions,
    type Comment,
} from "@/api/comments/queries";
import { queryClient } from "@/providers/react-query";

/** Serialized text anchor (v1): quote + prefix/suffix for re-find after DOM changes */
export type TextAnchorV1 = {
    v: 1;
    quote: string;
    prefix: string;
    suffix: string;
};

type ViewerMode = "browse" | "comment";

type ActiveTarget =
    | { kind: "anchor"; anchor: TextAnchorV1 }
    | { kind: "selector"; cssSelector: string };

function anchorsMatch(
    c: Comment,
    target: ActiveTarget | null,
): boolean {
    if (!target) return false;
    if (target.kind === "anchor") {
        if (!c.anchorJson) return false;
        return jsonStableEqual(c.anchorJson, target.anchor as unknown as Record<string, unknown>);
    }
    return c.cssSelector === target.cssSelector;
}

function jsonStableEqual(
    a: Record<string, unknown>,
    b: Record<string, unknown>,
): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

function isTextAnchorV1(x: unknown): x is TextAnchorV1 {
    if (!x || typeof x !== "object") return false;
    const o = x as TextAnchorV1;
    return (
        o.v === 1 &&
        typeof o.quote === "string" &&
        typeof o.prefix === "string" &&
        typeof o.suffix === "string"
    );
}

// Injected into the iframe: mode-aware selection + highlight restore
const IFRAME_SCRIPT = `
(function() {
  var mode = 'browse';

  var style = document.createElement('style');
  style.textContent =
    'mark.__ba-hl[data-ba-hl] { background-color: rgba(99,102,241,0.22); user-select: text; color: inherit; }' +
    '.__ba-has-comments { outline: 2px solid rgba(99,102,241,0.55); outline-offset: 2px; }';
  document.head.appendChild(style);

  function getTextChunks() {
    var chunks = [];
    if (!document.body) return chunks;
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = w.nextNode())) {
      var t = n.textContent || '';
      if (!t.length) continue;
      chunks.push({ node: n, text: t });
    }
    return chunks;
  }

  function fullTextFromChunks(chunks) {
    return chunks.map(function(c) { return c.text; }).join('');
  }

  function globalOffsetForPoint(node, offset) {
    if (!document.body) return -1;
    try {
      var r = document.createRange();
      r.selectNodeContents(document.body);
      r.setEnd(node, offset);
      return r.toString().length;
    } catch (e) {
      return -1;
    }
  }

  function rangeFromGlobalOffsets(start, end, chunks) {
    var total = 0;
    var startNode = null, startOff = 0, endNode = null, endOff = 0;
    for (var i = 0; i < chunks.length; i++) {
      var c = chunks[i];
      var len = c.text.length;
      if (startNode === null && start < total + len) {
        startNode = c.node;
        startOff = start - total;
      }
      if (endNode === null && end <= total + len) {
        endNode = c.node;
        endOff = end - total;
        break;
      }
      total += len;
    }
    if (!startNode || !endNode) return null;
    var r = document.createRange();
    r.setStart(startNode, startOff);
    r.setEnd(endNode, endOff);
    return r;
  }

  function findRangeFromAnchor(anchor) {
    if (!anchor || anchor.v !== 1 || !anchor.quote) return null;
    var chunks = getTextChunks();
    var full = fullTextFromChunks(chunks);
    var needle = (anchor.prefix || '') + anchor.quote + (anchor.suffix || '');
    var idx = full.indexOf(needle);
    if (idx === -1) {
      idx = full.indexOf(anchor.quote);
      if (idx === -1) return null;
      var start = idx;
      var end = start + anchor.quote.length;
      return rangeFromGlobalOffsets(start, end, chunks);
    }
    var start = idx + (anchor.prefix || '').length;
    var end = start + anchor.quote.length;
    return rangeFromGlobalOffsets(start, end, chunks);
  }

  function unwrapMarks() {
    document.querySelectorAll('mark.__ba-hl[data-ba-hl]').forEach(function(m) {
      var p = m.parentNode;
      if (!p) return;
      while (m.firstChild) p.insertBefore(m.firstChild, m);
      p.removeChild(m);
    });
    document.querySelectorAll('.__ba-has-comments').forEach(function(el) {
      el.classList.remove('__ba-has-comments');
    });
  }

  function wrapRange(range) {
    var mark = document.createElement('mark');
    mark.className = '__ba-hl';
    mark.setAttribute('data-ba-hl', '1');
    try {
      range.surroundContents(mark);
    } catch (e) {
      var contents = range.extractContents();
      mark.appendChild(contents);
      range.insertNode(mark);
    }
  }

  window.addEventListener('message', function(e) {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'SET_MODE') {
      mode = e.data.mode === 'comment' ? 'comment' : 'browse';
      return;
    }
    if (e.data.type === 'HIGHLIGHT_COMMENTS') {
      unwrapMarks();
      var list = e.data.comments || [];
      var withAnchor = list.filter(function(c) { return c.anchorJson && c.anchorJson.v === 1; });
      withAnchor.sort(function(a, b) {
        var qa = (a.anchorJson && a.anchorJson.quote) ? String(a.anchorJson.quote).length : 0;
        var qb = (b.anchorJson && b.anchorJson.quote) ? String(b.anchorJson.quote).length : 0;
        return qb - qa;
      });
      withAnchor.forEach(function(c) {
        var r = findRangeFromAnchor(c.anchorJson);
        if (r) wrapRange(r);
      });
      window.__baLegacySelectors = list
        .filter(function(c) { return c.cssSelector; })
        .map(function(c) { return c.cssSelector; });

      list.forEach(function(c) {
        if (c.anchorJson) return;
        if (!c.cssSelector) return;
        try {
          var el = document.querySelector(c.cssSelector);
          if (el) el.classList.add('__ba-has-comments');
        } catch (_) {}
      });
    }
  });

  document.addEventListener('click', function(e) {
    if (mode !== 'browse') return;
    if (e.target && e.target.closest && e.target.closest('a')) return;
    var selectors = window.__baLegacySelectors || [];
    for (var i = 0; i < selectors.length; i++) {
      try {
        var node = document.querySelector(selectors[i]);
        if (!node) continue;
        if (node === e.target || node.contains(e.target)) {
          window.parent.postMessage({
            type: 'LEGACY_ELEMENT_CLICK',
            cssSelector: selectors[i]
          }, '*');
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      } catch (_) {}
    }
  }, true);

  document.addEventListener('mouseup', function() {
    if (mode !== 'comment') return;
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    var range = sel.getRangeAt(0);
    var quote = range.toString();
    if (!quote || !quote.trim()) return;

    var chunks = getTextChunks();
    var full = fullTextFromChunks(chunks);
    var start = globalOffsetForPoint(range.startContainer, range.startOffset);
    var end = globalOffsetForPoint(range.endContainer, range.endOffset);
    if (start < 0 || end < 0 || end <= start) return;

    var prefix = full.slice(Math.max(0, start - 48), start);
    var suffix = full.slice(end, Math.min(full.length, end + 48));

    window.parent.postMessage({
      type: 'TEXT_ANCHOR',
      anchor: { v: 1, quote: quote, prefix: prefix, suffix: suffix }
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

interface CommentPanelProps {
    projectId: number;
    fileId: number;
    target: ActiveTarget;
    onClose: () => void;
}

function CommentPanel({
    projectId,
    fileId,
    target,
    onClose,
}: CommentPanelProps) {
    const [newComment, setNewComment] = useState("");
    const [replyContent, setReplyContent] = useState<Record<number, string>>(
        {},
    );

    const { data: allComments, isLoading } = useQuery(
        commentsQueryOptions(projectId, fileId),
    );

    const comments =
        allComments?.filter((c) => anchorsMatch(c, target)) ?? [];

    const headerLabel =
        target.kind === "anchor"
            ? target.anchor.quote.length > 120
                ? `${target.anchor.quote.slice(0, 117)}…`
                : target.anchor.quote
            : target.cssSelector;

    const addCommentMutation = useMutation({
        mutationFn: () => {
            if (target.kind === "anchor") {
                return createComment(projectId, fileId, {
                    content: newComment,
                    anchorJson: target.anchor as unknown as Record<string, unknown>,
                });
            }
            return createComment(projectId, fileId, {
                content: newComment,
                cssSelector: target.cssSelector,
            });
        },
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
                <div className="flex min-w-0 items-center gap-2">
                    <MessageSquareIcon className="size-4 shrink-0 text-primary" />
                    <span className="truncate text-sm font-medium">
                        Comments
                    </span>
                    {comments.length > 0 && (
                        <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                            {comments.length}
                        </span>
                    )}
                </div>
                <Button variant="ghost" size="icon-sm" onClick={onClose}>
                    <XIcon />
                </Button>
            </div>

            <div className="border-b px-4 py-2">
                <p className="text-xs leading-relaxed text-muted-foreground break-words">
                    {headerLabel}
                </p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
                {isLoading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-16" />
                        <Skeleton className="h-16" />
                    </div>
                ) : comments.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                        No comments here yet
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

interface CommentThreadProps {
    comment: Comment;
    replyContent: string;
    onReplyChange: (val: string) => void;
    onReplySubmit: () => void;
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
    const [activeTarget, setActiveTarget] = useState<ActiveTarget | null>(
        null,
    );
    const [iframeReady, setIframeReady] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const srcDoc = injectScript(htmlContent);

    const { data: allComments } = useQuery(
        commentsQueryOptions(projectId, fileId),
    );

    useEffect(() => {
        const handler = (e: MessageEvent) => {
            if (e.data?.type === "TEXT_ANCHOR" && e.data.anchor) {
                const a = e.data.anchor;
                if (isTextAnchorV1(a)) {
                    setActiveTarget({ kind: "anchor", anchor: a });
                }
            }
            if (
                e.data?.type === "LEGACY_ELEMENT_CLICK" &&
                typeof e.data.cssSelector === "string"
            ) {
                setActiveTarget({
                    kind: "selector",
                    cssSelector: e.data.cssSelector,
                });
            }
        };
        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
    }, []);

    useEffect(() => {
        if (!iframeReady || !iframeRef.current?.contentWindow) return;
        iframeRef.current.contentWindow.postMessage(
            { type: "SET_MODE", mode },
            "*",
        );
    }, [mode, iframeReady]);

    useEffect(() => {
        if (!iframeReady || !iframeRef.current?.contentWindow) return;

        const commentsPayload =
            allComments?.map((c) => ({
                cssSelector: c.cssSelector,
                anchorJson: c.anchorJson ?? undefined,
            })) ?? [];

        iframeRef.current.contentWindow.postMessage(
            { type: "HIGHLIGHT_COMMENTS", comments: commentsPayload },
            "*",
        );
    }, [allComments, iframeReady]);

    const handleIframeLoad = () => setIframeReady(true);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-muted/30 px-3 py-2">
                <Button
                    type="button"
                    size="sm"
                    variant={mode === "browse" ? "default" : "ghost"}
                    className="gap-1.5"
                    onClick={() => setMode("browse")}
                >
                    <MousePointer2Icon className="size-3.5" />
                    Browse
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant={mode === "comment" ? "default" : "ghost"}
                    className="gap-1.5"
                    onClick={() => setMode("comment")}
                >
                    <MessageSquareIcon className="size-3.5" />
                    Comment
                </Button>
                <span className="ml-auto max-w-[min(24rem,55vw)] text-right text-xs text-muted-foreground">
                    {mode === "comment"
                        ? "Select text to leave a comment"
                        : "Select and copy text freely"}
                </span>
            </div>

            <div className="flex min-h-0 flex-1">
                <div className="relative min-w-0 flex-1">
                    <iframe
                        ref={iframeRef}
                        srcDoc={srcDoc}
                        sandbox="allow-scripts allow-same-origin"
                        className="h-full w-full border-0"
                        title="File preview"
                        onLoad={handleIframeLoad}
                    />
                </div>

                {activeTarget && (
                    <div className="flex w-80 shrink-0 flex-col border-l bg-background">
                        <CommentPanel
                            projectId={projectId}
                            fileId={fileId}
                            target={activeTarget}
                            onClose={() => setActiveTarget(null)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
