"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, FolderKanban, Home, Tags, Users } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const mainNav: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/projects", label: "Projects", icon: FolderKanban },
];

const adminNav: NavItem[] = [
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/users", label: "Users", icon: Users },
  { href: "/tags", label: "Tags", icon: Tags },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data } = authClient.useSession();
  const role = (data?.user as { role?: string } | undefined)?.role;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-2 py-3">
        <Link href="/" className="flex items-center gap-2 rounded-md px-2 py-1.5 font-semibold text-sidebar-foreground">
          <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-sm">
            HR
          </span>
          <span className="group-data-[collapsible=icon]:hidden">HTML Review</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))}>
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {role === "admin" ? (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}>
                      <Link href={item.href}>
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
