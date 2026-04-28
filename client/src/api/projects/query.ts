import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Project } from "@/types";
import type { AddMemberPayload, CreateProjectPayload, UpdateProjectPayload } from "./schema";
import { projectsService } from "./service";

const PROJECT_KEYS = {
  all: () => ["projects"] as const,
  archived: () => ["projects", "archived"] as const,
  detail: (id: string) => ["projects", id] as const,
  files: (projectId: string, versionId?: number | null) =>
    versionId
      ? (["projects", projectId, "files", { versionId }] as const)
      : (["projects", projectId, "files"] as const),
  members: (projectId: number) => ["projects", projectId, "members"] as const,
};

const projectsQuery = () =>
  queryOptions({ queryKey: PROJECT_KEYS.all(), queryFn: projectsService.getAll });

const projectQuery = (id: string) =>
  queryOptions({
    queryKey: PROJECT_KEYS.detail(id),
    queryFn: () => projectsService.getById(id),
    enabled: !!id,
  });

const projectFilesQuery = (projectId: string, versionId?: number | null) =>
  queryOptions({
    queryKey: PROJECT_KEYS.files(projectId, versionId),
    queryFn: () => projectsService.getFiles(projectId, versionId),
    enabled: !!projectId,
  });

const projectMembersQuery = (projectId: number | undefined) =>
  queryOptions({
    queryKey: PROJECT_KEYS.members(projectId ?? 0),
    queryFn: () => projectsService.getMembers(projectId!),
    enabled: !!projectId,
  });

export function useProjects() {
  return useQuery(projectsQuery());
}

export function useArchivedProjects(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: PROJECT_KEYS.archived(),
    queryFn: projectsService.getArchived,
    ...options,
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    ...projectQuery(id ?? ""),
    enabled: !!id,
  });
}

export function useProjectFiles(projectId: string | undefined, versionId?: number | null) {
  return useQuery({
    ...projectFilesQuery(projectId ?? "", versionId),
    enabled: !!projectId,
  });
}

export function useProjectMembers(projectId: number | undefined) {
  return useQuery(projectMembersQuery(projectId));
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProjectPayload) => projectsService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECT_KEYS.all() }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number } & UpdateProjectPayload) =>
      projectsService.update(id, patch),
    onSuccess: (_, v) => {
      void qc.invalidateQueries({ queryKey: PROJECT_KEYS.all() });
      void qc.invalidateQueries({ queryKey: PROJECT_KEYS.detail(String(v.id)) });
    },
  });
}

export function useArchiveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => projectsService.archive(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PROJECT_KEYS.all() });
      void qc.invalidateQueries({ queryKey: PROJECT_KEYS.archived() });
    },
  });
}

export function useUnarchiveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => projectsService.unarchive(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PROJECT_KEYS.all() });
      void qc.invalidateQueries({ queryKey: PROJECT_KEYS.archived() });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => projectsService.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PROJECT_KEYS.all() });
      void qc.invalidateQueries({ queryKey: PROJECT_KEYS.archived() });
    },
  });
}

export function useSyncProjectFiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => projectsService.syncFiles(projectId),
    onSuccess: (_, projectId) => {
      void qc.invalidateQueries({ queryKey: ["projects", projectId, "files"] });
      void qc.invalidateQueries({ queryKey: PROJECT_KEYS.all() });
    },
  });
}

export function useAddProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...payload }: { projectId: number } & AddMemberPayload) =>
      projectsService.addMember(projectId, payload),
    onSuccess: (_, v) =>
      qc.invalidateQueries({ queryKey: PROJECT_KEYS.members(v.projectId) }),
  });
}

export function useMarkProjectCommentsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, commentIds }: { projectId: string; commentIds: number[] }) =>
      projectsService.markCommentsRead(projectId, commentIds),
    onSuccess: (data, vars) => {
      if (data.marked === 0) return;
      const pid = Number(vars.projectId);
      const decrement = (list: Project[] | undefined) =>
        list?.map((p) =>
          p.id === pid && p._count
            ? {
                ...p,
                _count: {
                  ...p._count,
                  unreadComments: Math.max(0, p._count.unreadComments - data.marked),
                },
              }
            : p,
        );
      qc.setQueryData(PROJECT_KEYS.all(), decrement);
      qc.setQueryData(PROJECT_KEYS.archived(), decrement);
    },
  });
}

export function useRemoveProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, userId }: { projectId: number; userId: string }) =>
      projectsService.removeMember(projectId, userId),
    onSuccess: (_, v) =>
      qc.invalidateQueries({ queryKey: PROJECT_KEYS.members(v.projectId) }),
  });
}
