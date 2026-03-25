"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const { data: session, isPending } = authClient.useSession();

    useEffect(() => {
        if (!isPending && !session) {
            router.replace("/sign-in");
        }
    }, [isPending, session, router]);

    if (isPending) {
        return (
            <div className="flex min-h-full flex-1 items-center justify-center">
                <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
        );
    }

    if (!session) return null;

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="border-border/60 bg-background min-w-0 border shadow-sm">
                <AppHeader />
                <main
                    className="flex min-h-0 flex-1 flex-col overflow-y-auto"
                    id="main-content"
                >
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}
