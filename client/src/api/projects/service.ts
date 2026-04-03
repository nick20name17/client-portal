import type { Project, ProjectFile, ProjectMemberRow } from "@/types";
import { apiClient } from "../client";
import type { AddMemberPayload, CreateProjectPayload, UpdateProjectPayload } from "./schema";

export const projectsService = {
  getAll: async () => {
    const { data } = await apiClient.get<Project[]>("/projects");
    return data;
  },

  getById: async (id: string) => {
    const { data } = await apiClient.get<Project>(`/projects/${id}`);
    return data;
  },

  getFiles: async (projectId: string) => {
    const { data } = await apiClient.get<ProjectFile[]>(`/projects/${projectId}/files`);
    return data;
  },

  getMembers: async (projectId: number) => {
    const { data } = await apiClient.get<ProjectMemberRow[]>(`/projects/${projectId}/members`);
    return data;
  },

  create: async (payload: CreateProjectPayload) => {
    const { data } = await apiClient.post<Project>("/projects", payload);
    return data;
  },

  update: async (id: number, payload: UpdateProjectPayload) => {
    const { data } = await apiClient.patch<Project>(`/projects/${id}`, payload);
    return data;
  },

  delete: async (id: number) => {
    const { data } = await apiClient.delete<{ ok: true }>(`/projects/${id}`);
    return data;
  },

  syncFiles: async (projectId: string) => {
    const { data } = await apiClient.post<{ synced: number; paths: string[] }>(
      `/projects/${projectId}/files/sync`,
    );
    return data;
  },

  addMember: async (projectId: number, payload: AddMemberPayload) => {
    const { data } = await apiClient.post<ProjectMemberRow>(
      `/projects/${projectId}/members`,
      payload,
    );
    return data;
  },

  removeMember: async (projectId: number, userId: string) => {
    const { data } = await apiClient.delete<{ ok: true }>(
      `/projects/${projectId}/members/${userId}`,
    );
    return data;
  },
};
