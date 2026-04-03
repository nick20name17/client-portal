import { Link } from "@tanstack/react-router";
import { MessageCircle, FileText, ArrowRight } from "lucide-react";

import { getProjectColor } from "@/lib/utils";
import type { Project } from "@/types";

export function ProjectCard({ project }: { project: Project }) {
  const accent = getProjectColor(project.id);
  const comments = project._count?.comments ?? 0;
  const files = project._count?.files ?? 0;

  return (
    <Link
      to="/projects/$id/viewer"
      params={{ id: String(project.id) }}
      className="group relative flex items-center gap-4 py-3.5 pl-5 pr-5 transition-colors duration-150 hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      {/* Left accent stripe — reveals on hover */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px] origin-left scale-y-0 rounded-r-full transition-transform duration-200 group-hover:scale-y-100"
        style={{ backgroundColor: accent }}
      />

      {/* Color dot */}
      <div
        className="size-2 shrink-0 rounded-full transition-transform duration-150 group-hover:scale-110"
        style={{ backgroundColor: accent }}
      />

      {/* Name + company */}
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-foreground transition-colors duration-150 group-hover:text-primary">
          {project.name}
        </span>
        {project.company?.name ? (
          <span className="mt-0.5 block text-[12px] text-text-tertiary">
            {project.company.name}
          </span>
        ) : null}
      </div>

      {/* Counts */}
      <div className="hidden shrink-0 items-center gap-4 sm:flex">
        <span className="inline-flex items-center gap-1 text-[12px] tabular-nums text-text-tertiary">
          <FileText className="size-3 shrink-0" />
          {files}
        </span>
        <span className="inline-flex items-center gap-1 text-[12px] tabular-nums text-text-tertiary">
          <MessageCircle className="size-3 shrink-0" />
          {comments}
        </span>
      </div>

      <ArrowRight className="size-3.5 shrink-0 text-text-tertiary/40 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-text-secondary" />
    </Link>
  );
}
