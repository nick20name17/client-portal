import { apiClient } from "@/api/client";
import type { ProjectFile } from "./queries";

export const addFile = (projectId: number, path: string) =>
    apiClient.post<ProjectFile>(`/api/projects/${projectId}/files`, { path });

export const syncFilesFromGithub = (projectId: number) =>
    apiClient.post<ProjectFile[]>(`/api/projects/${projectId}/files/sync`);
