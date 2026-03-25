import { apiClient } from "@/api/client";

export type ProjectFile = {
    id: number;
    projectId: number;
    path: string;
    githubUrl: string;
    createdAt: string;
};

export const fileKeys = {
    all: (projectId: number) => ["projects", projectId, "files"] as const,
    detail: (projectId: number, fileId: number) =>
        ["projects", projectId, "files", fileId] as const,
};

export const filesQueryOptions = (projectId: number) => ({
    queryKey: fileKeys.all(projectId),
    queryFn: () => apiClient.get<ProjectFile[]>(`/api/projects/${projectId}/files`),
});

export const fileQueryOptions = (projectId: number, fileId: number) => ({
    queryKey: fileKeys.detail(projectId, fileId),
    queryFn: () => apiClient.get<ProjectFile>(`/api/projects/${projectId}/files/${fileId}`),
});
