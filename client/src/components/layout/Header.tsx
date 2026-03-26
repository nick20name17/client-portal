"use client";

import { usePathname } from "next/navigation";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { UserAvatar } from "@/components/shared/UserAvatar";

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
  const pathname = usePathname();
  const { data } = authClient.useSession();
  const user = data?.user as { name?: string | null; email?: string | null; image?: string | null } | undefined;

  async function signOut() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-6" />
      <div className="flex flex-1 items-center justify-between gap-4">
        <nav className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{titleForPath(pathname)}</span>
        </nav>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg p-1.5 outline-none ring-offset-background hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
            <UserAvatar name={user?.name ?? user?.email ?? "?"} image={user?.image} className="size-8" />
            <span className="hidden max-w-[140px] truncate text-sm font-medium sm:inline">{user?.name ?? "Account"}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>Profile</DropdownMenuItem>
            <DropdownMenuItem onClick={() => void signOut()}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
