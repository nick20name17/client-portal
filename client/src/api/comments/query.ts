import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Comment, CommentsParams, CreateCommentPayload, PatchCommentPayload, Tag } from "./schema";
import type { User } from "@/types";
import { commentsService } from "./service";

export const COMMENT_KEYS = {
  all: (projectId: string) => ["comments", projectId] as const,
  list: (projectId: string, params: CommentsParams) =>
    ["comments", projectId, params] as const,
};

export const commentsQuery = (projectId: string, params: CommentsParams = {}) =>
  queryOptions({
    queryKey: COMMENT_KEYS.list(projectId, params),
    queryFn: () => commentsService.getAll(projectId, params),
    enabled: !!projectId && !!params.fileId,
  });

export function useComments(
  projectId: string | undefined,
  fileId: string | undefined,
  versionIdUpperBound?: number | null,
  resolved?: "true" | "false",
) {
  return useQuery({
    ...commentsQuery(projectId ?? "", { fileId, versionIdUpperBound, resolved }),
    enabled: !!projectId && !!fileId,
  });
}

type CreateCommentVars = CreateCommentPayload & { _tempId?: number; _tags?: Tag[] };

export function useCreateComment(projectId: string | undefined, currentUser?: User | null) {
  const qc = useQueryClient();
  const key = COMMENT_KEYS.all(projectId ?? "");
  return useMutation({
    mutationFn: ({ _tempId: _, _tags: __, ...payload }: CreateCommentVars) =>
      commentsService.create(projectId!, payload),
    onMutate: async ({ _tempId, _tags, ...payload }) => {
      await qc.cancelQueries({ queryKey: key });
      const snapshots = qc.getQueriesData<Comment[]>({ queryKey: key });
      const tempId = _tempId ?? -Date.now();
      const tempComment: Comment = {
        id: tempId,
        projectId: Number(projectId ?? 0),
        fileId: payload.fileId,
        versionId: payload.versionId,
        authorId: currentUser?.id ?? "",
        author: currentUser ?? undefined,
        parentId: payload.parentId ?? null,
        replies: [],
        body: payload.body,
        resolved: false,
        resolvedAt: null,
        anchor: payload.anchor,
        tags: _tags ?? [],
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      qc.setQueriesData<Comment[]>({ queryKey: key }, (old) => {
        if (!old) return old;
        if (payload.parentId) {
          return old.map((c) =>
            c.id === payload.parentId
              ? { ...c, replies: [...(c.replies ?? []), tempComment] }
              : c
          );
        }
        return [...old, tempComment];
      });
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshots) {
        for (const [k, data] of ctx.snapshots) qc.setQueryData(k, data);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function usePatchComment(projectId: string | undefined) {
  const qc = useQueryClient();
  const key = COMMENT_KEYS.all(projectId ?? "");
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number } & PatchCommentPayload) =>
      commentsService.patch(id, patch),
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const snapshots = qc.getQueriesData<Comment[]>({ queryKey: key });
      const optimistic = patch.body !== undefined
        ? { ...patch, updatedAt: new Date().toISOString() }
        : patch;
      qc.setQueriesData<Comment[]>({ queryKey: key }, (old) =>
        old?.map((c) => {
          if (c.id === id) return { ...c, ...optimistic };
          return { ...c, replies: c.replies?.map((r) => r.id === id ? { ...r, ...optimistic } : r) };
        })
      );
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshots) {
        for (const [k, data] of ctx.snapshots) qc.setQueryData(k, data);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteComment(projectId: string | undefined) {
  const qc = useQueryClient();
  const key = COMMENT_KEYS.all(projectId ?? "");
  return useMutation({
    mutationFn: (id: number) => commentsService.delete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const snapshots = qc.getQueriesData<Comment[]>({ queryKey: key });
      qc.setQueriesData<Comment[]>({ queryKey: key }, (old) =>
        old
          ?.filter((c) => c.id !== id)
          .map((c) => ({ ...c, replies: c.replies?.filter((r) => r.id !== id) }))
      );
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshots) {
        for (const [k, data] of ctx.snapshots) qc.setQueryData(k, data);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useAddCommentTag(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, tagId }: { commentId: number; tagId: number }) =>
      commentsService.addTag(commentId, tagId),
    onSettled: () =>
      qc.invalidateQueries({ queryKey: COMMENT_KEYS.all(projectId ?? "") }),
  });
}

export function useRemoveCommentTag(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, tagId }: { commentId: number; tagId: number }) =>
      commentsService.removeTag(commentId, tagId),
    onSettled: () =>
      qc.invalidateQueries({ queryKey: COMMENT_KEYS.all(projectId ?? "") }),
  });
}
