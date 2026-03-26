"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { Project, ProjectFile, ProjectMemberRow } from "@/types";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => api<Project[]>("/projects"),
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => api<Project>(`/projects/${id}`),
    enabled: !!id,
  });
}

export function useProjectFiles(projectId: string | undefined) {
  return useQuery({
    queryKey: ["projects", projectId, "files"],
    queryFn: () => api<ProjectFile[]>(`/projects/${projectId}/files`),
    enabled: !!projectId,
  });
}

export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: ["projects", projectId, "members"],
    queryFn: () => api<ProjectMemberRow[]>(`/projects/${projectId}/members`),
    enabled: !!projectId,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      description?: string;
      repoUrl: string;
      companyId: string;
    }) => api<Project>("/projects", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...patch
    }: {
      id: string;
      name?: string;
      description?: string | null;
      repoUrl?: string;
    }) => api<Project>(`/projects/${id}`, { method: "PATCH", json: patch }),
    onSuccess: (_, v) => {
      void qc.invalidateQueries({ queryKey: ["projects"] });
      void qc.invalidateQueries({ queryKey: ["projects", v.id] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useSyncProjectFiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      api<{ synced: number; paths: string[] }>(`/projects/${projectId}/files/sync`, { method: "POST" }),
    onSuccess: (_, projectId) => {
      void qc.invalidateQueries({ queryKey: ["projects", projectId, "files"] });
      void qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useAddProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      userId,
      role,
    }: {
      projectId: string;
      userId: string;
      role: "manager" | "client";
    }) => api<ProjectMemberRow>(`/projects/${projectId}/members`, { method: "POST", json: { userId, role } }),
    onSuccess: (_, variables) => {
      void qc.invalidateQueries({ queryKey: ["projects", variables.projectId, "members"] });
    },
  });
}

export function useRemoveProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, userId }: { projectId: string; userId: string }) =>
      api<{ ok: true }>(`/projects/${projectId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["projects", v.projectId, "members"] }),
  });
}
