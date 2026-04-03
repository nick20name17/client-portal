import type { Comment } from "@/types";
import { apiClient } from "../client";
import type { CommentsParams, CreateCommentPayload, PatchCommentPayload } from "./schema";

export const commentsService = {
  getAll: async (projectId: string, params: CommentsParams = {}) => {
    const { data } = await apiClient.get<Comment[]>(`/projects/${projectId}/comments`, {
      params: {
        ...(params.fileId && { fileId: params.fileId }),
        ...(params.versionIdUpperBound && { versionIdUpperBound: params.versionIdUpperBound }),
        ...(params.resolved && { resolved: params.resolved }),
      },
    });
    return data;
  },

  create: async (projectId: string, payload: CreateCommentPayload) => {
    const { data } = await apiClient.post<Comment>(`/projects/${projectId}/comments`, payload);
    return data;
  },

  patch: async (id: number, payload: PatchCommentPayload) => {
    const { data } = await apiClient.patch<Comment>(`/comments/${id}`, payload);
    return data;
  },

  delete: async (id: number) => {
    const { data } = await apiClient.delete<{ ok: true }>(`/comments/${id}`);
    return data;
  },

  addTag: async (commentId: number, tagId: number) => {
    const { data } = await apiClient.post<{ ok: true }>(`/comments/${commentId}/tags`, { tagId });
    return data;
  },

  removeTag: async (commentId: number, tagId: number) => {
    const { data } = await apiClient.delete<{ ok: true }>(`/comments/${commentId}/tags/${tagId}`);
    return data;
  },
};
