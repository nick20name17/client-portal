"use client";

import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, FolderKanban, MessageCircle, TrendingUp, Users2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/types";

export function StatsWidget({ stats, loading }: { stats?: DashboardStats; loading?: boolean }) {
  if (loading || !stats) {
    return (
      <Card className="shadow-(--shadow-card)">
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
    <Card className="shadow-(--shadow-card)">
      <CardHeader>
        <CardTitle className="text-base">Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: MessageCircle, label: "Total", value: stats.totalComments, color: "text-primary" },
            { icon: CheckCircle2, label: "Resolved", value: `${stats.resolvedComments} (${resolvedPct}%)`, color: "text-[var(--status-resolved)]" },
            { icon: TrendingUp, label: "Open", value: stats.openComments, color: "text-amber-600" },
            { icon: FolderKanban, label: "Projects", value: stats.projects, color: "text-blue-600" },
            { icon: Users2, label: "Users", value: stats.users, color: "text-purple-600" },
          ].map(({ icon: StatIcon, label, value, color }) => (
            <div key={label} className="rounded-lg bg-muted/50 p-3">
              <StatIcon className={cn("mb-1.5 size-4", color)} />
              <p className="text-xl font-semibold leading-none">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
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
