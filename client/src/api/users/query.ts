import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CreateUserPayload, UpdateUserPayload, UsersParams } from "./schema";
import { usersService } from "./service";

export const USER_KEYS = {
  all: () => ["users"] as const,
  list: (params: UsersParams) => ["users", params.role, params.companyId] as const,
};

export const usersQuery = (params: UsersParams = {}) =>
  queryOptions({
    queryKey: USER_KEYS.list(params),
    queryFn: () => usersService.getAll(params),
  });

export function useUsers(params?: UsersParams, options?: { enabled?: boolean }) {
  return useQuery({
    ...usersQuery(params),
    enabled: options?.enabled !== false,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => usersService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: USER_KEYS.all() }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & UpdateUserPayload) =>
      usersService.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: USER_KEYS.all() }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: USER_KEYS.all() }),
  });
}
