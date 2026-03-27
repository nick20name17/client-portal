"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ArrowLeft, Expand, MessageCircle, Minimize, RefreshCw, Share2 } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";

import { CommentPin, GhostPin } from "@/components/viewer/CommentPin";
import { CommentsSidebar } from "@/components/viewer/CommentsSidebar";
import { HtmlFrame } from "@/components/viewer/HtmlFrame";
import { InlineThreadPopover } from "@/components/viewer/InlineThreadPopover";
import { NewCommentComposePopover } from "@/components/viewer/NewCommentComposePopover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useCreateComment,
  useDeleteComment,
  usePatchComment,
  useAddCommentTag,
  useComments,
} from "@/hooks/use-comments";
import { useProjectFiles, useProject, useSyncProjectFiles } from "@/hooks/use-projects";
import { useProjectSSE } from "@/hooks/use-project-sse";
import { useTags } from "@/hooks/use-tags";
import { apiText } from "@/lib/api";
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
    if (a && (a.selector || a.dataComment)) out.push({ id: c.id, anchor: a });
    for (const r of c.replies ?? []) {
      const ra = r.anchor as Anchor;
      if (ra && (ra.selector || ra.dataComment)) out.push({ id: r.id, anchor: ra });
    }
  }
  return out;
}

interface PinPosition {
  commentId: string;
  x: number;
  y: number;
  orphaned: boolean;
}

export function ProjectViewer({ projectId }: { projectId: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const viewerRootRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const { user: authUser } = useAuth();
  // Cast to our app User type — better-auth user has compatible fields for display purposes
  const user = authUser as import("@/types").User | null;
  const { data: project } = useProject(projectId);
  const { data: files, isPending: filesLoading } = useProjectFiles(projectId);
  const { data: tagList } = useTags();
  const tagOptions = tagList ?? [];
  const sync = useSyncProjectFiles();
  const createComment = useCreateComment(projectId);
  const patchComment = usePatchComment(projectId);
  const deleteComment = useDeleteComment(projectId);
  const addTag = useAddCommentTag(projectId);

  const [fileId, setFileId] = useState<string | null>(null);
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
  // Iframe rect version counter — incremented by ResizeObserver to force re-render when iframe moves
  const [iframeVersion, setIframeVersion] = useState(0);

  // Active thread popover
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // New comment compose state
  const [interactionMode, setInteractionMode] = useQueryState(
    "mode",
    parseAsStringLiteral(["browsing", "commenting"]).withDefault("browsing"),
  );
  const [commentMode, setCommentMode] = useState(false);
  // Pending anchor waiting for position resolution — stored in a ref to avoid stale closure race
  const pendingGhostAnchorRef = useRef<Anchor | null>(null);
  const pendingMatchRequestIdRef = useRef<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [mobileSheet, setMobileSheet] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [anchorResolvedMap, setAnchorResolvedMap] = useState<Record<string, boolean>>({});

  useProjectSSE(projectId);

  useEffect(() => {
    if (htmlLoading) setAnchorResolvedMap({});
  }, [htmlLoading]);

  useEffect(() => {
    if (!files?.length) return;
    setFileId((prev) => {
      if (prev && files.some((f) => f.id === prev)) return prev;
      return files[0]?.id ?? null;
    });
  }, [files]);

  useEffect(() => {
    if (!projectId || !fileId) {
      setHtml(null);
      return;
    }
    let cancelled = false;
    setHtmlLoading(true);
    setHtmlError(null);
    void apiText(`/projects/${projectId}/files/${fileId}/html`)
      .then((t) => { if (!cancelled) setHtml(t); })
      .catch((e: Error) => { if (!cancelled) setHtmlError(e.message || "Failed to load HTML"); })
      .finally(() => { if (!cancelled) setHtmlLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, fileId]);

  const { data: comments, isPending: commentsLoading } = useComments(projectId, fileId ?? undefined);

  const topLevelComments = useMemo(() => {
    const rows = comments ?? [];
    const top = rows.filter((c) => !c.parentId);
    const byParent = new Map<string, Comment[]>();
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

  // Request anchor positions from bridge
  const requestAnchorPositions = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !topLevelComments.length || interactionMode !== "commenting" || isFullscreen) return;
    const withAnchors = topLevelComments.filter((c) => c.anchor && (c.anchor.selector || c.anchor.dataComment));
    if (!withAnchors.length) {
      setPinPositions({});
      return;
    }
    win.postMessage({
      type: "GET_ANCHOR_POSITIONS",
      requestId: "pins",
      comments: withAnchors.map((c) => ({ id: c.id, anchor: c.anchor })),
    }, "*");
  }, [topLevelComments, interactionMode, isFullscreen]);

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
          const p = raw[id];
          next[id] = {
            cx: p.left + p.width / 2,
            cy: p.top + p.height / 2,
            scrollWidth: p.scrollWidth,
            scrollHeight: p.scrollHeight,
          };
        }
        setPinPositions(next);
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
    if (interactionMode !== "commenting" || isFullscreen) {
      setPinPositions({});
      return;
    }
    requestAnchorPositions();
  }, [requestAnchorPositions, interactionMode, isFullscreen]);

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
    if (interactionMode !== "commenting" || isFullscreen) return;
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
  }, [commentsOpen, interactionMode, isFullscreen]);

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
      const pos = pinPositions[c.id];
      const hasAnchor = c.anchor && (c.anchor.selector || c.anchor.dataComment);
      if (!hasAnchor) continue;

      if (!pos) {
        result.push({ commentId: c.id, x: 24 + orphanedIndex * 36, y: 24, orphaned: true });
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

  // Handle messages from iframe
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === "ELEMENT_SELECTED") {
        const anchor = e.data.anchor as Anchor;
        if (interactionMode !== "commenting" || isFullscreen) return;
        setCommentMode(false);
        setGhostRaw(null);
        pendingGhostAnchorRef.current = anchor;
        const requestId = `match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        pendingMatchRequestIdRef.current = requestId;
        const topLevelCommentsWithAnchors = topLevelComments
          .filter((c) => c.anchor && (c.anchor.selector || c.anchor.dataComment))
          .map((c) => ({ id: c.id, anchor: c.anchor }));
        const win = iframeRef.current?.contentWindow;
        win?.postMessage({ type: "SET_CURSOR", cursor: "" }, "*");
        win?.postMessage(
          {
            type: "MATCH_EXISTING_THREAD",
            requestId,
            selectedAnchor: anchor,
            comments: topLevelCommentsWithAnchors,
          },
          "*",
        );
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [interactionMode, isFullscreen, topLevelComments]);

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
          setActiveThreadId(existingThreadId);
          const existing = topLevelComments.find((c) => c.id === existingThreadId);
          if (existing) sendHighlight(existing.anchor as Anchor);
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

  // Enter comment mode: set crosshair cursor in iframe
  function enterCommentMode() {
    if (interactionMode !== "commenting") return;
    setCommentMode(true);
    setGhostRaw(null);
    setActiveThreadId(null);
    iframeRef.current?.contentWindow?.postMessage({ type: "SET_CURSOR", cursor: "crosshair" }, "*");
    if (isMobile) setMobileSheet(true);
  }

  function cancelCommentMode() {
    setCommentMode(false);
    setGhostRaw(null);
    setSelectedTagIds([]);
    pendingGhostAnchorRef.current = null;
    pendingMatchRequestIdRef.current = null;
    iframeRef.current?.contentWindow?.postMessage({ type: "SET_CURSOR", cursor: "" }, "*");
  }

  useEffect(() => {
    if (interactionMode === "browsing") {
      cancelCommentMode();
      setCommentsOpen(false);
      setMobileSheet(false);
      setActiveThreadId(null);
      sendHighlight(null);
    }
  }, [interactionMode, sendHighlight]);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    setCommentMode(false);
    setGhostRaw(null);
    setActiveThreadId(null);
    setCommentsOpen(false);
    setMobileSheet(false);
    sendHighlight(null);
    iframeRef.current?.contentWindow?.postMessage({ type: "SET_CURSOR", cursor: "" }, "*");
  }, [isFullscreen, sendHighlight]);

  async function onSubmitNewComment(body: string) {
    if (!fileId) { toast.error("Select a file first"); return; }
    try {
      const row = (await createComment.mutateAsync({
        fileId,
        body,
        anchor: ghostRaw?.anchor ?? emptyAnchor(),
        parentId: undefined,
      })) as { id: string };
      const id = row.id;
      for (const tagId of selectedTagIds) {
        await addTag.mutateAsync({ commentId: id, tagId });
      }
      toast.success("Comment added");
      setGhostRaw(null);
      setSelectedTagIds([]);
      setActiveThreadId(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to post");
    }
  }

  async function onResolve(id: string, resolved: boolean) {
    try {
      await patchComment.mutateAsync({ id, resolved });
      toast.success(resolved ? "Resolved" : "Reopened");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteComment.mutateAsync(id);
      toast.success("Comment deleted");
      if (activeThreadId === id) setActiveThreadId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function onReply(commentId: string, body: string) {
    if (!fileId) return;
    const parent = topLevelComments.find((c) => c.id === commentId);
    try {
      await createComment.mutateAsync({
        fileId,
        body,
        anchor: parent?.anchor ?? emptyAnchor(),
        parentId: commentId,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reply");
    }
  }

  function onSelectThread(commentId: string) {
    setGhostRaw(null);
    pendingGhostAnchorRef.current = null;
    setCommentMode(false);
    setActiveThreadId((prev) => (prev === commentId ? null : commentId));
    const c = topLevelComments.find((x) => x.id === commentId);
    if (c) sendHighlight(c.anchor as Anchor);
    if (isMobile) setMobileSheet(true);
    else setCommentsOpen(true);
  }

  async function onSync() {
    try {
      const r = await sync.mutateAsync(projectId);
      toast.success(`Synced ${r.synced} file(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    }
  }

  function copyShare() {
    void navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied");
  }

  function toggleTag(id: string) {
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

  const frameInteractionMode: "browsing" | "commenting" =
    interactionMode === "commenting" && !isFullscreen ? "commenting" : "browsing";

  const sidebarProps = {
    comments: topLevelComments,
    currentUser: user,
    loading: commentsLoading,
    tagOptions,
    onAddComment: enterCommentMode,
    addCommentDisabled: interactionMode !== "commenting",
    onResolve,
    onHover: sendHighlight,
    activeThreadId,
    onSelectThread,
    anchorResolvedMap,
  };

  const showThreadPopover = Boolean(activeThreadId);
  const showComposePopover = Boolean(ghostPin) && !showThreadPopover;

  return (
    <TooltipProvider delayDuration={400}>
      <SidebarProvider
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        style={{ "--sidebar-width": "22.5rem" } as CSSProperties}
      >
        <SidebarInset className="h-dvh overflow-hidden bg-background">
          {/* Top bar */}
          <header className="relative flex h-10 shrink-0 items-center border-b border-border bg-background px-3 md:px-4">
            <div className="flex min-w-0 max-w-[min(100%,14rem)] items-center gap-1 sm:max-w-[min(100%,20rem)] md:max-w-[40%]">
              <Button variant="ghost" size="icon" className="size-7 shrink-0" asChild>
                <Link href="/" aria-label="Back">
                  <ArrowLeft className="size-3.5" />
                </Link>
              </Button>
              <div className="min-w-0 flex-1 flex items-center gap-1.5 text-sm">
                <span className="truncate text-muted-foreground font-medium">{project?.name ?? "Project"}</span>
                {files?.find((f) => f.id === fileId) ? (
                  <>
                    <span className="text-muted-foreground/50">/</span>
                    <span className="truncate font-medium text-foreground">
                      {files.find((f) => f.id === fileId)!.path.split("/").pop() ?? ""}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
            {files && files.length > 1 ? (
              <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden max-w-[min(100vw-12rem,28rem)] -translate-x-1/2 -translate-y-1/2 md:block">
                <div className="pointer-events-auto overflow-x-auto">
                  <Tabs value={fileId ?? ""} onValueChange={setFileId}>
                    <TabsList className="h-7 gap-0.5 rounded-md bg-muted/80 p-0.5">
                      {files.map((f) => (
                        <TabsTrigger
                          key={f.id}
                          value={f.id}
                          className="max-w-40 shrink truncate rounded-sm px-2.5 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
                        >
                          {f.path.split("/").pop() ?? f.path}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            ) : null}
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <Tabs
                value={interactionMode}
                onValueChange={(v) => void setInteractionMode(v as "browsing" | "commenting")}
              >
                <TabsList className="h-7 rounded-full bg-muted/70 p-0.5">
                  <TabsTrigger value="browsing" className="rounded-full px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    Browse
                  </TabsTrigger>
                  <TabsTrigger value="commenting" className="rounded-full px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    Comment
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => void onSync()}>
                    <RefreshCw className="size-3.5" />
                    <span className="sr-only">Sync files from repository</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Sync files</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7" onClick={copyShare}>
                    <Share2 className="size-3.5" />
                    <span className="sr-only">Copy link</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Copy share link</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => void toggleFullscreen()}>
                    {isFullscreen ? <Minimize className="size-3.5" /> : <Expand className="size-3.5" />}
                    <span className="sr-only">Toggle fullscreen</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}</TooltipContent>
              </Tooltip>
              {interactionMode === "commenting" && !isFullscreen ? isMobile ? (
                <Sheet open={mobileSheet} onOpenChange={setMobileSheet}>
                  <SheetTrigger asChild>
                    <Button size="icon" variant="outline" className="size-9 shrink-0 lg:hidden">
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
                <SidebarTrigger
                  className="hidden size-9 lg:inline-flex"
                  aria-label="Toggle comments sidebar"
                />
              ) : null}
            </div>
          </header>

          {/* Mobile file selector */}
          {files && files.length > 1 ? (
            <div className="border-b border-border px-3 py-2 md:hidden">
              <label htmlFor="viewer-file-select" className="mb-1 block text-xs text-muted-foreground">
                File
              </label>
              <select
                id="viewer-file-select"
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={fileId ?? ""}
                onChange={(e) => setFileId(e.target.value)}
              >
                {files.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.path}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Comment mode banner */}
          {interactionMode === "commenting" && commentMode ? (
            <div className="flex items-center justify-between border-b border-primary/20 bg-primary/10 px-4 py-1.5">
              <span className="text-xs font-medium text-primary">
                Click anywhere on the page to add a comment
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-primary hover:text-primary"
                onClick={cancelCommentMode}
              >
                Cancel
              </Button>
            </div>
          ) : null}

          {/* Main canvas area */}
          <div ref={viewerRootRef} className="flex min-h-0 flex-1 bg-[#ececec] dark:bg-muted/40">
            <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col p-3 md:p-4">
              {filesLoading ? (
                <p className="text-sm text-muted-foreground">Loading files…</p>
              ) : !files?.length ? (
                <p className="text-sm text-muted-foreground">No HTML files. Run sync from the projects list.</p>
              ) : (
                <div className="relative flex min-h-0 flex-1 flex-col">
                  <HtmlFrame
                    ref={iframeRef}
                    html={html}
                    loading={htmlLoading}
                    error={htmlError}
                    commentAnchors={interactionMode === "commenting" && !isFullscreen ? commentAnchors : []}
                    interactionMode={frameInteractionMode}
                    anchorResolutionItems={anchorResolutionItems}
                    onAnchorResolution={handleAnchorResolution}
                    onFrameReady={handleFrameReady}
                  />

                  {/* Pin overlay — sits exactly on top of the iframe artboard */}
                  {interactionMode === "commenting" && !isFullscreen && !htmlLoading && !htmlError && html ? (
                    <div
                      ref={overlayRef}
                      className="pointer-events-none absolute inset-0"
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
                                onCancel={cancelCommentMode}
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
                        if (!showThreadPopover || !activeThreadId) return null;
                        const activePin = pins.find((p) => p.commentId === activeThreadId);
                        const activeComment = topLevelComments.find((c) => c.id === activeThreadId);
                        if (!activePin || !activeComment) return null;
                        return (
                          <Popover
                            key={activeThreadId}
                            open={showThreadPopover}
                            onOpenChange={(open) => {
                              if (!open) setActiveThreadId(null);
                            }}
                          >
                            <PopoverAnchor asChild>
                              <div
                                className="pointer-events-none absolute z-50"
                                style={{ left: activePin.x, top: activePin.y, width: 1, height: 1 }}
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
                                comment={activeComment}
                                currentUser={user}
                                canComment={interactionMode === "commenting"}
                                onClose={() => setActiveThreadId(null)}
                                onResolve={onResolve}
                                onDelete={onDelete}
                                onReply={onReply}
                                isOrphaned={activePin.orphaned}
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
        {interactionMode === "commenting" && !isFullscreen && !isMobile ? (
          <Sidebar side="right" collapsible="offcanvas" className="top-14 border-l border-border">
            <SidebarContent>
              <CommentsSidebar {...sidebarProps} />
            </SidebarContent>
            <SidebarRail />
          </Sidebar>
        ) : null}
      </SidebarProvider>
    </TooltipProvider>
  );
}
