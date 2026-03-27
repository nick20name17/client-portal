"use client";

import Link from "next/link";
import { FolderOpen, Plus } from "lucide-react";

import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { StatsWidget } from "@/components/dashboard/StatsWidget";
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

  return (
    <div className="flex flex-1 flex-col gap-8 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Good morning 👋</h1>
          <p className="text-sm text-muted-foreground">Your projects and review activity.</p>
        </div>
        {isAdmin ? (
          <Button asChild>
            <Link href="/projects">
              <Plus className="size-4" />
              New project
            </Link>
          </Button>
        ) : null}
      </div>

      <div
        className={
          isAdmin
            ? "grid gap-8 lg:grid-cols-[1fr_minmax(260px,320px)]"
            : "grid gap-8"
        }
      >
        <section className="min-w-0 space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            {isAdmin ? "All projects" : "My projects"}
          </h2>
          {isPending ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Skeleton className="h-52 rounded-xl" />
              <Skeleton className="h-52 rounded-xl" />
              <Skeleton className="h-52 rounded-xl" />
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
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </section>

        {isAdmin ? (
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <StatsWidget stats={stats} loading={statsLoading} />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
