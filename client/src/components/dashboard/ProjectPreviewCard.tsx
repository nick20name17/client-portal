import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, MessageCircle } from "lucide-react";

import { useProjectFiles } from "@/api/projects/query";
import { apiText } from "@/lib/api";
import { getProjectColor } from "@/lib/utils";
import type { Project } from "@/types";

function useFirstFileHtml(projectId: number, fileId: number | undefined) {
  return useQuery({
    queryKey: ["project-preview-html", projectId, fileId],
    queryFn: () => apiText(`/projects/${projectId}/files/${fileId}/html`),
    enabled: !!fileId,
    staleTime: 10 * 60 * 1000,
  });
}

export function ProjectPreviewCard({ project }: { project: Project }) {
  const accent = getProjectColor(project.id);
  const comments = project._count?.comments ?? 0;
  const filesCount = project._count?.files ?? 0;

  const { data: files } = useProjectFiles(String(project.id));
  const firstFile = files?.[0];
  const { data: html } = useFirstFileHtml(project.id, firstFile?.id);

  const previewRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / 1280);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const iframeH = Math.round(160 / scale);

  // Hide fixed/sticky positioned overlays (chat widgets, floating buttons) in preview thumbnail
  const previewHtml = html
    ? html.replace(
        /<\/body>/i,
        `<script>(function(){var s=document.createElement("style");s.textContent="";document.head.appendChild(s);function hide(){document.querySelectorAll("*").forEach(function(el){var p=getComputedStyle(el).position;if(p==="fixed"||p==="sticky")el.style.setProperty("display","none","important")});};hide();new MutationObserver(hide).observe(document.body,{childList:true,subtree:true})})()</script></body>`,
      )
    : null;

  return (
    <Link
      to="/projects/$id/viewer"
      params={{ id: String(project.id) }}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-border/80 hover:shadow-md hover:shadow-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Preview thumbnail */}
      <div
        ref={previewRef}
        className="relative h-40 overflow-hidden rounded-t-xl border-b border-border/50 bg-muted/20 isolate"
      >
        {previewHtml ? (
          <iframe
            srcDoc={previewHtml}
            sandbox="allow-scripts"
            tabIndex={-1}
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 border-0 bg-white"
            style={{
              width: 1280,
              height: iframeH,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="size-5 animate-spin rounded-full border-2 border-border border-t-muted-foreground/30" />
          </div>
        )}
        {/* Click capture overlay */}
        <div className="absolute inset-0" />
      </div>

      {/* Info */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
          />
          <span className="truncate text-[13px] font-medium text-foreground transition-colors group-hover:text-primary">
            {project.name}
          </span>
        </div>
        {project.company?.name ? (
          <p className="mt-0.5 truncate text-[11px] text-text-tertiary">
            {project.company.name}
          </p>
        ) : null}
        <div className="mt-2.5 flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-text-tertiary">
            <FileText className="size-3 shrink-0" />
            {filesCount}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-text-tertiary">
            <MessageCircle className="size-3 shrink-0" />
            {comments}
          </span>
        </div>
      </div>
    </Link>
  );
}
