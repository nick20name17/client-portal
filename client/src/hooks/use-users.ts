"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { User } from "@/types";

export function useUsers(filters?: { role?: string; companyId?: string }, options?: { enabled?: boolean }) {
  const q = new URLSearchParams();
  if (filters?.role) q.set("role", filters.role);
  if (filters?.companyId) q.set("companyId", filters.companyId);
  const suffix = q.toString() ? `?${q.toString()}` : "";

  return useQuery({
    queryKey: ["users", filters?.role, filters?.companyId],
    queryFn: () => api<User[]>(`/users${suffix}`),
    enabled: options?.enabled !== false,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      email: string;
      role: string;
      companyId?: string | null;
      tmpPassword: string;
    }) => api<User>("/users", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; role?: string; companyId?: string | null }) =>
      api<User>(`/users/${id}`, { method: "PATCH", json: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/users/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
