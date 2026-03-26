"use client";

import { formatDistanceToNow } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardStats } from "@/types";

export function StatsWidget({ stats, loading }: { stats?: DashboardStats; loading?: boolean }) {
  if (loading || !stats) {
    return (
      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  const resolvedPct =
    stats.totalComments > 0 ? Math.round((stats.resolvedComments / stats.totalComments) * 100) : 0;

  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="text-base">Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ul className="space-y-2 text-muted-foreground">
          <li className="flex justify-between gap-2">
            <span>Total comments</span>
            <span className="font-medium text-foreground">{stats.totalComments}</span>
          </li>
          <li className="flex justify-between gap-2">
            <span>Resolved</span>
            <span className="font-medium text-foreground">
              {stats.resolvedComments}{" "}
              <span className="text-muted-foreground">({resolvedPct}%)</span>
            </span>
          </li>
          <li className="flex justify-between gap-2">
            <span>Open</span>
            <span className="font-medium text-foreground">{stats.openComments}</span>
          </li>
          <li className="flex justify-between gap-2">
            <span>Projects</span>
            <span className="font-medium text-foreground">{stats.projects}</span>
          </li>
          <li className="flex justify-between gap-2">
            <span>Users</span>
            <span className="font-medium text-foreground">{stats.users}</span>
          </li>
        </ul>
        <div className="border-t border-border pt-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recent activity
          </p>
          <ul className="space-y-3">
            {stats.recentActivity.length === 0 ? (
              <li className="text-muted-foreground">No recent comments.</li>
            ) : (
              stats.recentActivity.map((a) => (
                <li key={a.id} className="text-xs">
                  <p className="text-foreground">
                    <span className="font-medium">{a.authorName}</span>
                    <span className="text-muted-foreground"> · {a.projectName}</span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-muted-foreground">{a.body}</p>
                  <p className="mt-1 text-[0.65rem] text-muted-foreground">
                    {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
