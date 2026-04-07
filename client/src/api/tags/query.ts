import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CreateTagPayload, UpdateTagPayload } from "./schema";
import { tagsService } from "./service";

const TAG_KEYS = {
  all: () => ["tags"] as const,
};

const tagsQuery = () =>
  queryOptions({ queryKey: TAG_KEYS.all(), queryFn: tagsService.getAll });

export function useTags() {
  return useQuery(tagsQuery());
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTagPayload) => tagsService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: TAG_KEYS.all() }),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number } & UpdateTagPayload) =>
      tagsService.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: TAG_KEYS.all() }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => tagsService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: TAG_KEYS.all() }),
  });
}
