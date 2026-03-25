import { apiClient } from "@/api/client";
import type { Comment, Reply } from "./queries";

export type CreateCommentBody = {
    content: string;
    cssSelector?: string;
    anchorJson?: Record<string, unknown>;
};

export const createComment = (
    projectId: number,
    fileId: number,
    body: CreateCommentBody,
) =>
    apiClient.post<Comment>(
        `/api/projects/${projectId}/files/${fileId}/comments`,
        body,
    );

export const updateComment = (id: number, content: string) =>
    apiClient.patch<Comment>(`/api/comments/${id}`, { content });

export const deleteComment = (id: number) =>
    apiClient.delete<void>(`/api/comments/${id}`);

export const createReply = (commentId: number, content: string) =>
    apiClient.post<Reply>(`/api/comments/${commentId}/replies`, { content });

export const updateReply = (id: number, content: string) =>
    apiClient.patch<Reply>(`/api/replies/${id}`, { content });

export const deleteReply = (id: number) =>
    apiClient.delete<void>(`/api/replies/${id}`);
