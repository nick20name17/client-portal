
import { useRouterState } from "@tanstack/react-router";

import { SidebarTrigger } from "@/components/ui/sidebar";

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/projects": "Projects",
  "/companies": "Companies",
  "/users": "Users",
  "/tags": "Tags",
};

function titleForPath(pathname: string): string {
  if (titles[pathname]) return titles[pathname];
  if (pathname.startsWith("/projects/") && pathname.includes("/viewer")) return "Viewer";
  if (pathname.startsWith("/projects/")) return "Project";
  return "HTML Review";
}

export function Header() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = titleForPath(pathname);

  return (
    <header className="flex h-[52px] shrink-0 items-center gap-2 px-4 shadow-[0_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
      <SidebarTrigger className="-ml-1" />
      <span className="text-[13px] font-medium text-foreground">{title}</span>
    </header>
  );
}
