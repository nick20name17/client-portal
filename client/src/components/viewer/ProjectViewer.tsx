
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
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
import { useProjectFiles, useProject, useProjectMembers, useSyncProjectFiles } from "@/api/projects/query";
import { useProjectWS } from "@/api/ws/use-project-ws";
import { useTags } from "@/api/tags/query";
import { apiText, apiErrorMsg } from "@/lib/api";
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

/* ──────────────────────────── Viewer Reducer ──────────────────────────── */

interface ViewerState {
  html: string | null;
  htmlLoading: boolean;
  htmlError: string | null;
  pinPositions: Record<string, { cx: number; cy: number; scrollWidth: number; scrollHeight: number }>;
  anchorResolvedMap: Record<string, boolean>;
  activeThreadId: number | null;
  ghostRaw: { cx: number; cy: number; scrollWidth: number; scrollHeight: number; anchor: Anchor } | null;
  selectedVersionId: number | null;
  commentsOpen: boolean;
  mobileSheet: boolean;
  forceOpenVersionSelector: boolean;
}

type ViewerAction =
  | { type: "HTML_FETCH_START" }
  | { type: "HTML_FETCH_OK"; html: string }
  | { type: "HTML_FETCH_ERR"; error: string }
  | { type: "CLEAR_HTML" }
  | { type: "SET_PINS"; pins: ViewerState["pinPositions"] }
  | { type: "SET_ANCHOR_RESOLVED"; map: Record<string, boolean> }
  | { type: "SET_ACTIVE_THREAD"; id: number | null }
  | { type: "UPDATE_ACTIVE_THREAD"; updater: (prev: number | null) => number | null }
  | { type: "SET_GHOST"; ghost: ViewerState["ghostRaw"] }
  | { type: "UPDATE_GHOST"; updater: (prev: ViewerState["ghostRaw"]) => ViewerState["ghostRaw"] }
  | { type: "SET_VERSION"; id: number | null }
  | { type: "UPDATE_VERSION"; updater: (prev: number | null) => number | null }
  | { type: "FILE_SWITCH_RESET" }
  | { type: "FULLSCREEN_ENTER" }
  | { type: "SPA_NAV_CLEAR" }
  | { type: "PINS_AND_GHOST"; pins: ViewerState["pinPositions"]; ghost: ViewerState["ghostRaw"] }
  | { type: "SET_COMMENTS_OPEN"; open: boolean }
  | { type: "TOGGLE_COMMENTS_OPEN" }
  | { type: "SET_MOBILE_SHEET"; open: boolean }
  | { type: "SET_FORCE_OPEN_VERSION_SELECTOR"; open: boolean };

const viewerInitial: ViewerState = {
  html: null,
  htmlLoading: false,
  htmlError: null,
  pinPositions: {},
  anchorResolvedMap: {},
  activeThreadId: null,
  ghostRaw: null,
  selectedVersionId: null,
  commentsOpen: true,
  mobileSheet: false,
  forceOpenVersionSelector: false,
};

function viewerReducer(state: ViewerState, action: ViewerAction): ViewerState {
  switch (action.type) {
    case "HTML_FETCH_START":
      return { ...state, htmlLoading: true, htmlError: null, anchorResolvedMap: {}, pinPositions: {} };
    case "HTML_FETCH_OK":
      return { ...state, html: action.html, htmlLoading: false };
    case "HTML_FETCH_ERR":
      return { ...state, htmlError: action.error, htmlLoading: false };
    case "CLEAR_HTML":
      return { ...state, html: null };
    case "SET_PINS":
      return { ...state, pinPositions: action.pins };
    case "SET_ANCHOR_RESOLVED":
      return { ...state, anchorResolvedMap: action.map };
    case "SET_ACTIVE_THREAD":
      return { ...state, activeThreadId: action.id };
    case "UPDATE_ACTIVE_THREAD":
      return { ...state, activeThreadId: action.updater(state.activeThreadId) };
    case "SET_GHOST":
      return { ...state, ghostRaw: action.ghost };
    case "UPDATE_GHOST":
      return { ...state, ghostRaw: action.updater(state.ghostRaw) };
    case "SET_VERSION":
      return { ...state, selectedVersionId: action.id };
    case "UPDATE_VERSION":
      return { ...state, selectedVersionId: action.updater(state.selectedVersionId) };
    case "FILE_SWITCH_RESET":
      return { ...state, selectedVersionId: null, pinPositions: {}, anchorResolvedMap: {}, activeThreadId: null, ghostRaw: null };
    case "FULLSCREEN_ENTER":
      return { ...state, ghostRaw: null, activeThreadId: null, commentsOpen: false, mobileSheet: false };
    case "SPA_NAV_CLEAR":
      return { ...state, pinPositions: {}, anchorResolvedMap: {}, activeThreadId: null, ghostRaw: null };
    case "PINS_AND_GHOST":
      return { ...state, pinPositions: action.pins, ghostRaw: action.ghost };
    case "SET_COMMENTS_OPEN":
      return { ...state, commentsOpen: action.open };
    case "TOGGLE_COMMENTS_OPEN":
      return { ...state, commentsOpen: !state.commentsOpen };
    case "SET_MOBILE_SHEET":
      return { ...state, mobileSheet: action.open };
    case "SET_FORCE_OPEN_VERSION_SELECTOR":
      return { ...state, forceOpenVersionSelector: action.open };
    default:
      return state;
  }
}

/* ──────────────────────────── useViewerComments ──────────────────────────── */

function useViewerComments({
  fileId,
  selectedVersionId,
  topLevelComments,
  ghostRaw,
  activeThreadId,
  dispatch,
  createComment,
  patchComment,
  deleteComment,
  addTag,
  tagList,
  selectedTagIds,
  setSelectedTagIds,
}: {
  fileId: string | null;
  selectedVersionId: number | null;
  topLevelComments: Comment[];
  ghostRaw: ViewerState["ghostRaw"];
  activeThreadId: number | null;
  dispatch: React.Dispatch<ViewerAction>;
  createComment: ReturnType<typeof useCreateComment>;
  patchComment: ReturnType<typeof usePatchComment>;
  deleteComment: ReturnType<typeof useDeleteComment>;
  addTag: ReturnType<typeof useAddCommentTag>;
  tagList: import("@/types").Tag[] | undefined;
  selectedTagIds: number[];
  setSelectedTagIds: React.Dispatch<React.SetStateAction<number[]>>;
}) {
  const onSubmitNewComment = useCallback(async (body: string) => {
    if (!fileId) { toast.error("Select a file first"); return; }
    if (!selectedVersionId) { toast.error("No version selected"); return; }
    const tempId = -Date.now();
    const anchor = ghostRaw?.anchor ?? emptyAnchor();
    const tagsToAdd = selectedTagIds;
    const optimisticTags = (tagList ?? []).filter((t) => tagsToAdd.includes(t.id));
    dispatch({ type: "SET_GHOST", ghost: null });
    setSelectedTagIds([]);
    dispatch({ type: "SET_ACTIVE_THREAD", id: tempId });
    const row = await createComment.mutateAsync({
      fileId: Number(fileId),
      versionId: selectedVersionId!,
      body,
      anchor,
      parentId: undefined,
      _tempId: tempId,
      _tags: optimisticTags,
    }).catch((e: unknown) => {
      toast.error(apiErrorMsg(e, "Failed to post"));
      dispatch({ type: "SET_ACTIVE_THREAD", id: null });
      return null;
    });
    if (!row) return;
    for (const tagId of tagsToAdd) {
      await addTag.mutateAsync({ commentId: row.id, tagId }).catch(() => {});
    }
    dispatch({ type: "UPDATE_ACTIVE_THREAD", updater: (prev) => (prev === tempId ? row.id : prev) });
  }, [fileId, selectedVersionId, ghostRaw, selectedTagIds, tagList, dispatch, createComment, addTag, setSelectedTagIds]);

  const onResolve = useCallback(async (id: number, resolved: boolean) => {
    await patchComment.mutateAsync({ id, resolved })
      .catch((e: unknown) => { toast.error(apiErrorMsg(e, "Update failed")); });
  }, [patchComment]);

  const onDelete = useCallback(async (id: number) => {
    if (activeThreadId === id) dispatch({ type: "SET_ACTIVE_THREAD", id: null });
    await deleteComment.mutateAsync(id)
      .catch((e: unknown) => { toast.error(apiErrorMsg(e, "Delete failed")); });
  }, [activeThreadId, dispatch, deleteComment]);

  const onReply = useCallback(async (commentId: number, body: string) => {
    if (!fileId) return;
    const parent = topLevelComments.find((c) => c.id === commentId);
    const versionId = selectedVersionId;
    if (!versionId) return;
    const anchor = parent?.anchor ?? emptyAnchor();
    await createComment.mutateAsync({
      fileId: Number(fileId),
      versionId,
      body,
      anchor,
      parentId: commentId,
    }).catch((e: unknown) => {
      toast.error(apiErrorMsg(e, "Failed to reply"));
    });
  }, [fileId, selectedVersionId, topLevelComments, createComment]);

  const onNewCommentFromThread = useCallback(async (sourceCommentId: number, body: string) => {
    if (!fileId) return;
    const source = topLevelComments.find((c) => c.id === sourceCommentId);
    const versionId = selectedVersionId;
    if (!versionId) return;
    const anchor = source?.anchor ?? emptyAnchor();
    await createComment.mutateAsync({
      fileId: Number(fileId),
      versionId,
      body,
      anchor,
      parentId: undefined,
    }).catch((e: unknown) => {
      toast.error(apiErrorMsg(e, "Failed to post"));
    });
  }, [fileId, selectedVersionId, topLevelComments, createComment]);

  const onSubmitDirectComment = useCallback(async (body: string) => {
    if (!fileId) { toast.error("Select a file first"); return; }
    if (!selectedVersionId) { toast.error("No version selected"); return; }
    const tempId = -Date.now();
    const tagsToAdd = selectedTagIds;
    const optimisticTags = (tagList ?? []).filter((t) => tagsToAdd.includes(t.id));
    setSelectedTagIds([]);
    dispatch({ type: "SET_ACTIVE_THREAD", id: tempId });
    const row = await createComment.mutateAsync({
      fileId: Number(fileId),
      versionId: selectedVersionId,
      body,
      anchor: emptyAnchor(),
      parentId: undefined,
      _tempId: tempId,
      _tags: optimisticTags,
    }).catch((e: unknown) => {
      toast.error(apiErrorMsg(e, "Failed to post"));
      dispatch({ type: "SET_ACTIVE_THREAD", id: null });
      return null;
    });
    if (!row) return;
    for (const tagId of tagsToAdd) await addTag.mutateAsync({ commentId: row.id, tagId }).catch(() => {});
    dispatch({ type: "UPDATE_ACTIVE_THREAD", updater: (prev) => (prev === tempId ? row.id : prev) });
  }, [fileId, selectedVersionId, selectedTagIds, tagList, dispatch, createComment, addTag, setSelectedTagIds]);

  const onEditComment = useCallback(async (id: number, body: string) => {
    await patchComment.mutateAsync({ id, body })
      .catch((e: unknown) => { toast.error(apiErrorMsg(e, "Edit failed")); });
  }, [patchComment]);

  const onUnlink = useCallback(async (id: number) => {
    dispatch({ type: "SET_ACTIVE_THREAD", id: null });
    await patchComment.mutateAsync({ id, anchor: null })
      .catch((e: unknown) => { toast.error(apiErrorMsg(e, "Failed")); });
  }, [dispatch, patchComment]);

  return { onSubmitNewComment, onResolve, onDelete, onReply, onNewCommentFromThread, onSubmitDirectComment, onEditComment, onUnlink };
}

/* ──────────────────────────── useViewerDnd ──────────────────────────── */

function useViewerDnd({
  iframeRef,
  topLevelComments,
  patchComment,
  processAnchorSelected,
  pendingContextMenuFractionRef,
  contextMenuTriggerRef,
}: {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  topLevelComments: Comment[];
  patchComment: ReturnType<typeof usePatchComment>;
  processAnchorSelected: (anchor: Anchor) => void;
  pendingContextMenuFractionRef: React.MutableRefObject<{ fX: number; fY: number } | null>;
  contextMenuTriggerRef: React.RefObject<HTMLSpanElement | null>;
}) {
  const [reLinkCommentId, setReLinkCommentId] = useState<number | null>(null);
  const reLinkCommentIdRef = useRef<number | null>(null);
  useEffect(() => { reLinkCommentIdRef.current = reLinkCommentId; }, [reLinkCommentId]);
  const patchCommentRef = useRef(patchComment);
  useEffect(() => { patchCommentRef.current = patchComment; }, [patchComment]);
  const [isOverIframe, setIsOverIframe] = useState(false);
  const pointerPosRef = useRef<{ x: number; y: number } | null>(null);
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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
  }, [reLinkCommentId, iframeRef]);

  // Handle ELEMENT_PICKED_AT from iframe bridge
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
        processAnchorSelected(e.data.anchor as Anchor);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [processAnchorSelected, iframeRef]);

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
        return;
      }
    }
    setReLinkCommentId(null);
    pointerPosRef.current = null;
  }

  const onReLink = useCallback((id: number) => {
    setReLinkCommentId(id);
  }, []);

  const draggedComment = reLinkCommentId ? topLevelComments.find((c) => c.id === reLinkCommentId) ?? null : null;

  return {
    reLinkCommentId,
    isOverIframe,
    dndSensors,
    onDragStart,
    onDragEnd,
    onReLink,
    draggedComment,
  };
}

/* ──────────────────────────── useViewerIframe ──────────────────────────── */

function useViewerIframe({
  iframeRef,
  overlayRef,
  topLevelComments,
  pinPositions,
  ghostRaw,
  ghostRawRef,
  isFullscreen,
  commentsOpen,
  anchorResolutionItems,
  isSpaNavigatingRef,
  spaNavTimeoutRef,
  dispatch,
}: {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  overlayRef: React.RefObject<HTMLDivElement | null>;
  topLevelComments: Comment[];
  pinPositions: ViewerState["pinPositions"];
  ghostRaw: ViewerState["ghostRaw"];
  ghostRawRef: React.MutableRefObject<ViewerState["ghostRaw"]>;
  isFullscreen: boolean;
  commentsOpen: boolean;
  anchorResolutionItems: { id: string; anchor: Anchor }[];
  isSpaNavigatingRef: React.MutableRefObject<boolean>;
  spaNavTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | undefined>;
  dispatch: React.Dispatch<ViewerAction>;
}) {
  const [cachedOverlayRect, setCachedOverlayRect] = useState<DOMRect | null>(null);
  const [cachedIframeRect, setCachedIframeRect] = useState<DOMRect | null>(null);

  const requestAnchorPositions = useCallback(
    (opts?: { flushSync?: boolean }) => {
      const iframe = iframeRef.current;
      const win = iframe?.contentWindow;
      if (!win || isFullscreen) return;
      const withAnchors = topLevelComments.filter((c) => c.anchor && (c.anchor.selector || c.anchor.dataComment));
      const ghost = ghostRawRef.current;
      if (!withAnchors.length && !ghost) {
        dispatch({ type: "SET_PINS", pins: {} });
        return;
      }
      const cmts = withAnchors.map((c) => ({ id: String(c.id), anchor: c.anchor as Anchor }));
      if (ghost) {
        cmts.push({ id: "__ghost__", anchor: ghost.anchor });
      }

      const measured = iframe ? measureAnchorsInIframe(iframe, cmts) : null;
      if (measured) {
        const apply = () => {
          if (measured.ghost) {
            dispatch({ type: "PINS_AND_GHOST", pins: measured.pins, ghost: ghostRawRef.current ? {
              ...ghostRawRef.current,
              cx: measured.ghost.cx,
              cy: measured.ghost.cy,
              scrollWidth: measured.ghost.scrollWidth,
              scrollHeight: measured.ghost.scrollHeight,
            } : null });
          } else {
            dispatch({ type: "SET_PINS", pins: measured.pins });
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
        comments: cmts,
      }, "*");
    },
    [topLevelComments, isFullscreen, iframeRef, ghostRawRef, dispatch],
  );

  const requestAnchorPositionsRef = useRef(requestAnchorPositions);
  useEffect(() => { requestAnchorPositionsRef.current = requestAnchorPositions; }, [requestAnchorPositions]);
  const anchorResolutionItemsRef = useRef(anchorResolutionItems);
  useEffect(() => { anchorResolutionItemsRef.current = anchorResolutionItems; }, [anchorResolutionItems]);

  // Listen for ANCHOR_POSITIONS response
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
        const ghostPos = raw.__ghost__;
        if (ghostPos) {
          dispatch({ type: "PINS_AND_GHOST", pins: next, ghost: ghostRawRef.current ? {
            ...ghostRawRef.current,
            cx: ghostPos.left + ghostPos.width / 2,
            cy: ghostPos.top + ghostPos.height / 2,
            scrollWidth: ghostPos.scrollWidth,
            scrollHeight: ghostPos.scrollHeight,
          } : null });
        } else {
          dispatch({ type: "SET_PINS", pins: next });
        }
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iframeListenersDetachRef = useRef<(() => void) | undefined>(undefined);

  const handleFrameReady = useCallback(() => {
    iframeListenersDetachRef.current?.();
    iframeListenersDetachRef.current = undefined;

    const iframeEl = iframeRef.current;
    if (!iframeEl) return;
    const doc = iframeEl.contentDocument;
    const win = iframeEl.contentWindow;
    if (!doc || !win) return;

    const onScrollOrResize = () => {
      if (isSpaNavigatingRef.current || (window as any).__ebmsSpaNav) return;
      requestAnchorPositionsRef.current({ flushSync: true });
    };
    doc.addEventListener("scroll", onScrollOrResize, { passive: true, capture: true });
    win.addEventListener("resize", onScrollOrResize);

    let mutationRaf = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(mutationRaf);
      mutationRaf = requestAnimationFrame(() => {
        if (isSpaNavigatingRef.current) return;
        requestAnchorPositionsRef.current({ flushSync: true });
        const items = anchorResolutionItemsRef.current;
        if (items.length) {
          const resolved: Record<string, boolean> = {};
          for (const item of items) {
            resolved[item.id] = !!resolveAnchorInDocument(doc, item.anchor);
          }
          dispatch({ type: "SET_ANCHOR_RESOLVED", map: resolved });
        }
      });
    });
    if (doc.body) {
      observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden"] });
    }

    iframeListenersDetachRef.current = () => {
      doc.removeEventListener("scroll", onScrollOrResize, { capture: true });
      win.removeEventListener("resize", onScrollOrResize);
      cancelAnimationFrame(mutationRaf);
      observer.disconnect();
    };

    requestAnchorPositions();
  }, [requestAnchorPositions, iframeRef, isSpaNavigatingRef, dispatch]);

  // Fullscreen pin clear + request
  useEffect(() => {
    if (isFullscreen) {
      dispatch({ type: "SET_PINS", pins: {} });
      return;
    }
    requestAnchorPositions();
  }, [requestAnchorPositions, isFullscreen, dispatch]);

  // ResizeObserver on overlay
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      requestAnchorPositions();
      setCachedOverlayRect(el.getBoundingClientRect());
    });
    ro.observe(el);
    setCachedOverlayRect(el.getBoundingClientRect());
    return () => ro.disconnect();
  }, [requestAnchorPositions, overlayRef]);

  // ResizeObserver on iframe
  useEffect(() => {
    const el = iframeRef.current;
    if (!el) return;
    const updateRect = () => {
      setCachedIframeRect(el.getBoundingClientRect());
    };
    const ro = new ResizeObserver(updateRect);
    ro.observe(el);
    setCachedIframeRect(el.getBoundingClientRect());
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sidebar animation tracker
  useEffect(() => {
    if (isFullscreen) return;
    const iframeEl = iframeRef.current;
    if (!iframeEl) return;
    let raf = 0;
    let frame = 0;
    let prev = iframeEl.getBoundingClientRect();
    const maxFrames = 36;
    const step = () => {
      frame += 1;
      const next = iframeEl.getBoundingClientRect();
      if (
        Math.abs(next.left - prev.left) > 0.25 ||
        Math.abs(next.top - prev.top) > 0.25 ||
        Math.abs(next.width - prev.width) > 0.25 ||
        Math.abs(next.height - prev.height) > 0.25
      ) {
        prev = next;
        setCachedIframeRect(next);
        setCachedOverlayRect(overlayRef.current?.getBoundingClientRect() ?? null);
      }
      if (frame < maxFrames) raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [commentsOpen, isFullscreen, iframeRef]);

  // Cleanup iframe listeners on fullscreen/unmount
  useEffect(() => {
    if (isFullscreen) {
      iframeListenersDetachRef.current?.();
      iframeListenersDetachRef.current = undefined;
    }
    return () => {
      iframeListenersDetachRef.current?.();
      iframeListenersDetachRef.current = undefined;
    };
  }, [isFullscreen]);

  // SPA navigation handler
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === "PAGE_NAV") {
        isSpaNavigatingRef.current = true;
        clearTimeout(spaNavTimeoutRef.current);
        spaNavTimeoutRef.current = setTimeout(() => {
          if (isSpaNavigatingRef.current) {
            isSpaNavigatingRef.current = false;
            try { (window as any).__ebmsSpaNav = false; } catch {}
            requestAnchorPositions({ flushSync: true });
          }
        }, 3000);
        flushSync(() => {
          dispatch({ type: "SPA_NAV_CLEAR" });
        });
        return;
      }
      if (e.data?.type === "PAGE_CHANGE") {
        isSpaNavigatingRef.current = false;
        clearTimeout(spaNavTimeoutRef.current);
        requestAnchorPositions({ flushSync: true });
        const doc = iframeRef.current?.contentDocument;
        if (doc && anchorResolutionItemsRef.current.length) {
          const resolved: Record<string, boolean> = {};
          for (const item of anchorResolutionItemsRef.current) {
            resolved[item.id] = !!resolveAnchorInDocument(doc, item.anchor);
          }
          flushSync(() => dispatch({ type: "SET_ANCHOR_RESOLVED", map: resolved }));
        }
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [requestAnchorPositions, iframeRef, isSpaNavigatingRef, spaNavTimeoutRef, dispatch]);

  const rawToOverlay = useCallback(
    (cx: number, cy: number, scrollWidth: number, scrollHeight: number): { x: number; y: number } => {
      if (!cachedOverlayRect || !cachedIframeRect) return { x: cx, y: cy };
      const scaleX = scrollWidth > 0 ? cachedIframeRect.width / scrollWidth : 1;
      const scaleY = scrollHeight > 0 ? cachedIframeRect.height / scrollHeight : 1;
      const dx = cachedIframeRect.left - cachedOverlayRect.left;
      const dy = cachedIframeRect.top - cachedOverlayRect.top;
      return {
        x: Math.round(cx * scaleX + dx),
        y: Math.round(cy * scaleY + dy),
      };
    },
    [cachedOverlayRect, cachedIframeRect],
  );

  const ghostPin = useMemo(() => {
    if (!ghostRaw) return null;
    const { x, y } = rawToOverlay(ghostRaw.cx, ghostRaw.cy, ghostRaw.scrollWidth, ghostRaw.scrollHeight);
    return { x, y, anchor: ghostRaw.anchor };
  }, [ghostRaw, rawToOverlay]);

  const pins: PinPosition[] = useMemo(() => {
    if (!topLevelComments.length) return [];
    const result: PinPosition[] = [];
    let orphanedIndex = 0;
    for (const c of topLevelComments) {
      if (c.resolved) continue;
      const pos = pinPositions[String(c.id)];
      const hasAnchor = c.anchor && (c.anchor.selector || c.anchor.dataComment);
      if (!hasAnchor) continue;
      if (!pos) { orphanedIndex++; continue; }
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
  }, [iframeRef]);

  return { pins, ghostPin, sendHighlight, handleFrameReady, requestAnchorPositions };
}

/* ──────────────────────────── Sub-components ──────────────────────────── */

function ViewerHeaderBar({
  projectName,
  files,
  fileId,
  projectId,
  selectedVersionId,
  forceOpenVersionSelector,
  canManageVersions,
  isFullscreen,
  isMobile,
  mobileSheet,
  sidebarProps,
  dispatch,
  onSetFileId,
  onToggleFullscreen,
}: {
  projectName: string;
  files: { id: number; path: string }[] | undefined;
  fileId: string | null;
  projectId: string;
  selectedVersionId: number | null;
  forceOpenVersionSelector: boolean;
  canManageVersions: boolean;
  isFullscreen: boolean;
  isMobile: boolean;
  mobileSheet: boolean;
  sidebarProps: React.ComponentProps<typeof CommentsSidebar>;
  dispatch: React.Dispatch<ViewerAction>;
  onSetFileId: (id: string) => void;
  onToggleFullscreen: () => void;
}) {
  if (isFullscreen) return null;
  return (
    <div className="absolute left-0 right-0 top-0 z-40 flex flex-col border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="flex items-center gap-1.5 px-3 py-1.5">
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

        <div className="flex min-w-0 items-center gap-1 text-[13px]">
          <span className="truncate text-muted-foreground">{projectName}</span>
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
              onSelectVersion={(id) => dispatch({ type: "SET_VERSION", id })}
              canManage={canManageVersions}
              forceOpen={forceOpenVersionSelector}
              onForceOpenHandled={() => dispatch({ type: "SET_FORCE_OPEN_VERSION_SELECTOR", open: false })}
            />
          ) : null}
        </div>

        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" onClick={onToggleFullscreen}>
              {isFullscreen ? <Minimize className="size-3.5" /> : <Expand className="size-3.5" />}
              <span className="sr-only">Toggle fullscreen</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Fullscreen</TooltipContent>
        </Tooltip>
        {isMobile ? (
          <Sheet open={mobileSheet} onOpenChange={(open) => dispatch({ type: "SET_MOBILE_SHEET", open })}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-foreground lg:hidden">
                <MessageCircle className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85dvh] p-0">
              <CommentsSidebar
                {...sidebarProps}
                onClose={() => dispatch({ type: "SET_MOBILE_SHEET", open: false })}
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
                onClick={() => dispatch({ type: "TOGGLE_COMMENTS_OPEN" })}
                aria-label="Toggle comments"
              >
                <MessageCircle className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Toggle comments</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex items-center gap-1 overflow-x-auto border-t border-border/40 px-3 py-2 scrollbar-none">
        {(files ?? []).map((f) => {
          const active = String(f.id) === fileId;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onSetFileId(String(f.id))}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
                active
                  ? "bg-foreground/8 text-foreground"
                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
              )}
            >
              {formatFileName(f.path)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PinOverlay({
  overlayRef,
  showComposePopover,
  ghostPin,
  pins,
  comments,
  activeThreadId,
  showThreadPopover,
  popoverDisplay,
  user,
  tagOptions,
  selectedTagIds,
  mentionMembers,
  canManageVersions,
  commentHandlers,
  pendingGhostAnchorRef,
  sendHighlight,
  dispatch,
  onToggleTag,
}: {
  overlayRef: React.RefObject<HTMLDivElement | null>;
  showComposePopover: boolean;
  ghostPin: { x: number; y: number; anchor: Anchor } | null;
  pins: PinPosition[];
  comments: Comment[] | undefined;
  activeThreadId: number | null;
  showThreadPopover: boolean;
  popoverDisplay: { threadId: number; pin: PinPosition; comment: Comment; relatedComments: Comment[] } | null;
  user: import("@/types").User | null;
  tagOptions: import("@/types").Tag[];
  selectedTagIds: number[];
  mentionMembers: import("@/components/comments/MentionTextarea").MentionMember[];
  canManageVersions: boolean;
  commentHandlers: ReturnType<typeof useViewerComments>;
  pendingGhostAnchorRef: React.MutableRefObject<Anchor | null>;
  sendHighlight: (a: Anchor | null) => void;
  dispatch: React.Dispatch<ViewerAction>;
  onToggleTag: (id: number) => void;
}) {
  return (
    <div
      ref={overlayRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
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
                onToggleTag={onToggleTag}
                onSubmit={commentHandlers.onSubmitNewComment}
                onCancel={() => dispatch({ type: "SET_GHOST", ghost: null })}
                members={mentionMembers}
              />
            </PopoverContent>
          </Popover>
        </>
      ) : null}

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
              dispatch({ type: "SET_GHOST", ghost: null });
              pendingGhostAnchorRef.current = null;
              dispatch({ type: "SET_ACTIVE_THREAD", id: activeThreadId === pin.commentId ? null : pin.commentId });
              sendHighlight(comment.anchor as Anchor);
            }}
          />
        );
      })}

      {popoverDisplay ? (
        <Popover
          key={popoverDisplay.threadId}
          open={showThreadPopover}
          onOpenChange={(open) => {
            if (!open) dispatch({ type: "SET_ACTIVE_THREAD", id: null });
          }}
        >
          <PopoverAnchor asChild>
            <div
              className="pointer-events-none absolute z-50"
              style={{ left: popoverDisplay.pin.x, top: popoverDisplay.pin.y, width: 1, height: 1 }}
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
              comment={popoverDisplay.comment}
              relatedComments={popoverDisplay.relatedComments}
              currentUser={user}
              canComment={true}
              members={mentionMembers}
              onClose={() => dispatch({ type: "SET_ACTIVE_THREAD", id: null })}
              onResolve={commentHandlers.onResolve}
              onDelete={commentHandlers.onDelete}
              onReply={commentHandlers.onReply}
              onNewComment={commentHandlers.onNewCommentFromThread}
              onEditMessage={commentHandlers.onEditComment}
              onUnlink={canManageVersions ? commentHandlers.onUnlink : undefined}
              isOrphaned={popoverDisplay.pin.orphaned}
            />
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}

/* ──────────────────────────── ProjectViewer ──────────────────────────── */

/* ──────────────── Extracted hook: useProjectViewerData ──────────────── */

function useProjectViewerData(projectId: string) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const viewerRootRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const user = authUser as import("@/types").User | null;
  const { data: project } = useProject(projectId);
  const { data: files, isPending: filesLoading } = useProjectFiles(projectId);
  const syncFiles = useSyncProjectFiles();
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
  const [vs, dispatch] = useReducer(viewerReducer, viewerInitial);
  const { html, htmlLoading, htmlError, pinPositions, anchorResolvedMap, activeThreadId, ghostRaw, selectedVersionId, commentsOpen, mobileSheet, forceOpenVersionSelector } = vs;

  const ghostRawRef = useRef(ghostRaw);
  useEffect(() => { ghostRawRef.current = ghostRaw; }, [ghostRaw]);

  const [lastPopoverState, setLastPopoverState] = useState<{
    threadId: number;
    pin: PinPosition;
    comment: Comment;
    relatedComments: Comment[];
  } | null>(null);

  const consumedUrlCommentRef = useRef(false);

  useEffect(() => {
    if (activeThreadId === null || activeThreadId < 0) {
      if (consumedUrlCommentRef.current) void setCommentParam(null);
    } else {
      void setCommentParam(activeThreadId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  const pendingGhostAnchorRef = useRef<Anchor | null>(null);
  const pendingMatchRequestIdRef = useRef<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isSpaNavigatingRef = useRef(false);
  const spaNavTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useProjectWS(projectId);

  // Auto-check for new file versions every 5 min
  const { data: newVersionsData } = useCheckNewVersions(projectId);
  const shownNewVersionsRef = useRef<string | null>(null);

  useEffect(() => {
    if (!newVersionsData?.length) return;
    const key = newVersionsData.map((e) => `${e.fileId}:${e.newCount}`).sort().join(",");
    if (shownNewVersionsRef.current === key) return;
    shownNewVersionsRef.current = key;
    for (const entry of newVersionsData) {
      void queryClient.invalidateQueries({
        queryKey: FILE_VERSION_KEYS.all(projectId, String(entry.fileId)),
      });
    }
    for (const entry of newVersionsData) {
      const fileName = entry.filePath.split("/").pop() ?? entry.filePath;
      toast(`New version available for ${fileName}`, {
        description: `${entry.newCount} new commit${entry.newCount > 1 ? "s" : ""} found`,
        duration: Infinity,
        action: {
          label: "Change version",
          onClick: () => {
            void setFileId(String(entry.fileId));
            dispatch({ type: "SET_FORCE_OPEN_VERSION_SELECTOR", open: true });
          },
        },
        cancel: { label: "Dismiss", onClick: () => {} },
      });
    }
  }, [newVersionsData, setFileId, queryClient, projectId]);

  useEffect(() => {
    if (!files?.length) return;
    void setFileId((prev) => {
      if (prev && files.some((f) => String(f.id) === prev)) return prev;
      return files[0] ? String(files[0].id) : null;
    });
  }, [files, setFileId]);

  // Fetch HTML
  useEffect(() => {
    if (!projectId || !fileId) { dispatch({ type: "CLEAR_HTML" }); return; }
    let cancelled = false;
    dispatch({ type: "HTML_FETCH_START" });
    const suffix = selectedVersionId ? `?versionId=${selectedVersionId}` : "";
    void apiText(`/projects/${projectId}/files/${fileId}/html${suffix}`)
      .then((t) => { if (!cancelled) dispatch({ type: "HTML_FETCH_OK", html: t }); })
      .catch((e: Error) => { if (!cancelled) dispatch({ type: "HTML_FETCH_ERR", error: e.message || "Failed to load HTML" }); });
    return () => { cancelled = true; };
  }, [projectId, fileId, selectedVersionId]);

  const canManageVersions = user?.role === "admin" || user?.role === "manager";
  const { data: fileVersionsList } = useFileVersions(projectId, fileId ?? undefined);

  const prevFileIdRef = useRef(fileId);
  useEffect(() => {
    if (fileId !== prevFileIdRef.current) {
      prevFileIdRef.current = fileId;
      dispatch({ type: "FILE_SWITCH_RESET" });
    }
  }, [fileId, dispatch]);

  useEffect(() => {
    if (!fileVersionsList?.length) return;
    dispatch({ type: "UPDATE_VERSION", updater: (prev) => {
      if (prev && fileVersionsList.some((v) => v.id === prev)) return prev;
      return fileVersionsList[0]?.id ?? null;
    }});
  }, [fileVersionsList]);

  const { data: comments, isPending: commentsLoading } = useComments(projectId, fileId ?? undefined, selectedVersionId);

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
    const anchors: Anchor[] = [];
    for (const c of topLevelComments) {
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
    dispatch({ type: "SET_ANCHOR_RESOLVED", map: resolved });
  }, []);

  const iframe = useViewerIframe({
    iframeRef, overlayRef, topLevelComments, pinPositions, ghostRaw, ghostRawRef,
    isFullscreen, commentsOpen, anchorResolutionItems, isSpaNavigatingRef, spaNavTimeoutRef, dispatch,
  });

  // Auto-open thread from URL ?comment=
  useEffect(() => {
    if (consumedUrlCommentRef.current || !commentParam) return;
    const pin = iframe.pins.find((p) => p.commentId === commentParam);
    if (!pin) return;
    consumedUrlCommentRef.current = true;
    dispatch({ type: "SET_ACTIVE_THREAD", id: commentParam });
  }, [commentParam, iframe.pins]);

  // Ghost pin position messages
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
          dispatch({ type: "SET_GHOST", ghost: null });
          const existing = topLevelComments.find((c) => String(c.id) === existingThreadId);
          if (existing) iframe.sendHighlight(existing.anchor as Anchor);
          setTimeout(() => { dispatch({ type: "SET_ACTIVE_THREAD", id: Number(existingThreadId) }); }, 150);
          return;
        }
        iframeRef.current?.contentWindow?.postMessage({
          type: "GET_ANCHOR_POSITIONS", requestId: "ghost",
          comments: [{ id: "__ghost__", anchor }],
        }, "*");
        return;
      }
      if (e.data?.type === "ANCHOR_POSITIONS" && e.data.requestId === "ghost" && e.data.positions?.__ghost__) {
        const anchor = pendingGhostAnchorRef.current;
        if (!anchor) return;
        const pos = e.data.positions.__ghost__ as {
          left: number; top: number; width: number; height: number;
          scrollWidth: number; scrollHeight: number;
        };
        pendingGhostAnchorRef.current = null;
        dispatch({ type: "SET_GHOST", ghost: {
          cx: pos.left + pos.width / 2, cy: pos.top + pos.height / 2,
          scrollWidth: pos.scrollWidth, scrollHeight: pos.scrollHeight, anchor,
        }});
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [topLevelComments, iframe.sendHighlight]);

  // Fullscreen listeners
  useEffect(() => {
    function onFullscreenChange() { setIsFullscreen(Boolean(document.fullscreenElement)); }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    dispatch({ type: "FULLSCREEN_ENTER" });
    iframe.sendHighlight(null);
  }, [isFullscreen, iframe.sendHighlight]);

  const processAnchorSelected = useCallback((anchor: Anchor) => {
    dispatch({ type: "SET_GHOST", ghost: null });
    pendingGhostAnchorRef.current = anchor;
    const requestId = `match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pendingMatchRequestIdRef.current = requestId;
    const topLevelCommentsWithAnchors = topLevelComments
      .filter((c) => c.anchor && (c.anchor.selector || c.anchor.dataComment))
      .map((c) => ({ id: String(c.id), anchor: c.anchor }));
    const win = iframeRef.current?.contentWindow;
    win?.postMessage({ type: "SET_CURSOR", cursor: "" }, "*");
    win?.postMessage({
      type: "MATCH_EXISTING_THREAD", requestId,
      selectedAnchor: anchor, comments: topLevelCommentsWithAnchors,
    }, "*");
  }, [topLevelComments]);

  const commentHandlers = useViewerComments({
    fileId, selectedVersionId, topLevelComments, ghostRaw, activeThreadId, dispatch,
    createComment, patchComment, deleteComment, addTag, tagList, selectedTagIds, setSelectedTagIds,
  });

  const pendingContextMenuFractionRef = useRef<{ fX: number; fY: number } | null>(null);
  const contextMenuTriggerRef = useRef<HTMLSpanElement>(null);

  const dnd = useViewerDnd({
    iframeRef, topLevelComments, patchComment, processAnchorSelected,
    pendingContextMenuFractionRef, contextMenuTriggerRef,
  });

  // Context menu from iframe
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type !== "CONTEXT_MENU") return;
      const iframeEl = iframeRef.current;
      if (!iframeEl || isFullscreen) return;
      const rect = iframeEl.getBoundingClientRect();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen]);

  function onSelectThread(commentId: number) {
    dispatch({ type: "SET_GHOST", ghost: null });
    pendingGhostAnchorRef.current = null;
    dispatch({ type: "SET_ACTIVE_THREAD", id: activeThreadId === commentId ? null : commentId });
    const c = topLevelComments.find((x) => x.id === commentId);
    if (c) iframe.sendHighlight(c.anchor as Anchor);
    if (isMobile) dispatch({ type: "SET_MOBILE_SHEET", open: true });
    else dispatch({ type: "SET_COMMENTS_OPEN", open: true });
  }

  function toggleTag(id: number) {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const showThreadPopover = Boolean(activeThreadId);
  const showComposePopover = Boolean(iframe.ghostPin) && !showThreadPopover;

  const currentPopoverState = useMemo(() => {
    if (!activeThreadId) return null;
    const activePin = iframe.pins.find((p) => p.commentId === activeThreadId);
    const activeComment = topLevelComments.find((c) => c.id === activeThreadId);
    if (!activePin || !activeComment) return null;
    const activeAnchor = activeComment.anchor as Anchor | undefined;
    const relatedComments = topLevelComments.filter((c) => {
      if (c.id === activeComment.id) return false;
      const ca = c.anchor as Anchor | undefined;
      if (!ca || !activeAnchor) return false;
      if (activeAnchor.dataComment && ca.dataComment) return activeAnchor.dataComment === ca.dataComment;
      if (activeAnchor.selector && ca.selector) return activeAnchor.selector === ca.selector;
      return false;
    });
    return { threadId: activeComment.id, pin: activePin, comment: activeComment, relatedComments };
  }, [activeThreadId, iframe.pins, topLevelComments]);

  if (currentPopoverState && currentPopoverState.threadId !== lastPopoverState?.threadId) {
    setLastPopoverState(currentPopoverState);
  }
  const popoverDisplay = currentPopoverState ?? lastPopoverState;

  return {
    iframeRef, overlayRef, viewerRootRef, isMobile,
    user, project, files, filesLoading,
    mentionMembers, tagOptions, fileVersionsList,
    fileId, setFileId,
    dispatch, vs,
    html, htmlLoading, htmlError, activeThreadId, selectedVersionId, commentsOpen, mobileSheet, forceOpenVersionSelector,
    anchorResolvedMap, isFullscreen, canManageVersions,
    topLevelComments, comments, commentsLoading, commentAnchors, anchorResolutionItems,
    handleAnchorResolution, iframe, commentHandlers, dnd,
    pendingGhostAnchorRef, pendingContextMenuFractionRef, contextMenuTriggerRef,
    selectedTagIds, onSelectThread, toggleTag,
    showThreadPopover, showComposePopover, popoverDisplay,
    syncFiles,
  };
}

/* ──────────────── Extracted sub-components ──────────────── */

function formatFileName(path: string) {
  const name = path.split("/").pop() ?? path;
  return name
    .replace(/\.html?$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function MobileFileSelector({
  files,
  fileId,
  onSetFileId,
}: {
  files: { id: number; path: string }[];
  fileId: string | null;
  onSetFileId: (id: string) => void;
}) {
  if (files.length <= 1) return null;
  return (
    <div className="absolute left-0 right-0 top-14 z-30 border-b border-border bg-background/90 px-3 py-2 backdrop-blur-sm md:hidden">
      <label htmlFor="viewer-file-select" className="mb-1 block text-xs text-muted-foreground">
        File
      </label>
      <select
        id="viewer-file-select"
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        value={fileId ?? ""}
        onChange={(e) => onSetFileId(e.target.value)}
      >
        {files.map((f) => (
          <option key={f.id} value={f.id}>
            {formatFileName(f.path)}
          </option>
        ))}
      </select>
    </div>
  );
}

function FloatingReopenButton({
  commentsOpen,
  isMobile,
  isFullscreen,
  unresolvedCount,
  dispatch,
}: {
  commentsOpen: boolean;
  isMobile: boolean;
  isFullscreen: boolean;
  unresolvedCount: number;
  dispatch: React.Dispatch<ViewerAction>;
}) {
  if (commentsOpen || isMobile || isFullscreen) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => dispatch({ type: "SET_COMMENTS_OPEN", open: true })}
          className="absolute bottom-4 right-4 z-30 flex items-center gap-1.5 rounded-full border border-border/60 bg-background/90 px-3 py-2 shadow-lg backdrop-blur-sm transition-all hover:bg-background hover:shadow-xl"
        >
          <MessageCircle className="size-4 text-muted-foreground" />
          {unresolvedCount > 0 ? (
            <span className="text-[12px] font-medium text-foreground">
              {unresolvedCount}
            </span>
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">Open comments</TooltipContent>
    </Tooltip>
  );
}

function ViewerContextMenu({
  contextMenuTriggerRef,
  pendingContextMenuFractionRef,
  iframeRef,
}: {
  contextMenuTriggerRef: React.RefObject<HTMLSpanElement | null>;
  pendingContextMenuFractionRef: React.RefObject<{ fX: number; fY: number } | null>;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}) {
  return (
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
  );
}

function ViewerDragOverlay({ draggedComment }: { draggedComment: Comment | null }) {
  return (
    <DragOverlay dropAnimation={null}>
      {draggedComment ? (
        <div className="w-56 rounded-xl border border-primary/30 bg-background px-4 py-3 shadow-xl opacity-90">
          <p className="truncate text-[13px] text-foreground">{draggedComment.body}</p>
        </div>
      ) : null}
    </DragOverlay>
  );
}

function ViewerSidebar({
  isFullscreen,
  isMobile,
  sidebarProps,
}: {
  isFullscreen: boolean;
  isMobile: boolean;
  sidebarProps: React.ComponentProps<typeof CommentsSidebar>;
}) {
  if (isFullscreen || isMobile) return null;
  return (
    <Sidebar side="right" collapsible="offcanvas" className="top-0 border-l border-border">
      <SidebarContent>
        <CommentsSidebar {...sidebarProps} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

export function ProjectViewer({ projectId }: { projectId: string }) {
  const {
    iframeRef, overlayRef, viewerRootRef, isMobile,
    user, project, files, filesLoading,
    mentionMembers, tagOptions, fileVersionsList,
    fileId, setFileId,
    dispatch,
    html, htmlLoading, htmlError, activeThreadId, selectedVersionId, commentsOpen, mobileSheet, forceOpenVersionSelector,
    anchorResolvedMap, isFullscreen, canManageVersions,
    topLevelComments, comments, commentsLoading, commentAnchors, anchorResolutionItems,
    handleAnchorResolution, iframe, commentHandlers, dnd,
    pendingGhostAnchorRef, pendingContextMenuFractionRef, contextMenuTriggerRef,
    selectedTagIds, onSelectThread, toggleTag,
    showThreadPopover, showComposePopover, popoverDisplay,
    syncFiles,
  } = useProjectViewerData(projectId);

  async function toggleFullscreen() {
    const el = document.fullscreenElement;
    const target = el ? document.exitFullscreen() : viewerRootRef.current?.requestFullscreen();
    await target?.catch(() => { toast.error("Fullscreen is not available"); });
  }

  const sidebarProps = {
    comments: topLevelComments,
    currentUser: user,
    members: mentionMembers,
    loading: commentsLoading,
    tagOptions,
    onAddComment: () => {},
    onSubmitDirectComment: commentHandlers.onSubmitDirectComment,
    addCommentDisabled: false,
    onResolve: commentHandlers.onResolve,
    onHover: () => {},
    activeThreadId,
    onSelectThread,
    anchorResolvedMap,
    versions: fileVersionsList,
    onReLink: dnd.onReLink,
    onUnlink: commentHandlers.onUnlink,
    onEditComment: commentHandlers.onEditComment,
    onDeleteComment: commentHandlers.onDelete,
  };

  return (
    <DndContext sensors={dnd.dndSensors} onDragStart={dnd.onDragStart} onDragEnd={dnd.onDragEnd}>
    <TooltipProvider delayDuration={300}>
      <SidebarProvider
        open={commentsOpen}
        onOpenChange={(open) => dispatch({ type: "SET_COMMENTS_OPEN", open })}
        style={{ "--sidebar-width": "20rem" } as CSSProperties}
      >
        <SidebarInset className="h-dvh overflow-hidden bg-background">
          {/* Main canvas area — full height, toolbar floats on top */}
          <div
            ref={viewerRootRef}
            className="relative flex min-h-0 flex-1 canvas-grid-soft"
          >
            <ViewerHeaderBar
              projectName={project?.name ?? "Project"}
              files={files}
              fileId={fileId}
              projectId={projectId}
              selectedVersionId={selectedVersionId}
              forceOpenVersionSelector={forceOpenVersionSelector}
              canManageVersions={canManageVersions}
              isFullscreen={isFullscreen}
              isMobile={isMobile}
              mobileSheet={mobileSheet}
              sidebarProps={sidebarProps}
              dispatch={dispatch}
              onSetFileId={(id) => void setFileId(id)}
              onToggleFullscreen={() => void toggleFullscreen()}
            />

            {files ? (
              <MobileFileSelector files={files} fileId={fileId} onSetFileId={(id) => void setFileId(id)} />
            ) : null}

            <FloatingReopenButton
              commentsOpen={commentsOpen}
              isMobile={isMobile}
              isFullscreen={isFullscreen}
              unresolvedCount={topLevelComments.filter((c) => !c.resolved).length}
              dispatch={dispatch}
            />

            <div className={cn("relative flex h-full min-h-0 min-w-0 flex-1 flex-col", isFullscreen ? "p-0" : "pt-24 px-3 pb-3 md:pt-24 md:px-4 md:pb-4")}>
              {!filesLoading && !files?.length ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm text-muted-foreground">No HTML files found.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={syncFiles.isPending}
                    onClick={() => syncFiles.mutate(projectId)}
                  >
                    {syncFiles.isPending ? "Syncing…" : "Sync files"}
                  </Button>
                </div>
              ) : (
                <div className={cn(
                  "relative flex min-h-0 flex-1 flex-col transition-shadow duration-150",
                  isFullscreen ? "" : "rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.08),0_8px_32px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04]",
                  dnd.isOverIframe && "ring-2 ring-primary/40 ring-offset-1",
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
                    borderless={isFullscreen}
                    onFrameReady={iframe.handleFrameReady}
                    onFileNav={(href) => {
                      const name = href.split("/").pop() ?? href;
                      const target = files?.find((f) => (f.path.split("/").pop() ?? f.path) === name);
                      if (target) void setFileId(String(target.id));
                    }}
                  />

                  {/* Re-link overlay */}
                  {dnd.reLinkCommentId !== null ? (
                    <div className="absolute inset-0 z-[60]" style={{ pointerEvents: "all", cursor: "copy" }} />
                  ) : null}

                  {/* Pin overlay */}
                  {!isFullscreen && !htmlLoading && !htmlError && html ? (
                    <PinOverlay
                      overlayRef={overlayRef}
                      showComposePopover={showComposePopover}
                      ghostPin={iframe.ghostPin}
                      pins={iframe.pins}
                      comments={comments}
                      activeThreadId={activeThreadId}
                      showThreadPopover={showThreadPopover}
                      popoverDisplay={popoverDisplay}
                      user={user}
                      tagOptions={tagOptions}
                      selectedTagIds={selectedTagIds}
                      mentionMembers={mentionMembers}
                      canManageVersions={canManageVersions}
                      commentHandlers={commentHandlers}
                      pendingGhostAnchorRef={pendingGhostAnchorRef}
                      sendHighlight={iframe.sendHighlight}
                      dispatch={dispatch}
                      onToggleTag={toggleTag}
                    />
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </SidebarInset>

        <ViewerSidebar isFullscreen={isFullscreen} isMobile={isMobile} sidebarProps={sidebarProps} />
      </SidebarProvider>
      <ViewerDragOverlay draggedComment={dnd.draggedComment} />
      <ViewerContextMenu
        contextMenuTriggerRef={contextMenuTriggerRef}
        pendingContextMenuFractionRef={pendingContextMenuFractionRef}
        iframeRef={iframeRef}
      />
    </TooltipProvider>
    </DndContext>
  );
}
