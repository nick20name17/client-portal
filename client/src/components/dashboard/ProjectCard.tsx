import Link from "next/link";
import { MessageCircle, FileText, ArrowRight } from "lucide-react";

import { getProjectColor } from "@/lib/utils";
import type { Project } from "@/types";

export function ProjectCard({ project }: { project: Project }) {
  const accent = getProjectColor(project.id);
  const comments = project._count?.comments ?? 0;
  const files = project._count?.files ?? 0;

  return (
    <Link
      href={`/projects/${project.id}/viewer`}
      className="group flex items-center gap-5 py-4 pl-5 pr-5 transition-colors duration-150 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      {/* Name + company */}
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {project.name}
        </span>
        {project.company?.name ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">{project.company.name}</span>
        ) : null}
      </div>

      {/* Counts */}
      <div className="hidden shrink-0 items-center gap-5 sm:flex">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileText className="size-3.5 shrink-0" />
          {files} {files === 1 ? "file" : "files"}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <MessageCircle className="size-3.5 shrink-0" />
          {comments} {comments === 1 ? "comment" : "comments"}
        </span>
      </div>

      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/30 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
    </Link>
  );
}
