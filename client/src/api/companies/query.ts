import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CreateCompanyPayload, UpdateCompanyPayload } from "./schema";
import { companiesService } from "./service";

const COMPANY_KEYS = {
  all: () => ["companies"] as const,
};

const companiesQuery = () =>
  queryOptions({ queryKey: COMPANY_KEYS.all(), queryFn: companiesService.getAll });

export function useCompanies(options?: { enabled?: boolean }) {
  return useQuery({
    ...companiesQuery(),
    enabled: options?.enabled !== false,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCompanyPayload) => companiesService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPANY_KEYS.all() }),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      companiesService.update(id, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPANY_KEYS.all() }),
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => companiesService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPANY_KEYS.all() }),
  });
}
