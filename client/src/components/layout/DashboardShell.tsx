
import { useRouterState } from "@tanstack/react-router";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { AppSidebar } from "./AppSidebar";
import { Header } from "./Header";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isViewer = pathname.includes("/viewer");

  if (isViewer) {
    return <div className="flex min-h-screen flex-1 flex-col">{children}</div>;
  }

  return (
    <SidebarProvider className="bg-page-canvas h-svh overflow-hidden">
      <AppSidebar />
      <SidebarInset className="flex min-h-0 flex-col overflow-hidden bg-transparent p-0 md:p-2">
        <div className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden rounded-none shadow-sm ring-1 ring-black/4 md:rounded-xl dark:ring-white/6">
          <Header />
          <main className="flex min-h-0 flex-1 flex-col overflow-auto">
            {children}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
