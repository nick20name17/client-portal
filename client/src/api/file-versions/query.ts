import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CreateFileVersionPayload } from "./schema";
import { fileVersionsService } from "./service";

export const FILE_VERSION_KEYS = {
  all: (projectId: string, fileId: string) => ["fileVersions", projectId, fileId] as const,
  checkNew: (projectId: string) => ["fileVersions", "checkNew", projectId] as const,
};

const fileVersionsQuery = (projectId: string, fileId: string) =>
  queryOptions({
    queryKey: FILE_VERSION_KEYS.all(projectId, fileId),
    queryFn: () => fileVersionsService.getAll(projectId, fileId),
    enabled: !!projectId && !!fileId,
    refetchInterval: 30 * 60 * 1000,
  });

export function useFileVersions(projectId: string | undefined, fileId: string | undefined) {
  return useQuery({
    ...fileVersionsQuery(projectId ?? "", fileId ?? ""),
    enabled: !!projectId && !!fileId,
  });
}

function useCreateFileVersion(projectId: string | undefined, fileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFileVersionPayload) => {
      if (!projectId || !fileId) throw new Error("projectId and fileId are required");
      return fileVersionsService.create(projectId, fileId, payload);
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: FILE_VERSION_KEYS.all(projectId ?? "", fileId ?? "") }),
  });
}

export function useDeleteFileVersion(projectId: string | undefined, fileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: number) => {
      if (!projectId || !fileId) throw new Error("projectId and fileId are required");
      return fileVersionsService.delete(projectId, fileId, versionId);
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: FILE_VERSION_KEYS.all(projectId ?? "", fileId ?? "") }),
  });
}

export function useCheckNewVersions(projectId: string | undefined) {
  return useQuery({
    queryKey: FILE_VERSION_KEYS.checkNew(projectId ?? ""),
    queryFn: () => fileVersionsService.checkNewVersions(projectId!),
    enabled: !!projectId,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useSyncFileVersions(projectId: string | undefined, fileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!projectId || !fileId) throw new Error("projectId and fileId are required");
      return fileVersionsService.sync(projectId, fileId);
    },
    onSuccess: (data) => {
      qc.setQueryData(FILE_VERSION_KEYS.all(projectId ?? "", fileId ?? ""), data);
    },
  });
}
