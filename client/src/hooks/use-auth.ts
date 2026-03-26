"use client";

import { authClient } from "@/lib/auth-client";

export function useAuth() {
  const { data, isPending, error, refetch } = authClient.useSession();

  return {
    session: data,
    isPending,
    error,
    refetch,
    user: data?.user ?? null,
    isAuthenticated: !!data?.user,
  };
}
