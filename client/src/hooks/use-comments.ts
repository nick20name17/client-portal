"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { Anchor, Comment, Tag } from "@/types";

export function useComments(
  projectId: string | undefined,
  fileId: string | undefined,
  resolved?: "true" | "false",
) {
  const q = new URLSearchParams();
  if (fileId) q.set("fileId", fileId);
  if (resolved) q.set("resolved", resolved);
  const suffix = q.toString() ? `?${q.toString()}` : "";

  return useQuery({
    queryKey: ["comments", projectId, fileId, resolved],
    queryFn: () => api<Comment[]>(`/projects/${projectId}/comments${suffix}`),
    enabled: !!projectId && !!fileId,
  });
}

export function useCreateComment(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      fileId: string;
      body: string;
      anchor: Anchor;
      parentId?: string | null;
    }) => api<Comment>(`/projects/${projectId}/comments`, { method: "POST", json: body }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["comments", projectId] });
    },
  });
}

export function usePatchComment(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; body?: string; resolved?: boolean }) =>
      api<Comment>(`/comments/${id}`, { method: "PATCH", json: patch }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["comments", projectId] });
    },
  });
}

export function useDeleteComment(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/comments/${id}`, { method: "DELETE" }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["comments", projectId] });
    },
  });
}

export function useAddCommentTag(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, tagId }: { commentId: string; tagId: string }) =>
      api<{ ok: true }>(`/comments/${commentId}/tags`, { method: "POST", json: { tagId } }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["comments", projectId] });
    },
  });
}

export function useRemoveCommentTag(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, tagId }: { commentId: string; tagId: string }) =>
      api<{ ok: true }>(`/comments/${commentId}/tags/${tagId}`, { method: "DELETE" }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["comments", projectId] });
    },
  });
}
