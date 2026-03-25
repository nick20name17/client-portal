import { apiClient } from "@/api/client";
import type { Project, ProjectMember } from "./queries";

export type CreateProjectBody = {
    name: string;
    description?: string;
    repoUrl: string;
};

export type UpdateProjectBody = Partial<CreateProjectBody>;

export const createProject = (body: CreateProjectBody) =>
    apiClient.post<Project>("/api/projects", body);

export const updateProject = (id: number, body: UpdateProjectBody) =>
    apiClient.patch<Project>(`/api/projects/${id}`, body);

export const deleteProject = (id: number) =>
    apiClient.delete<void>(`/api/projects/${id}`);

export const addProjectMember = (projectId: number, userId: string) =>
    apiClient.post<ProjectMember>(`/api/projects/${projectId}/members`, { userId });

export const removeProjectMember = (projectId: number, userId: string) =>
    apiClient.delete<void>(`/api/projects/${projectId}/members/${userId}`);
