"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, MessageCircle, RefreshCw, Share2 } from "lucide-react";
import { toast } from "sonner";

import { CommentsSidebar } from "@/components/viewer/CommentsSidebar";
import { HtmlFrame } from "@/components/viewer/HtmlFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
import type { Anchor } from "@/types";

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
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  useProjectSSE(projectId);

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
    const grouped = new Map<string, { commentId: string; anchor: Anchor; count: number }>();
    for (const c of rows) {
      const a = c.anchor as Anchor;
      const key = anchorKey(a);
      if (!key) continue;
      const found = grouped.get(key);
      if (found) found.count += 1;
      else grouped.set(key, { commentId: c.id, anchor: a, count: 1 });
    }
    return Array.from(grouped.values());
  }, [comments]);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === "ELEMENT_SELECTED") {
        setAnchor(e.data.anchor as Anchor);
        setFormOpen(true);
        setReplyParentId(null);
        setActiveThreadId(null);
        if (isMobile) setMobileSheet(true);
      }
      if (e.data?.type === "PIN_SELECTED") {
        const id = typeof e.data.commentId === "string" ? e.data.commentId : null;
        setActiveThreadId(id);
        if (id) {
          const pin = commentPins.find((x) => x.commentId === id);
          if (pin) sendHighlight(pin.anchor);
          if (isMobile) setMobileSheet(true);
        }
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [commentPins, isMobile, sendHighlight]);

  const sendHighlight = useCallback((a: Anchor | null) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    if (a) win.postMessage({ type: "HIGHLIGHT_ELEMENT", anchor: a }, "*");
    else win.postMessage({ type: "CLEAR_HIGHLIGHT" }, "*");
  }, []);

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
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
        <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
          <Link href="/" aria-label="Back">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-sm font-semibold">{project?.name ?? "Project"}</h1>
            {project?.company?.name ? (
              <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">
                {project.company.name}
              </Badge>
            ) : null}
          </div>
        </div>
        {files && files.length > 1 ? (
          <div className="hidden max-w-[40%] overflow-x-auto md:block">
            <Tabs value={fileId ?? ""} onValueChange={setFileId}>
              <TabsList className="h-8">
                {files.map((f) => (
                  <TabsTrigger key={f.id} value={f.id} className="max-w-[140px] truncate px-2 text-xs">
                    {f.path.split("/").pop() ?? f.path}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        ) : null}
        <Button variant="outline" size="sm" className="inline-flex" onClick={() => void onSync()}>
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">Sync</span>
        </Button>
        <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={copyShare}>
          <Share2 className="size-4" />
          Share
        </Button>
        {isMobile ? (
          <Sheet open={mobileSheet} onOpenChange={setMobileSheet}>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="shrink-0 lg:hidden">
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
                onClose={() => setMobileSheet(false)}
              />
            </SheetContent>
          </Sheet>
        ) : null}
      </header>

      {files && files.length > 1 ? (
        <div className="border-b border-border px-3 py-2 md:hidden">
          <label className="mb-1 block text-xs text-muted-foreground">File</label>
          <select
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

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1 p-3">
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
            />
          )}
        </div>
        {!isMobile ? (
          <div className="hidden w-[360px] shrink-0 lg:block">
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
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
