
import { Building2, FolderKanban, Tags, Users } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";
import { RoleBadge } from "@/components/shared/RoleBadge";
import type { Role } from "@/types";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg?: string;
  adminOnly?: boolean;
};

const mainNav: NavItem[] = [
  { href: "/", label: "Projects", icon: FolderKanban, iconBg: "bg-emerald-500" },
];

const adminNav: NavItem[] = [
  { href: "/companies", label: "Companies", icon: Building2, iconBg: "bg-blue-500", adminOnly: true },
  { href: "/users", label: "Users", icon: Users, iconBg: "bg-indigo-500", adminOnly: true },
  { href: "/tags", label: "Tags", icon: Tags, iconBg: "bg-violet-500", adminOnly: true },
];

function ColoredNavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      to={item.href}
      className={cn(
        "group relative flex h-[32px] items-center gap-2.5 rounded-md px-2.5 text-[13px]",
        "transition-[background-color,color] duration-150",
        isActive
          ? "bg-black/6 font-semibold text-foreground dark:bg-white/8"
          : "font-medium text-foreground/75 hover:bg-black/4 hover:text-foreground dark:hover:bg-white/4 dark:hover:text-foreground",
        "active:scale-[0.98]",
      )}
    >
      {/* Active indicator dot */}
      {isActive ? (
        <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
      ) : null}
      {item.iconBg ? (
        <div
          className={cn(
            "flex size-[20px] shrink-0 items-center justify-center rounded-[5px] text-white transition-transform duration-150 group-hover:scale-105",
            item.iconBg,
          )}
        >
          <item.icon className="size-[12px]" />
        </div>
      ) : (
        <div className="flex size-[20px] shrink-0 items-center justify-center">
          <item.icon className={cn("size-[15px]", isActive ? "text-foreground/70" : "text-text-tertiary")} />
        </div>
      )}
      <span className="flex-1 truncate">{item.label}</span>
    </Link>
  );
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data } = authClient.useSession();
  const user = data?.user as
    | { id?: string; name?: string | null; email?: string | null; image?: string | null; role?: string }
    | undefined;
  const role = user?.role;

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function signOut() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  return (
    <Sidebar collapsible="offcanvas" className="border-none bg-transparent">
      {/* Logo / workspace header */}
      <SidebarHeader className="p-0">
        <div className="flex h-[52px] items-center gap-2.5 px-4">
          {/* Refined icon mark — two overlapping brackets */}
          <div className="flex size-[28px] shrink-0 items-center justify-center rounded-[7px] bg-primary shadow-sm shadow-primary/30 text-primary-foreground">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M4.5 2L1.5 7.5L4.5 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10.5 2L13.5 7.5L10.5 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-[13px] font-bold tracking-[-0.01em] text-foreground">HTML Review</span>
        </div>
      </SidebarHeader>

      {/* Nav */}
      <SidebarContent className="flex flex-col gap-0 overflow-y-auto overflow-x-hidden px-0">
        <div className="flex flex-1 flex-col px-3">
          {/* Main nav */}
          <div className="flex flex-col gap-px pt-1">
            {mainNav.map((item) => (
              <ColoredNavLink key={item.href} item={item} isActive={isActive(item.href)} />
            ))}
          </div>

          {/* Admin nav */}
          {role === "admin" ? (
            <>
              <div className="my-2 border-t border-black/6 dark:border-white/6" />
              <div className="flex flex-col gap-px">
                {adminNav.map((item) => (
                  <ColoredNavLink key={item.href} item={item} isActive={isActive(item.href)} />
                ))}
              </div>
            </>
          ) : null}

          <div className="flex-1" />
        </div>
      </SidebarContent>

      {/* User footer */}
      <SidebarFooter className="p-0">
        <div className="border-t border-black/6 px-3 py-2 dark:border-white/6">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-black/4 outline-none dark:hover:bg-white/4">
                <UserAvatar
                  name={user?.name ?? user?.email ?? "?"}
                  image={user?.image}
                  userId={user?.id}
                  className="size-6 shrink-0"
                />
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate font-medium text-foreground">
                    {user?.name ?? "Account"}
                  </p>
                  {user?.email ? (
                    <p className="truncate text-[11px] text-text-tertiary">{user.email}</p>
                  ) : null}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56 p-1">
              <DropdownMenuLabel className="px-2 py-1.5 font-normal">
                <div className="flex items-center gap-2.5">
                  <UserAvatar
                    name={user?.name ?? user?.email ?? "?"}
                    image={user?.image}
                    userId={user?.id}
                    className="size-7 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-foreground leading-tight">
                      {user?.name ?? "Account"}
                    </p>
                    {user?.email ? (
                      <p className="truncate text-[11px] text-text-tertiary leading-tight mt-0.5">{user.email}</p>
                    ) : null}
                  </div>
                  {user?.role ? <RoleBadge role={user.role as Role} /> : null}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => void signOut()}
                variant="destructive"
                className="text-[13px]"
              >
                <LogOut className="size-3.5" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
