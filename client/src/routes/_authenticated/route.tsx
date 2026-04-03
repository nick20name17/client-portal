import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { DashboardShell } from "@/components/layout/DashboardShell";
import { authClient } from "@/lib/auth-client";

const SESSION_QUERY = {
  queryKey: ["session"] as const,
  queryFn: () => authClient.getSession(),
  staleTime: 5 * 60 * 1000,
};

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(SESSION_QUERY);
    if (!session?.data?.user) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="min-h-screen">
      <DashboardShell>
        <Outlet />
      </DashboardShell>
    </div>
  );
}
