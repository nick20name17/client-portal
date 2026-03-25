import { apiClient } from "@/api/client";

export type Project = {
    id: number;
    name: string;
    description: string | null;
    repoUrl: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
};

export type ProjectMember = {
    id: number;
    projectId: number;
    userId: string;
    addedAt: string;
};

export const projectKeys = {
    all: ["projects"] as const,
    detail: (id: number) => ["projects", id] as const,
};

export const projectsQueryOptions = () => ({
    queryKey: projectKeys.all,
    queryFn: () => apiClient.get<Project[]>("/api/projects"),
});

export const projectQueryOptions = (id: number) => ({
    queryKey: projectKeys.detail(id),
    queryFn: () => apiClient.get<Project>(`/api/projects/${id}`),
});
