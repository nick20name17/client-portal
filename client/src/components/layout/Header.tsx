"use client";

import { usePathname } from "next/navigation";
import { LogOut, Mail, User2 } from "lucide-react";

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
import { RoleBadge } from "@/components/shared/RoleBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import type { Role } from "@/types";

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
  const user = data?.user as
    | { name?: string | null; email?: string | null; image?: string | null; role?: string }
    | undefined;

  async function signOut() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-6" />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          {pathname !== "/" ? (
            <nav className="text-sm text-muted-foreground" aria-label="Current page">
              <span className="font-medium text-foreground">{titleForPath(pathname)}</span>
            </nav>
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex shrink-0 items-center gap-2 rounded-lg p-1.5 outline-none ring-offset-background hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Account menu"
          >
            <UserAvatar name={user?.name ?? user?.email ?? "?"} image={user?.image} className="size-8" />
            <span className="hidden max-w-[140px] truncate text-sm font-medium sm:inline">{user?.name ?? "Account"}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 rounded-2xl p-0">
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <UserAvatar name={user?.name ?? user?.email ?? "?"} image={user?.image} className="size-11 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <User2 className="size-3.5 text-muted-foreground" />
                      <p className="truncate text-xl font-semibold leading-tight">{user?.name ?? "Account"}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="size-3.5 shrink-0" />
                      <p className="truncate">{user?.email ?? "No email"}</p>
                    </div>
                  </div>
                </div>
                {user?.role ? (
                  <div className="rounded-xl bg-muted/50 p-2">
                    <RoleBadge role={user.role as Role} />
                  </div>
                ) : null}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void signOut()}
              className="m-2 rounded-lg text-base font-medium text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
