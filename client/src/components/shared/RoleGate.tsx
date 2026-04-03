import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";
import type { Role } from "@/types";

export function RoleGate({
  allow,
  children,
}: {
  allow: Role[];
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const { data, isPending } = authClient.useSession();
  const role = (data?.user as { role?: Role } | undefined)?.role;

  useEffect(() => {
    if (!isPending && role && !allow.includes(role)) {
      void navigate({ to: "/", replace: true });
    }
  }, [allow, isPending, role, navigate]);

  if (isPending || !role) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">Loading…</div>
    );
  }

  if (!allow.includes(role)) {
    return null;
  }

  return <>{children}</>;
}
