"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { Company } from "@/types";

export function useCompanies(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["companies"],
    queryFn: () => api<Company[]>("/companies"),
    enabled: options?.enabled !== false,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) => api<Company>("/companies", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api<Company>(`/companies/${id}`, { method: "PATCH", json: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }),
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/companies/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }),
  });
}
