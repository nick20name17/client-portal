"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { DashboardStats } from "@/types";

export function useStats(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["stats"],
    queryFn: () => api<DashboardStats>("/stats"),
    enabled: options?.enabled !== false,
  });
}
