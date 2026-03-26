"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, MessageCircle, RefreshCw, Share2 } from "lucide-react";
import { toast } from "sonner";

import { CommentsSidebar } from "@/components/viewer/CommentsSidebar";
import { HtmlFrame } from "@/components/viewer/HtmlFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useCreateComment,
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

function anchorKey(anchor: Anchor | null | undefined): string {
  if (!anchor) return "";
  if (anchor.dataComment) return `dc:${anchor.dataComment}`;
  if (anchor.selector) return `sel:${anchor.selector}`;
  return "";
}

/** Comments/replies that store a selector or data-comment — checked in the preview iframe for DOM resolution. */
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

export function ProjectViewer({ projectId }: { projectId: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isMobile = useIsMobile();

  const { data: project } = useProject(projectId);
  const { data: files, isPending: filesLoading } = useProjectFiles(projectId);
  const { data: tagList } = useTags();
  const tagOptions = tagList ?? [];
  const sync = useSyncProjectFiles();
  const createComment = useCreateComment(projectId);
  const patchComment = usePatchComment(projectId);
  const addTag = useAddCommentTag(projectId);

  const [fileId, setFileId] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [htmlLoading, setHtmlLoading] = useState(false);
  const [htmlError, setHtmlError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [mobileSheet, setMobileSheet] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [focusedAnchorKey, setFocusedAnchorKey] = useState<string | null>(null);
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
      .then((t) => {
        if (!cancelled) setHtml(t);
      })
      .catch((e: Error) => {
        if (!cancelled) setHtmlError(e.message || "Failed to load HTML");
      })
      .finally(() => {
        if (!cancelled) setHtmlLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, fileId]);

  const { data: comments, isPending: commentsLoading } = useComments(projectId, fileId ?? undefined);
  const commentAnchors = useMemo(() => {
    const rows = comments ?? [];
    const anchors: Anchor[] = [];
    for (const c of rows) {
      anchors.push(c.anchor as Anchor);
      for (const r of c.replies ?? []) anchors.push(r.anchor as Anchor);
    }
    return anchors.filter((a) => a && (a.selector || a.dataComment));
  }, [comments]);
  const commentPins = useMemo(() => {
    const rows = comments ?? [];
    const grouped = new Map<string, { commentId: string; anchor: Anchor; count: number; anchorKey: string }>();
    for (const c of rows) {
      const a = c.anchor as Anchor;
      const key = anchorKey(a);
      if (!key) continue;
      const found = grouped.get(key);
      if (found) found.count += 1;
      else grouped.set(key, { commentId: c.id, anchor: a, count: 1, anchorKey: key });
    }
    return Array.from(grouped.values());
  }, [comments]);

  const anchorResolutionItems = useMemo(
    () => flattenCommentAnchorsForResolution(comments),
    [comments],
  );

  const handleAnchorResolution = useCallback((resolved: Record<string, boolean>) => {
    setAnchorResolvedMap(resolved);
  }, []);

  const sendHighlight = useCallback((a: Anchor | null) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    if (a) win.postMessage({ type: "HIGHLIGHT_ELEMENT", anchor: a }, "*");
    else win.postMessage({ type: "CLEAR_HIGHLIGHT" }, "*");
  }, []);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === "ELEMENT_SELECTED") {
        setAnchor(e.data.anchor as Anchor);
        setFormOpen(true);
        setReplyParentId(null);
        setActiveThreadId(null);
        setFocusedAnchorKey(null);
        if (isMobile) setMobileSheet(true);
      }
      if (e.data?.type === "PIN_SELECTED") {
        const id = typeof e.data.commentId === "string" ? e.data.commentId : null;
        const key = typeof e.data.anchorKey === "string" ? e.data.anchorKey : null;
        setActiveThreadId(id);
        setFocusedAnchorKey(key);
        if (id) {
          const pin = commentPins.find((x) => x.commentId === id);
          if (pin) sendHighlight(pin.anchor);
          if (isMobile) setMobileSheet(true);
          else setCommentsOpen(true);
        }
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [commentPins, isMobile, sendHighlight]);

  async function onSubmit(body: string) {
    if (!fileId) {
      toast.error("Select a file first");
      return;
    }
    try {
      const row = (await createComment.mutateAsync({
        fileId,
        body,
        anchor: anchor ?? emptyAnchor(),
        parentId: replyParentId ?? undefined,
      })) as { id: string };
      const id = row.id;
      for (const tagId of selectedTagIds) {
        await addTag.mutateAsync({ commentId: id, tagId });
      }
      toast.success("Comment added");
      setFormOpen(false);
      setAnchor(null);
      setReplyParentId(null);
      setSelectedTagIds([]);
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

  function onReply(id: string) {
    setReplyParentId(id);
    setFormOpen(true);
    setAnchor(null);
    setActiveThreadId(id);
  }

  function onAddComment() {
    setReplyParentId(null);
    setAnchor(null);
    setFormOpen(true);
    setActiveThreadId(null);
    setFocusedAnchorKey(null);
    if (isMobile) setMobileSheet(true);
  }

  function onCancelForm() {
    setFormOpen(false);
    setAnchor(null);
    setReplyParentId(null);
    setSelectedTagIds([]);
  }

  function toggleTag(id: string) {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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

  return (
    <TooltipProvider delayDuration={400}>
    <SidebarProvider
      open={commentsOpen}
      onOpenChange={setCommentsOpen}
      style={{ "--sidebar-width": "22.5rem" } as CSSProperties}
    >
      <SidebarInset className="h-dvh overflow-hidden bg-background">
        <header className="relative flex h-14 shrink-0 items-center border-b border-border bg-background px-3 md:px-4">
        <div className="flex min-w-0 max-w-[min(100%,14rem)] items-center gap-2 sm:max-w-[min(100%,20rem)] md:max-w-[40%]">
        <Button variant="ghost" size="icon" className="size-9 shrink-0" asChild>
          <Link href="/" aria-label="Back">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-sm font-semibold tracking-tight">{project?.name ?? "Project"}</h1>
            {project?.company?.name ? (
              <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">
                {project.company.name}
              </Badge>
            ) : null}
          </div>
        </div>
        </div>
        {files && files.length > 1 ? (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden max-w-[min(100vw-12rem,28rem)] -translate-x-1/2 -translate-y-1/2 md:block">
            <div className="pointer-events-auto overflow-x-auto">
            <Tabs value={fileId ?? ""} onValueChange={setFileId}>
              <TabsList className="h-9 gap-0.5 rounded-lg bg-muted/80 p-1">
                {files.map((f) => (
                  <TabsTrigger
                    key={f.id}
                    value={f.id}
                    className="max-w-[160px] shrink truncate rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" className="size-9" onClick={() => void onSync()}>
              <RefreshCw className="size-4" />
              <span className="sr-only">Sync files from repository</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Sync files</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" className="size-9" onClick={copyShare}>
              <Share2 className="size-4" />
              <span className="sr-only">Copy link</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Copy share link</TooltipContent>
        </Tooltip>
        {isMobile ? (
          <Sheet open={mobileSheet} onOpenChange={setMobileSheet}>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="size-9 shrink-0 lg:hidden">
                <MessageCircle className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85dvh] p-0">
              <CommentsSidebar
                comments={comments}
                loading={commentsLoading}
                tagOptions={tagOptions}
                formOpen={formOpen}
                anchor={anchor}
                replyParentId={replyParentId}
                selectedTagIds={selectedTagIds}
                onToggleTag={toggleTag}
                onSubmit={onSubmit}
                onCancelForm={onCancelForm}
                onReply={onReply}
                onAddComment={onAddComment}
                onResolve={onResolve}
                onHover={sendHighlight}
                activeThreadId={activeThreadId}
                focusedAnchorKey={focusedAnchorKey}
                onClearFocus={() => setFocusedAnchorKey(null)}
                onClose={() => setMobileSheet(false)}
                anchorResolvedMap={anchorResolvedMap}
              />
            </SheetContent>
          </Sheet>
        ) : (
          <SidebarTrigger
            className="hidden size-9 lg:inline-flex"
            aria-label="Toggle comments sidebar"
          />
        )}
        </div>
      </header>

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

        <div className="flex min-h-0 flex-1 bg-[#ececec] dark:bg-muted/40">
          <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col p-3 md:p-4">
          {filesLoading ? (
            <p className="text-sm text-muted-foreground">Loading files…</p>
          ) : !files?.length ? (
            <p className="text-sm text-muted-foreground">No HTML files. Run sync from the projects list.</p>
          ) : (
            <HtmlFrame
              ref={iframeRef}
              html={html}
              loading={htmlLoading}
              error={htmlError}
              commentAnchors={commentAnchors}
              commentPins={commentPins}
              anchorResolutionItems={anchorResolutionItems}
              onAnchorResolution={handleAnchorResolution}
            />
          )}
          </div>
        </div>
      </SidebarInset>
      {!isMobile ? (
        <Sidebar side="right" collapsible="offcanvas" className="top-14 border-l border-border">
          <SidebarContent>
            <CommentsSidebar
              comments={comments}
              loading={commentsLoading}
              tagOptions={tagOptions}
              formOpen={formOpen}
              anchor={anchor}
              replyParentId={replyParentId}
              selectedTagIds={selectedTagIds}
              onToggleTag={toggleTag}
              onSubmit={onSubmit}
              onCancelForm={onCancelForm}
              onReply={onReply}
              onAddComment={onAddComment}
              onResolve={onResolve}
              onHover={sendHighlight}
              activeThreadId={activeThreadId}
              focusedAnchorKey={focusedAnchorKey}
              onClearFocus={() => setFocusedAnchorKey(null)}
              anchorResolvedMap={anchorResolvedMap}
            />
          </SidebarContent>
          <SidebarRail />
        </Sidebar>
      ) : null}
    </SidebarProvider>
    </TooltipProvider>
  );
}
