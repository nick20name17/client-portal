
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { flushSync } from "react-dom";
import { ArrowLeft, Expand, MessageCircle, MessageSquarePlus, Minimize } from "lucide-react";
import { parseAsInteger, useQueryState } from "nuqs";
import { toast } from "sonner";

import { CommentPin, GhostPin } from "@/components/viewer/CommentPin";
import { CommentsSidebar } from "@/components/viewer/CommentsSidebar";
import { HtmlFrame } from "@/components/viewer/HtmlFrame";
import { InlineThreadPopover } from "@/components/viewer/InlineThreadPopover";
import { NewCommentComposePopover } from "@/components/viewer/NewCommentComposePopover";
import { VersionSelector } from "@/components/viewer/VersionSelector";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useCreateComment,
  useDeleteComment,
  usePatchComment,
  useAddCommentTag,
  useComments,
} from "@/api/comments/query";
import { useFileVersions, useCheckNewVersions, FILE_VERSION_KEYS } from "@/api/file-versions/query";
import { useProjectFiles, useProject, useProjectMembers } from "@/api/projects/query";
import { useProjectWS } from "@/api/ws/use-project-ws";
import { useTags } from "@/api/tags/query";
import { apiText } from "@/lib/api";
import { measureAnchorsInIframe, resolveAnchorInDocument } from "@/lib/iframe-anchor-positions";
import type { Anchor, Comment } from "@/types";

const emptyAnchor = (): Anchor => ({
  dataComment: null,
  selector: "",
  textContent: null,
  tagName: "DIV",
  xpath: "",
});

function flattenCommentAnchorsForResolution(comments: Comment[] | undefined): { id: string; anchor: Anchor }[] {
  if (!comments?.length) return [];
  const out: { id: string; anchor: Anchor }[] = [];
  for (const c of comments) {
    const a = c.anchor as Anchor;
    if (a && (a.selector || a.dataComment)) out.push({ id: String(c.id), anchor: a });
    for (const r of c.replies ?? []) {
      const ra = r.anchor as Anchor;
      if (ra && (ra.selector || ra.dataComment)) out.push({ id: String(r.id), anchor: ra });
    }
  }
  return out;
}

interface PinPosition {
  commentId: number;
  x: number;
  y: number;
  orphaned: boolean;
}

export function ProjectViewer({ projectId }: { projectId: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const viewerRootRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  // Cast to our app User type — better-auth user has compatible fields for display purposes
  const user = authUser as import("@/types").User | null;
  const { data: project } = useProject(projectId);
  const { data: files, isPending: filesLoading } = useProjectFiles(projectId);
  const { data: projectMembersData } = useProjectMembers(project?.id);
  const mentionMembers = (projectMembersData ?? []).map((m) => ({
    id: m.userId,
    name: m.user.name,
    image: m.user.image,
  }));
  const { data: tagList } = useTags();
  const tagOptions = tagList ?? [];
  const createComment = useCreateComment(projectId, user);
  const patchComment = usePatchComment(projectId);
  const deleteComment = useDeleteComment(projectId);
  const addTag = useAddCommentTag(projectId);

  const [fileId, setFileId] = useQueryState("file");
  const [commentParam, setCommentParam] = useQueryState("comment", parseAsInteger);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [htmlLoading, setHtmlLoading] = useState(false);
  const [htmlError, setHtmlError] = useState<string | null>(null);

  // Raw iframe-viewport coords from bridge — converted to overlay coords at render time
  const [pinPositions, setPinPositions] = useState<
    Record<string, { cx: number; cy: number; scrollWidth: number; scrollHeight: number }>
  >({});
  // Raw ghost coords (set at message time, converted at render time)
  const [ghostRaw, setGhostRaw] = useState<{
    cx: number; cy: number; scrollWidth: number; scrollHeight: number; anchor: Anchor;
  } | null>(null);
  const ghostRawRef = useRef(ghostRaw);
  useEffect(() => {
    ghostRawRef.current = ghostRaw;
  }, [ghostRaw]);
  // Iframe rect version counter — incremented by ResizeObserver to force re-render when iframe moves
  const [iframeVersion, setIframeVersion] = useState(0);

  // Active thread popover
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  // Keeps last known pin/comment so Radix can animate out before unmounting
  const lastPopoverStateRef = useRef<{
    threadId: number;
    pin: PinPosition;
    comment: Comment;
    relatedComments: Comment[];
  } | null>(null);

  // Track whether the initial ?comment= URL param has been consumed (thread opened from it).
  // Declared here so the sync effect below can reference it.
  const consumedUrlCommentRef = useRef(false);

  // Sync activeThreadId → ?comment= param (skip temp IDs < 0).
  // Only clear the param once the URL comment has been consumed — avoids wiping it on initial load
  // before the auto-open effect has a chance to run.
  useEffect(() => {
    if (activeThreadId === null || activeThreadId < 0) {
      if (consumedUrlCommentRef.current) void setCommentParam(null);
    } else {
      void setCommentParam(activeThreadId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  // Pending anchor waiting for position resolution — stored in a ref to avoid stale closure race
  const pendingGhostAnchorRef = useRef<Anchor | null>(null);
  const pendingMatchRequestIdRef = useRef<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [mobileSheet, setMobileSheet] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [anchorResolvedMap, setAnchorResolvedMap] = useState<Record<string, boolean>>({});
  // True between PAGE_NAV and PAGE_CHANGE — suppresses scroll-triggered re-requests that
  // would re-add stale pins from the old DOM after navigation clears them.
  const isSpaNavigatingRef = useRef(false);

  useProjectWS(projectId);

  // Auto-check for new file versions every 5 min
  const [forceOpenVersionSelector, setForceOpenVersionSelector] = useState(false);
  const { data: newVersionsData } = useCheckNewVersions(projectId);
  const shownNewVersionsRef = useRef<string | null>(null);

  useEffect(() => {
    if (!newVersionsData?.length) return;
    const key = newVersionsData.map((e) => `${e.fileId}:${e.newCount}`).sort().join(",");
    if (shownNewVersionsRef.current === key) return;
    shownNewVersionsRef.current = key;

    // Invalidate cached version lists for files that have new versions
    for (const entry of newVersionsData) {
      void queryClient.invalidateQueries({
        queryKey: FILE_VERSION_KEYS.all(projectId, String(entry.fileId)),
      });
    }

    for (const entry of newVersionsData) {
      const fileName = entry.filePath.split("/").pop() ?? entry.filePath;
      toast(
        `New version available for ${fileName}`,
        {
          description: `${entry.newCount} new commit${entry.newCount > 1 ? "s" : ""} found`,
          duration: Infinity,
          action: {
            label: "Change version",
            onClick: () => {
              void setFileId(String(entry.fileId));
              setForceOpenVersionSelector(true);
            },
          },
          cancel: {
            label: "Dismiss",
            onClick: () => {},
          },
        },
      );
    }
  }, [newVersionsData, setFileId, queryClient, projectId]);

  useEffect(() => {
    if (htmlLoading) { setAnchorResolvedMap({}); setPinPositions({}); }
  }, [htmlLoading]);

  useEffect(() => {
    if (!files?.length) return;
    void setFileId((prev) => {
      if (prev && files.some((f) => String(f.id) === prev)) return prev;
      return files[0] ? String(files[0].id) : null;
    });
  }, [files, setFileId]);

  useEffect(() => {
    if (!projectId || !fileId) {
      setHtml(null);
      return;
    }
    let cancelled = false;
    setHtmlLoading(true);
    setHtmlError(null);
    const suffix = selectedVersionId ? `?versionId=${selectedVersionId}` : "";
    void apiText(`/projects/${projectId}/files/${fileId}/html${suffix}`)
      .then((t) => { if (!cancelled) setHtml(t); })
      .catch((e: Error) => { if (!cancelled) setHtmlError(e.message || "Failed to load HTML"); })
      .finally(() => { if (!cancelled) setHtmlLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, fileId, selectedVersionId]);

  const canManageVersions = user?.role === "admin" || user?.role === "manager";
  const { data: fileVersionsList } = useFileVersions(
    projectId,
    fileId ?? undefined,
  );

  // Reset version on file switch, then auto-select latest once list loads
  useEffect(() => {
    setSelectedVersionId(null);
  }, [fileId]);

  useEffect(() => {
    if (!fileVersionsList?.length) return;
    setSelectedVersionId((prev) => {
      if (prev && fileVersionsList.some((v) => v.id === prev)) return prev;
      return fileVersionsList[0]?.id ?? null;
    });
  }, [fileVersionsList]);

  const { data: comments, isPending: commentsLoading } = useComments(projectId, fileId ?? undefined, selectedVersionId);
  const [reLinkCommentId, setReLinkCommentId] = useState<number | null>(null);
  const reLinkCommentIdRef = useRef<number | null>(null);
  useEffect(() => { reLinkCommentIdRef.current = reLinkCommentId; }, [reLinkCommentId]);
  const patchCommentRef = useRef(patchComment);
  useEffect(() => { patchCommentRef.current = patchComment; });
  const pendingContextMenuFractionRef = useRef<{ fX: number; fY: number } | null>(null);
  const contextMenuTriggerRef = useRef<HTMLSpanElement>(null);
  const [isOverIframe, setIsOverIframe] = useState(false);
  const pointerPosRef = useRef<{ x: number; y: number } | null>(null);

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const topLevelComments = useMemo(() => {
    const rows = comments ?? [];
    const top = rows.filter((c) => !c.parentId);
    const byParent = new Map<number, Comment[]>();
    for (const c of rows) {
      if (!c.parentId) continue;
      const list = byParent.get(c.parentId) ?? [];
      list.push(c);
      byParent.set(c.parentId, list);
    }
    return top.map((c) => {
      const nested = c.replies ?? [];
      const flat = byParent.get(c.id) ?? [];
      const merged = [...nested, ...flat.filter((r) => !nested.some((n) => n.id === r.id))];
      return { ...c, replies: merged };
    });
  }, [comments]);

  const commentAnchors = useMemo(() => {
    const rows = topLevelComments;
    const anchors: Anchor[] = [];
    for (const c of rows) {
      anchors.push(c.anchor as Anchor);
      for (const r of c.replies ?? []) anchors.push(r.anchor as Anchor);
    }
    return anchors.filter((a) => a && (a.selector || a.dataComment));
  }, [topLevelComments]);

  const anchorResolutionItems = useMemo(
    () => flattenCommentAnchorsForResolution(topLevelComments),
    [topLevelComments],
  );

  const handleAnchorResolution = useCallback((resolved: Record<string, boolean>) => {
    setAnchorResolvedMap(resolved);
  }, []);

  // Prefer synchronous measurement in the parent (same-origin srcdoc) to avoid postMessage + paint lag on scroll.
  const requestAnchorPositions = useCallback(
    (opts?: { flushSync?: boolean }) => {
      const iframe = iframeRef.current;
      const win = iframe?.contentWindow;
      if (!win || isFullscreen) return;
      const withAnchors = topLevelComments.filter((c) => c.anchor && (c.anchor.selector || c.anchor.dataComment));
      const ghost = ghostRawRef.current;
      if (!withAnchors.length && !ghost) {
        setPinPositions({});
        return;
      }
      const comments = withAnchors.map((c) => ({ id: String(c.id), anchor: c.anchor as Anchor }));
      if (ghost) {
        comments.push({ id: "__ghost__", anchor: ghost.anchor });
      }

      const measured = iframe ? measureAnchorsInIframe(iframe, comments) : null;
      if (measured) {
        const apply = () => {
          setPinPositions(measured.pins);
          if (measured.ghost) {
            setGhostRaw((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                cx: measured.ghost!.cx,
                cy: measured.ghost!.cy,
                scrollWidth: measured.ghost!.scrollWidth,
                scrollHeight: measured.ghost!.scrollHeight,
              };
            });
          }
        };
        if (opts?.flushSync) {
          flushSync(apply);
        } else {
          apply();
        }
        return;
      }

      win.postMessage({
        type: "GET_ANCHOR_POSITIONS",
        requestId: "pins",
        comments,
      }, "*");
    },
    [topLevelComments, isFullscreen],
  );

  // Listen for ANCHOR_POSITIONS response — store raw iframe coords, convert at render time
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (
        e.data?.type === "ANCHOR_POSITIONS" &&
        e.data.requestId === "pins" &&
        e.data.positions &&
        typeof e.data.positions === "object"
      ) {
        const raw = e.data.positions as Record<
          string,
          { left: number; top: number; width: number; height: number; scrollWidth: number; scrollHeight: number }
        >;
        const next: Record<string, { cx: number; cy: number; scrollWidth: number; scrollHeight: number }> = {};
        for (const id of Object.keys(raw)) {
          if (id === "__ghost__") continue;
          const p = raw[id];
          next[id] = {
            cx: p.left + p.width / 2,
            cy: p.top + p.height / 2,
            scrollWidth: p.scrollWidth,
            scrollHeight: p.scrollHeight,
          };
        }
        setPinPositions(next);
        const ghostPos = raw.__ghost__;
        if (ghostPos) {
          setGhostRaw((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              cx: ghostPos.left + ghostPos.width / 2,
              cy: ghostPos.top + ghostPos.height / 2,
              scrollWidth: ghostPos.scrollWidth,
              scrollHeight: ghostPos.scrollHeight,
            };
          });
        }
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Re-request positions when comments change or frame reloads
  const handleFrameReady = useCallback(() => {
    requestAnchorPositions();
  }, [requestAnchorPositions]);

  useEffect(() => {
    if (isFullscreen) {
      setPinPositions({});
      return;
    }
    requestAnchorPositions();
  }, [requestAnchorPositions, isFullscreen]);

  // ResizeObserver on overlay to re-request on resize
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      requestAnchorPositions();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [requestAnchorPositions]);

  // ResizeObserver on iframe — detects sidebar open/close animation moving the iframe.
  // Bumps iframeVersion to force re-render so raw coords get re-mapped with fresh rects.
  useEffect(() => {
    const el = iframeRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setIframeVersion((v) => v + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sidebar open/close can move iframe with transforms without resizing it.
  // Watch its rect briefly after known layout shifts and bump version when it changes.
  useEffect(() => {
    if (isFullscreen) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    let raf = 0;
    let frame = 0;
    let prev = iframe.getBoundingClientRect();
    const maxFrames = 36; // ~600ms at 60fps; enough for sidebar animation
    const step = () => {
      frame += 1;
      const next = iframe.getBoundingClientRect();
      if (
        Math.abs(next.left - prev.left) > 0.25 ||
        Math.abs(next.top - prev.top) > 0.25 ||
        Math.abs(next.width - prev.width) > 0.25 ||
        Math.abs(next.height - prev.height) > 0.25
      ) {
        prev = next;
        setIframeVersion((v) => v + 1);
      }
      if (frame < maxFrames) raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [commentsOpen, isFullscreen]);

  // Re-measure when the iframe document scrolls — sync measure + flushSync keeps pins aligned with content in the same frame.
  // Also observe DOM mutations (SPA navigation may swap content without triggering URL changes).
  useEffect(() => {
    if (isFullscreen) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    const onScrollOrResize = () => {
      if (isSpaNavigatingRef.current || (window as any).__ebmsSpaNav) return;
      requestAnchorPositions({ flushSync: true });
    };

    const attach = () => {
      const doc = iframe.contentDocument;
      const win = iframe.contentWindow;
      if (!doc || !win) return;
      doc.addEventListener("scroll", onScrollOrResize, { passive: true, capture: true });
      win.addEventListener("resize", onScrollOrResize);

      // Watch for DOM mutations that may show/hide anchor elements (SPA page swaps).
      let mutationRaf = 0;
      const observer = new MutationObserver(() => {
        cancelAnimationFrame(mutationRaf);
        mutationRaf = requestAnimationFrame(() => {
          if (isSpaNavigatingRef.current) return;
          requestAnchorPositions({ flushSync: true });
          // Re-resolve anchor existence for sidebar
          if (anchorResolutionItems.length) {
            const resolved: Record<string, boolean> = {};
            for (const item of anchorResolutionItems) {
              resolved[item.id] = !!resolveAnchorInDocument(doc, item.anchor);
            }
            setAnchorResolvedMap(resolved);
          }
        });
      });
      if (doc.body) {
        observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden"] });
      }

      return () => {
        doc.removeEventListener("scroll", onScrollOrResize, { capture: true });
        win.removeEventListener("resize", onScrollOrResize);
        cancelAnimationFrame(mutationRaf);
        observer.disconnect();
      };
    };

    let detach: (() => void) | undefined;
    const onLoad = () => {
      detach?.();
      detach = attach();
    };
    iframe.addEventListener("load", onLoad);
    if (iframe.contentDocument?.readyState === "complete") {
      detach = attach();
    }
    return () => {
      iframe.removeEventListener("load", onLoad);
      detach?.();
    };
  }, [requestAnchorPositions, isFullscreen, html, anchorResolutionItems]);

  // Convert raw iframe-viewport center coords → overlay-relative px at render time.
  // Reads live rects so positions stay correct after any layout shift (sidebar, resize).
  const rawToOverlay = useCallback(
    (cx: number, cy: number, scrollWidth: number, scrollHeight: number): { x: number; y: number } => {
      const overlay = overlayRef.current;
      const iframe = iframeRef.current;
      if (!overlay || !iframe) return { x: cx, y: cy };
      const oRect = overlay.getBoundingClientRect();
      const iRect = iframe.getBoundingClientRect();
      const scaleX = scrollWidth > 0 ? iRect.width / scrollWidth : 1;
      const scaleY = scrollHeight > 0 ? iRect.height / scrollHeight : 1;
      const dx = iRect.left - oRect.left;
      const dy = iRect.top - oRect.top;
      return {
        x: Math.round(cx * scaleX + dx),
        y: Math.round(cy * scaleY + dy),
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [iframeVersion], // re-memoize when iframe moves
  );

  // Ghost pin derived from raw coords — updates whenever iframe moves
  const ghostPin = useMemo(() => {
    if (!ghostRaw) return null;
    const { x, y } = rawToOverlay(ghostRaw.cx, ghostRaw.cy, ghostRaw.scrollWidth, ghostRaw.scrollHeight);
    return { x, y, anchor: ghostRaw.anchor };
  }, [ghostRaw, rawToOverlay]);

  // Compute pin positions — converted fresh each render so sidebar moves are reflected
  const pins: PinPosition[] = useMemo(() => {
    if (!topLevelComments.length) return [];

    const result: PinPosition[] = [];
    let orphanedIndex = 0;

    for (const c of topLevelComments) {
      if (c.resolved) continue;
      const pos = pinPositions[String(c.id)];
      const hasAnchor = c.anchor && (c.anchor.selector || c.anchor.dataComment);
      if (!hasAnchor) continue;

      if (!pos) {
        // Orphaned comments: no pin, sidebar only
        orphanedIndex++;
        continue;
      }

      const { x, y } = rawToOverlay(pos.cx, pos.cy, pos.scrollWidth, pos.scrollHeight);
      result.push({ commentId: c.id, x, y, orphaned: false });
    }
    return result;
  }, [topLevelComments, pinPositions, rawToOverlay]);

  const sendHighlight = useCallback((a: Anchor | null) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    if (a) win.postMessage({ type: "HIGHLIGHT_ELEMENT", anchor: a }, "*");
    else win.postMessage({ type: "CLEAR_HIGHLIGHT" }, "*");
  }, []);

  // Auto-open thread from URL ?comment= on initial load — waits for pins to be ready
  useEffect(() => {
    if (consumedUrlCommentRef.current || !commentParam) return;
    const pin = pins.find((p) => p.commentId === commentParam);
    if (!pin) return;
    consumedUrlCommentRef.current = true;
    setActiveThreadId(commentParam);
  }, [commentParam, pins]);

  // Handle ghost pin position — store raw iframe coords
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === "MATCH_EXISTING_THREAD_RESULT") {
        if (!pendingMatchRequestIdRef.current || e.data.requestId !== pendingMatchRequestIdRef.current) return;
        const anchor = pendingGhostAnchorRef.current;
        if (!anchor) return;
        pendingMatchRequestIdRef.current = null;

        const existingThreadId =
          typeof e.data.commentId === "string" && e.data.commentId.trim() ? e.data.commentId : null;
        if (existingThreadId) {
          pendingGhostAnchorRef.current = null;
          setGhostRaw(null);
          const existing = topLevelComments.find((c) => String(c.id) === existingThreadId);
          if (existing) sendHighlight(existing.anchor as Anchor);
          // Defer to let ContextMenu DismissableLayer finish teardown before opening Popover
          setTimeout(() => {
            setActiveThreadId(Number(existingThreadId));
          }, 150);
          return;
        }

        iframeRef.current?.contentWindow?.postMessage({
          type: "GET_ANCHOR_POSITIONS",
          requestId: "ghost",
          comments: [{ id: "__ghost__", anchor }],
        }, "*");
        return;
      }

      if (
        e.data?.type === "ANCHOR_POSITIONS" &&
        e.data.requestId === "ghost" &&
        e.data.positions?.__ghost__
      ) {
        const anchor = pendingGhostAnchorRef.current;
        if (!anchor) return;
        const pos = e.data.positions.__ghost__ as {
          left: number; top: number; width: number; height: number;
          scrollWidth: number; scrollHeight: number;
        };
        pendingGhostAnchorRef.current = null;
        setGhostRaw({
          cx: pos.left + pos.width / 2,
          cy: pos.top + pos.height / 2,
          scrollWidth: pos.scrollWidth,
          scrollHeight: pos.scrollHeight,
          anchor,
        });
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [topLevelComments, sendHighlight]);


  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    setGhostRaw(null);
    setActiveThreadId(null);
    setCommentsOpen(false);
    setMobileSheet(false);
    sendHighlight(null);
  }, [isFullscreen, sendHighlight]);

  async function onSubmitNewComment(body: string) {
    if (!fileId) { toast.error("Select a file first"); return; }
    if (!selectedVersionId) { toast.error("No version selected"); return; }
    const tempId = -Date.now();
    const anchor = ghostRaw?.anchor ?? emptyAnchor();
    const tagsToAdd = selectedTagIds;
    const optimisticTags = (tagList ?? []).filter((t) => tagsToAdd.includes(t.id));
    setGhostRaw(null);
    setSelectedTagIds([]);
    setActiveThreadId(tempId);
    try {
      const row = await createComment.mutateAsync({
        fileId: Number(fileId),
        versionId: selectedVersionId!,
        body,
        anchor,
        parentId: undefined,
        _tempId: tempId,
        _tags: optimisticTags,
      });
      for (const tagId of tagsToAdd) {
        await addTag.mutateAsync({ commentId: row.id, tagId });
      }
      setActiveThreadId((prev) => (prev === tempId ? row.id : prev));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to post");
      setActiveThreadId(null);
    }
  }

  async function onResolve(id: number, resolved: boolean) {
    try {
      await patchComment.mutateAsync({ id, resolved });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function onDelete(id: number) {
    if (activeThreadId === id) setActiveThreadId(null);
    try {
      await deleteComment.mutateAsync(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function onReply(commentId: number, body: string) {
    if (!fileId) return;
    const parent = topLevelComments.find((c) => c.id === commentId);
    const versionId = selectedVersionId;
    if (!versionId) return;
    try {
      await createComment.mutateAsync({
        fileId: Number(fileId),
        versionId,
        body,
        anchor: parent?.anchor ?? emptyAnchor(),
        parentId: commentId,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reply");
    }
  }

  async function onNewCommentFromThread(sourceCommentId: number, body: string) {
    if (!fileId) return;
    const source = topLevelComments.find((c) => c.id === sourceCommentId);
    const versionId = selectedVersionId;
    if (!versionId) return;
    try {
      await createComment.mutateAsync({
        fileId: Number(fileId),
        versionId,
        body,
        anchor: source?.anchor ?? emptyAnchor(),
        parentId: undefined,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to post");
    }
  }

  function onSelectThread(commentId: number) {
    setGhostRaw(null);
    pendingGhostAnchorRef.current = null;
    setActiveThreadId((prev) => (prev === commentId ? null : commentId));
    const c = topLevelComments.find((x) => x.id === commentId);
    if (c) sendHighlight(c.anchor as Anchor);
    if (isMobile) setMobileSheet(true);
    else setCommentsOpen(true);
  }

  function onReLink(id: number) {
    setReLinkCommentId(id);
  }

  async function onUnlink(id: number) {
    try {
      await patchComment.mutateAsync({ id, anchor: null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  // Track pointer position + iframe hover highlight during re-link drag
  useEffect(() => {
    if (!reLinkCommentId) {
      pointerPosRef.current = null;
      return;
    }
    function onMove(e: PointerEvent) {
      pointerPosRef.current = { x: e.clientX, y: e.clientY };
      const iframe = iframeRef.current;
      if (!iframe) return;
      const rect = iframe.getBoundingClientRect();
      const over = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      setIsOverIframe(over);
      if (over) {
        iframe.contentWindow?.postMessage({
          type: "HIGHLIGHT_AT_POINT",
          fractionX: (e.clientX - rect.left) / rect.width,
          fractionY: (e.clientY - rect.top) / rect.height,
        }, "*");
      } else {
        iframe.contentWindow?.postMessage({ type: "CLEAR_HIGHLIGHT" }, "*");
      }
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reLinkCommentId]);

  // Handle ELEMENT_PICKED_AT from iframe bridge (uses refs to avoid stale closures)
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type !== "ELEMENT_PICKED_AT") return;
      const relinkId = reLinkCommentIdRef.current;
      if (relinkId !== null) {
        reLinkCommentIdRef.current = null;
        setReLinkCommentId(null);
        setIsOverIframe(false);
        iframeRef.current?.contentWindow?.postMessage({ type: "CLEAR_HIGHLIGHT" }, "*");
        if (!e.data.anchor) { toast.error("No element at that position"); return; }
        void patchCommentRef.current.mutateAsync({ id: relinkId, anchor: e.data.anchor as Anchor })
          .catch((err: Error) => toast.error(err.message));
        return;
      }
      if (pendingContextMenuFractionRef.current !== null) {
        pendingContextMenuFractionRef.current = null;
        if (!e.data.anchor) { toast.error("No element at that position"); return; }
        processAnchorSelectedRef.current(e.data.anchor as Anchor);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  function copyShare() {
    void navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied");
  }

  function toggleTag(id: number) {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await viewerRootRef.current?.requestFullscreen();
    } catch {
      toast.error("Fullscreen is not available");
    }
  }

  const processAnchorSelected = useCallback((anchor: Anchor) => {
    setGhostRaw(null);
    pendingGhostAnchorRef.current = anchor;
    const requestId = `match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pendingMatchRequestIdRef.current = requestId;
    const topLevelCommentsWithAnchors = topLevelComments
      .filter((c) => c.anchor && (c.anchor.selector || c.anchor.dataComment))
      .map((c) => ({ id: String(c.id), anchor: c.anchor }));
    const win = iframeRef.current?.contentWindow;
    win?.postMessage({ type: "SET_CURSOR", cursor: "" }, "*");
    win?.postMessage({
      type: "MATCH_EXISTING_THREAD",
      requestId,
      selectedAnchor: anchor,
      comments: topLevelCommentsWithAnchors,
    }, "*");
  }, [topLevelComments]);
  const processAnchorSelectedRef = useRef(processAnchorSelected);
  useEffect(() => { processAnchorSelectedRef.current = processAnchorSelected; });

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type !== "CONTEXT_MENU") return;
      const iframe = iframeRef.current;
      if (!iframe || isFullscreen) return;
      const rect = iframe.getBoundingClientRect();
      const x = rect.left + (e.data.fractionX as number) * rect.width;
      const y = rect.top + (e.data.fractionY as number) * rect.height;
      pendingContextMenuFractionRef.current = {
        fX: e.data.fractionX as number,
        fY: e.data.fractionY as number,
      };
      contextMenuTriggerRef.current?.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true, cancelable: true, view: window,
          clientX: Math.round(x), clientY: Math.round(y),
        })
      );
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [isFullscreen]);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === "PAGE_NAV") {
        isSpaNavigatingRef.current = true;
        flushSync(() => {
          setPinPositions({});
          setAnchorResolvedMap({});
          setActiveThreadId(null);
          setGhostRaw(null);
        });
        return;
      }
      if (e.data?.type === "PAGE_CHANGE") {
        isSpaNavigatingRef.current = false;
        requestAnchorPositions({ flushSync: true });
        // Re-resolve which anchors exist on the new page
        const doc = iframeRef.current?.contentDocument;
        if (doc && anchorResolutionItems.length) {
          const resolved: Record<string, boolean> = {};
          for (const item of anchorResolutionItems) {
            resolved[item.id] = !!resolveAnchorInDocument(doc, item.anchor);
          }
          flushSync(() => setAnchorResolvedMap(resolved));
        }
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [requestAnchorPositions, anchorResolutionItems]);

  async function onSubmitDirectComment(body: string) {
    if (!fileId) { toast.error("Select a file first"); return; }
    if (!selectedVersionId) { toast.error("No version selected"); return; }
    const tempId = -Date.now();
    const tagsToAdd = selectedTagIds;
    const optimisticTags = (tagList ?? []).filter((t) => tagsToAdd.includes(t.id));
    setSelectedTagIds([]);
    setActiveThreadId(tempId);
    try {
      const row = await createComment.mutateAsync({
        fileId: Number(fileId),
        versionId: selectedVersionId,
        body,
        anchor: emptyAnchor(),
        parentId: undefined,
        _tempId: tempId,
        _tags: optimisticTags,
      });
      for (const tagId of tagsToAdd) await addTag.mutateAsync({ commentId: row.id, tagId });
      setActiveThreadId((prev) => (prev === tempId ? row.id : prev));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to post");
      setActiveThreadId(null);
    }
  }

  async function onEditComment(id: number, body: string) {
    try {
      await patchComment.mutateAsync({ id, body });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Edit failed");
    }
  }

  const sidebarProps = {
    comments: topLevelComments,
    currentUser: user,
    members: mentionMembers,
    loading: commentsLoading,
    tagOptions,
    onAddComment: () => {},
    onSubmitDirectComment,
    addCommentDisabled: false,
    onResolve,
    onHover: () => {},
    activeThreadId,
    onSelectThread,
    anchorResolvedMap,
    versions: fileVersionsList,
    onReLink,
    onUnlink,
    onEditComment,
    onDeleteComment: onDelete,
  };

  const showThreadPopover = Boolean(activeThreadId);
  const showComposePopover = Boolean(ghostPin) && !showThreadPopover;

  function onDragStart({ active }: { active: { data: { current?: { commentId?: number } } } }) {
    const commentId = active.data.current?.commentId;
    if (commentId) setReLinkCommentId(commentId);
  }

  function onDragEnd() {
    const pos = pointerPosRef.current;
    const iframe = iframeRef.current;
    iframeRef.current?.contentWindow?.postMessage({ type: "CLEAR_HIGHLIGHT" }, "*");
    setIsOverIframe(false);

    if (pos && iframe) {
      const rect = iframe.getBoundingClientRect();
      if (pos.x >= rect.left && pos.x <= rect.right && pos.y >= rect.top && pos.y <= rect.bottom) {
        iframe.contentWindow?.postMessage({
          type: "PICK_ELEMENT_AT",
          fractionX: (pos.x - rect.left) / rect.width,
          fractionY: (pos.y - rect.top) / rect.height,
        }, "*");
        // reLinkCommentId cleared by ELEMENT_PICKED_AT handler
        return;
      }
    }
    setReLinkCommentId(null);
    pointerPosRef.current = null;
  }

  const draggedComment = reLinkCommentId ? topLevelComments.find((c) => c.id === reLinkCommentId) : null;

  return (
    <DndContext sensors={dndSensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
    <TooltipProvider delayDuration={300}>
      <SidebarProvider
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        style={{ "--sidebar-width": "20rem" } as CSSProperties}
      >
        <SidebarInset className="h-dvh overflow-hidden bg-background">
          {/* Main canvas area — full height, toolbar floats on top */}
          <div
            ref={viewerRootRef}
            className="relative flex min-h-0 flex-1 canvas-grid-soft"
          >
            {/* ── Header bar ── */}
            {!isFullscreen ? (
              <div className="absolute left-0 right-0 top-0 z-40 flex flex-col border-b border-border/60 bg-background/80 backdrop-blur-xl">
                {/* Row 1: back + breadcrumb + actions */}
                <div className="flex items-center gap-1.5 px-3 py-1.5">
                  {/* Back */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground hover:text-foreground" asChild>
                        <Link to="/" aria-label="Back to projects">
                          <ArrowLeft className="size-3.5" />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Back to projects</TooltipContent>
                  </Tooltip>

                  <div className="mx-0.5 h-4 w-px bg-border/60" />

                  {/* Breadcrumb + version */}
                  <div className="flex min-w-0 items-center gap-1 text-[13px]">
                    <span className="truncate text-muted-foreground">{project?.name ?? "Project"}</span>
                    {files?.find((f) => String(f.id) === fileId) ? (
                      <>
                        <span className="text-muted-foreground/30 mx-0.5">/</span>
                        <span className="truncate font-medium text-foreground">
                          {files.find((f) => String(f.id) === fileId)?.path.split("/").pop() ?? ""}
                        </span>
                      </>
                    ) : null}
                    {fileId ? (
                      <VersionSelector
                        projectId={projectId}
                        fileId={fileId}
                        selectedVersionId={selectedVersionId}
                        onSelectVersion={setSelectedVersionId}
                        canManage={canManageVersions}
                        forceOpen={forceOpenVersionSelector}
                        onForceOpenHandled={() => setForceOpenVersionSelector(false)}
                      />
                    ) : null}
                  </div>

                  <div className="flex-1" />

                  {/* Actions */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" onClick={() => void toggleFullscreen()}>
                        {isFullscreen ? <Minimize className="size-3.5" /> : <Expand className="size-3.5" />}
                        <span className="sr-only">Toggle fullscreen</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Fullscreen</TooltipContent>
                  </Tooltip>
                  {isMobile ? (
                    <Sheet open={mobileSheet} onOpenChange={setMobileSheet}>
                      <SheetTrigger asChild>
                        <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-foreground lg:hidden">
                          <MessageCircle className="size-4" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="bottom" className="h-[85dvh] p-0">
                        <CommentsSidebar
                          {...sidebarProps}
                          onClose={() => setMobileSheet(false)}
                        />
                      </SheetContent>
                    </Sheet>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hidden size-7 text-muted-foreground hover:text-foreground lg:inline-flex"
                          onClick={() => setCommentsOpen((prev) => !prev)}
                          aria-label="Toggle comments"
                        >
                          <MessageCircle className="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Toggle comments</TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Row 2: file tabs — always shown */}
                <div className="flex items-center gap-1 overflow-x-auto border-t border-border/40 px-3 py-2 scrollbar-none">
                  {(files ?? []).map((f) => {
                    const active = String(f.id) === fileId;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => void setFileId(String(f.id))}
                        className={cn(
                          "shrink-0 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
                          active
                            ? "bg-foreground/8 text-foreground"
                            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                        )}
                      >
                        {f.path.split("/").pop() ?? f.path}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Mobile file selector */}
            {files && files.length > 1 ? (
              <div className="absolute left-0 right-0 top-14 z-30 border-b border-border bg-background/90 px-3 py-2 backdrop-blur-sm md:hidden">
                <label htmlFor="viewer-file-select" className="mb-1 block text-xs text-muted-foreground">
                  File
                </label>
                <select
                  id="viewer-file-select"
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  value={fileId ?? ""}
                  onChange={(e) => void setFileId(e.target.value)}
                >
                  {files.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.path}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* Floating sidebar reopen button */}
            {!commentsOpen && !isMobile && !isFullscreen ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setCommentsOpen(true)}
                    className="absolute bottom-4 right-4 z-30 flex items-center gap-1.5 rounded-full border border-border/60 bg-background/90 px-3 py-2 shadow-lg backdrop-blur-sm transition-all hover:bg-background hover:shadow-xl"
                  >
                    <MessageCircle className="size-4 text-muted-foreground" />
                    {topLevelComments.filter((c) => !c.resolved).length > 0 ? (
                      <span className="text-[12px] font-medium text-foreground">
                        {topLevelComments.filter((c) => !c.resolved).length}
                      </span>
                    ) : null}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">Open comments</TooltipContent>
              </Tooltip>
            ) : null}

            <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col pt-24 px-3 pb-3 md:pt-24 md:px-4 md:pb-4">
              {!filesLoading && !files?.length ? (
                <p className="text-sm text-muted-foreground">No HTML files. Run sync from the projects list.</p>
              ) : (
                <div className={cn(
                  "relative flex min-h-0 flex-1 flex-col rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.08),0_8px_32px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04] transition-shadow duration-150",
                  isOverIframe && "ring-2 ring-primary/40 ring-offset-1",
                )}>
                  <HtmlFrame
                    ref={iframeRef}
                    html={html}
                    loading={filesLoading || htmlLoading}
                    error={htmlError}
                    commentAnchors={!isFullscreen ? commentAnchors : []}
                    interactionMode="browsing"
                    anchorResolutionItems={anchorResolutionItems}
                    onAnchorResolution={handleAnchorResolution}
                    onFrameReady={handleFrameReady}
                  />

                  {/* Re-link overlay — captures pointer events so dnd-kit tracks position over iframe */}
                  {reLinkCommentId !== null ? (
                    <div className="absolute inset-0 z-[60]" style={{ pointerEvents: "all", cursor: "copy" }} />
                  ) : null}

                  {/* Pin overlay — sits exactly on top of the iframe artboard */}
                  {!isFullscreen && !htmlLoading && !htmlError && html ? (
                    <div
                      ref={overlayRef}
                      className="pointer-events-none absolute inset-0 overflow-hidden"
                    >
                      {/* Ghost pin for new comment */}
                      {showComposePopover && ghostPin ? (
                        <>
                          <GhostPin x={ghostPin.x} y={ghostPin.y} />
                          <Popover open={showComposePopover}>
                            <PopoverAnchor asChild>
                              <div
                                className="pointer-events-none absolute z-40"
                                style={{ left: ghostPin.x, top: ghostPin.y, width: 1, height: 1 }}
                              />
                            </PopoverAnchor>
                            <PopoverContent
                              side="right"
                              align="start"
                              sideOffset={16}
                              collisionPadding={12}
                              className="w-auto border-0 bg-transparent p-0 shadow-none"
                              onOpenAutoFocus={(e) => e.preventDefault()}
                            >
                              <NewCommentComposePopover
                                currentUser={user}
                                tagOptions={tagOptions}
                                selectedTagIds={selectedTagIds}
                                onToggleTag={toggleTag}
                                onSubmit={onSubmitNewComment}
                                onCancel={() => setGhostRaw(null)}
                                members={mentionMembers}
                              />
                            </PopoverContent>
                          </Popover>
                        </>
                      ) : null}

                      {/* Comment pins */}
                      {pins.map((pin, pinIndex) => {
                        const comment = comments?.find((c) => c.id === pin.commentId);
                        if (!comment) return null;
                        const replyCount = comment.replies?.length ?? 0;

                        return (
                          <CommentPin
                            key={pin.commentId}
                            comment={comment}
                            x={pin.x}
                            y={pin.y}
                            isActive={activeThreadId === pin.commentId}
                            isOrphaned={pin.orphaned}
                            replyCount={replyCount}
                            index={pinIndex}
                            onClick={() => {
                              setGhostRaw(null); // dismiss compose if open
                              pendingGhostAnchorRef.current = null;
                              setActiveThreadId((prev) => (prev === pin.commentId ? null : pin.commentId));
                              sendHighlight(comment.anchor as Anchor);
                            }}
                          />
                        );
                      })}

                      {/* Active thread popover — rendered once, sibling to pins so position is relative to overlay */}
                      {(() => {
                        // Update ref while thread is active so we have data during close animation
                        if (activeThreadId) {
                          const activePin = pins.find((p) => p.commentId === activeThreadId);
                          const activeComment = topLevelComments.find((c) => c.id === activeThreadId);
                          if (activePin && activeComment) {
                            const activeAnchor = activeComment.anchor as Anchor | undefined;
                            const relatedComments = topLevelComments.filter((c) => {
                              if (c.id === activeComment.id) return false;
                              const ca = c.anchor as Anchor | undefined;
                              if (!ca || !activeAnchor) return false;
                              if (activeAnchor.dataComment && ca.dataComment) return activeAnchor.dataComment === ca.dataComment;
                              if (activeAnchor.selector && ca.selector) return activeAnchor.selector === ca.selector;
                              return false;
                            });
                            lastPopoverStateRef.current = { threadId: activeComment.id, pin: activePin, comment: activeComment, relatedComments };
                          }
                        }
                        const display = lastPopoverStateRef.current;
                        if (!display) return null;
                        return (
                          <Popover
                            key={display.threadId}
                            open={showThreadPopover}
                            onOpenChange={(open) => {
                              if (!open) setActiveThreadId(null);
                            }}
                          >
                            <PopoverAnchor asChild>
                              <div
                                className="pointer-events-none absolute z-50"
                                style={{ left: display.pin.x, top: display.pin.y, width: 1, height: 1 }}
                              />
                            </PopoverAnchor>
                            <PopoverContent
                              side="right"
                              align="start"
                              sideOffset={16}
                              collisionPadding={12}
                              className="w-auto border-0 bg-transparent p-0 shadow-none"
                              onOpenAutoFocus={(e) => e.preventDefault()}
                            >
                              <InlineThreadPopover
                                comment={display.comment}
                                relatedComments={display.relatedComments}
                                currentUser={user}
                                canComment={true}
                                members={mentionMembers}
                                onClose={() => setActiveThreadId(null)}
                                onResolve={onResolve}
                                onDelete={onDelete}
                                onReply={onReply}
                                onNewComment={onNewCommentFromThread}
                                onEditMessage={onEditComment}
                                onUnlink={canManageVersions ? onUnlink : undefined}
                                isOrphaned={display.pin.orphaned}
                              />
                            </PopoverContent>
                          </Popover>
                        );
                      })()}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </SidebarInset>

        {/* Right sidebar — desktop only */}
        {!isFullscreen && !isMobile ? (
          <Sidebar side="right" collapsible="offcanvas" className="top-0 border-l border-border">
            <SidebarContent>
              <CommentsSidebar {...sidebarProps} />
            </SidebarContent>
            <SidebarRail />
          </Sidebar>
        ) : null}
      </SidebarProvider>
      <DragOverlay dropAnimation={null}>
        {draggedComment ? (
          <div className="w-56 rounded-xl border border-primary/30 bg-background px-4 py-3 shadow-xl opacity-90">
            <p className="truncate text-[13px] text-foreground">{draggedComment.body}</p>
          </div>
        ) : null}
      </DragOverlay>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <span
            ref={contextMenuTriggerRef}
            className="pointer-events-none fixed"
            style={{ left: 0, top: 0, width: 0, height: 0 }}
            aria-hidden
          />
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onClick={() => {
              const f = pendingContextMenuFractionRef.current;
              if (!f) return;
              iframeRef.current?.contentWindow?.postMessage({
                type: "PICK_ELEMENT_AT",
                fractionX: f.fX,
                fractionY: f.fY,
              }, "*");
            }}
          >
            <MessageSquarePlus className="mr-2 size-4" />
            Add Comment
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </TooltipProvider>
    </DndContext>
  );
}
