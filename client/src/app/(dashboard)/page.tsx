"use client";

import Link from "next/link";
import { FolderOpen, Plus, MessageCircle, CheckCircle2, TrendingUp, FolderKanban, Users2 } from "lucide-react";

import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/use-projects";
import { useStats } from "@/hooks/use-stats";

export default function DashboardPage() {
  const { data: session } = authClient.useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = role === "admin";

  const { data: projects, isPending } = useProjects();
  const { data: stats, isPending: statsLoading } = useStats({ enabled: isAdmin });

  const resolvedPct =
    stats && stats.totalComments > 0
      ? Math.round((stats.resolvedComments / stats.totalComments) * 100)
      : 0;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {isAdmin ? "All projects" : "My projects"}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {projects ? `${projects.length} project${projects.length === 1 ? "" : "s"}` : "Loading…"}
          </p>
        </div>
        {isAdmin ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/projects">
              <Plus className="size-3.5" />
              New project
            </Link>
          </Button>
        ) : null}
      </div>

      {/* Admin stats bar */}
      {isAdmin ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {statsLoading || !stats ? (
            <>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </>
          ) : (
            <>
              {[
                { icon: MessageCircle, label: "Total", value: stats.totalComments },
                { icon: TrendingUp, label: "Open", value: stats.openComments },
                { icon: CheckCircle2, label: "Resolved", value: `${resolvedPct}%` },
                { icon: FolderKanban, label: "Projects", value: stats.projects },
                { icon: Users2, label: "Users", value: stats.users },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-lg border border-border bg-background px-4 py-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="size-3.5" />
                    {label}
                  </div>
                  <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
                </div>
              ))}
            </>
          )}
        </div>
      ) : null}

      {/* Project list */}
      {isPending ? (
        <div className="overflow-hidden rounded-lg border border-border">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-5 border-b border-border px-5 py-4 last:border-0">
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-4 w-48 rounded" />
              <div className="ml-auto flex items-center gap-4">
                <Skeleton className="h-3.5 w-16 rounded" />
                <Skeleton className="h-3.5 w-20 rounded" />
                <Skeleton className="size-3.5 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : !projects?.length ? (
        <EmptyState
          icon={FolderOpen}
          title="No projects yet"
          description={
            isAdmin
              ? "Create your first project and sync HTML from GitHub."
              : "You have not been added to any project yet."
          }
        >
          {isAdmin ? (
            <Button asChild>
              <Link href="/projects">
                <Plus className="size-4" />
                Create your first project
              </Link>
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          {projects.map((p) => (
            <div key={p.id} className="border-b border-border last:border-0">
              <ProjectCard project={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
