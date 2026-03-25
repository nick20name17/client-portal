import { apiClient } from "@/api/client";

export type Reply = {
    id: number;
    commentId: number;
    authorId: string;
    content: string;
    createdAt: string;
    updatedAt: string;
};

export type Comment = {
    id: number;
    fileId: number;
    authorId: string;
    cssSelector: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    replies: Reply[];
};

export const commentKeys = {
    all: (projectId: number, fileId: number) =>
        ["projects", projectId, "files", fileId, "comments"] as const,
};

export const commentsQueryOptions = (projectId: number, fileId: number) => ({
    queryKey: commentKeys.all(projectId, fileId),
    queryFn: () =>
        apiClient.get<Comment[]>(
            `/api/projects/${projectId}/files/${fileId}/comments`,
        ),
});
