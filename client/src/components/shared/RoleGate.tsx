"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import type { Role } from "@/types";

export function RoleGate({
  allow,
  children,
}: {
  allow: Role[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data, isPending } = authClient.useSession();
  const role = (data?.user as { role?: Role } | undefined)?.role;

  useEffect(() => {
    if (!isPending && role && !allow.includes(role)) {
      router.replace("/");
    }
  }, [allow, isPending, role, router]);

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
