import { apiClient } from "@/api/client";

export type CommentAuthor = {
    id: string;
    name: string;
    image: string | null;
};

export type Reply = {
    id: number;
    commentId: number;
    authorId: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    author: CommentAuthor;
};

export type Comment = {
    id: number;
    fileId: number;
    authorId: string;
    cssSelector: string | null;
    anchorJson: Record<string, unknown> | null;
    content: string;
    createdAt: string;
    updatedAt: string;
    author: CommentAuthor;
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
