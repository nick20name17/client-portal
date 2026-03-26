import Link from "next/link";
import { MessageCircle, FileText } from "lucide-react";

import { UserAvatar } from "@/components/shared/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { getProjectColor } from "@/lib/utils";
import type { Project } from "@/types";

export function ProjectCard({ project }: { project: Project }) {
  const border = getProjectColor(project.id);
  const comments = project._count?.comments ?? 0;
  const files = project._count?.files ?? 0;
  const preview = project.memberPreview ?? [];

  return (
    <Card
      className="group flex flex-col overflow-hidden border-l-4 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]"
      style={{ borderLeftColor: border }}
    >
      <CardHeader className="pb-2">
        <Badge variant="secondary" className="w-fit text-xs font-normal">
          {project.company?.name ?? "—"}
        </Badge>
        <h3 className="mt-2 text-lg font-semibold leading-tight">{project.name}</h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{project.description || "No description"}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 pb-2">
        <div className="flex -space-x-2">
          {preview.slice(0, 5).map((m) => (
            <UserAvatar key={m.id} name={m.name} image={m.image} className="size-8 ring-2 ring-background" />
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="size-3.5" />
            {comments}
          </span>
          <span className="inline-flex items-center gap-1">
            <FileText className="size-3.5" />
            {files} files
          </span>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button variant="outline" className="w-full" asChild>
          <Link href={`/projects/${project.id}/viewer`}>Open project →</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
