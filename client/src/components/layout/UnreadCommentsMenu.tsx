import { Bell, MessageCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { useProjects } from "@/api/projects/query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function pluralize(n: number) {
  if (n === 1) return "непрочитаний коментар";
  if (n < 5) return "непрочитані коментарі";
  return "непрочитаних коментарів";
}

export function UnreadCommentsMenu() {
  const { data: projects } = useProjects();
  const unread = (projects ?? [])
    .filter((p) => (p._count?.unreadComments ?? 0) > 0)
    .sort((a, b) => (b._count?.unreadComments ?? 0) - (a._count?.unreadComments ?? 0));
  const total = unread.reduce((sum, p) => sum + (p._count?.unreadComments ?? 0), 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Непрочитані коментарі"
          className={cn(
            "relative inline-flex size-8 items-center justify-center rounded-md text-text-tertiary outline-none",
            "hover:bg-black/5 hover:text-foreground dark:hover:bg-white/6",
            "transition-colors",
          )}
        >
          <Bell className="size-[15px]" />
          {total > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground ring-2 ring-background">
              {total > 99 ? "99+" : total}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <span className="text-[13px] font-semibold text-foreground">Непрочитані коментарі</span>
          {total > 0 ? (
            <span className="text-[11px] tabular-nums text-text-tertiary">{total}</span>
          ) : null}
        </div>
        {unread.length === 0 ? (
          <div className="px-3 py-8 text-center text-[12px] text-text-tertiary">
            Немає непрочитаних коментарів
          </div>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto py-1">
            {unread.map((p) => {
              const count = p._count?.unreadComments ?? 0;
              return (
                <li key={p.id}>
                  <Link
                    to="/projects/$id/viewer"
                    params={{ id: String(p.id) }}
                    className="flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-black/4 dark:hover:bg-white/4 transition-colors outline-none"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{p.name}</p>
                      <p className="truncate text-[11px] text-text-tertiary">
                        {count} {pluralize(count)}
                      </p>
                    </div>
                    <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center gap-1 rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground">
                      <MessageCircle className="size-3" />
                      {count}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
