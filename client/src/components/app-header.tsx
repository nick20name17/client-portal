"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const breadcrumbMap: Record<string, string> = {
    projects: "Projects",
    files: "Files",
    admin: "Admin",
    users: "Users",
};

function getBreadcrumbs(pathname: string) {
    const segments = pathname.split("/").filter(Boolean);
    const crumbs: { label: string; href: string }[] = [];
    let path = "";

    for (const segment of segments) {
        path += `/${segment}`;
        const label =
            breadcrumbMap[segment] ??
            (segment.match(/^\d+$/) ? `#${segment}` : segment);
        crumbs.push({ label, href: path });
    }

    return crumbs;
}

export function AppHeader() {
    const pathname = usePathname();
    const crumbs = getBreadcrumbs(pathname);

    return (
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/60 px-4">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground -ml-1" />
            <Separator orientation="vertical" className="h-4" />
            <nav className="flex items-center gap-1 text-sm">
                {crumbs.map((crumb, i) => (
                    <span key={crumb.href} className="flex items-center gap-1">
                        {i > 0 && (
                            <span className="text-muted-foreground">/</span>
                        )}
                        <span
                            className={
                                i === crumbs.length - 1
                                    ? "font-medium text-foreground"
                                    : "text-muted-foreground"
                            }
                        >
                            {crumb.label}
                        </span>
                    </span>
                ))}
            </nav>
        </header>
    );
}
