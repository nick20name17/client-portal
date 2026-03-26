import type { InferSchema } from "@/utils/typebox";
import { t } from "elysia";

const commentRow = t.Object({
  id: t.String({ format: "uuid" }),
  projectId: t.String({ format: "uuid" }),
  fileId: t.String({ format: "uuid" }),
  authorId: t.String(),
  parentId: t.Union([t.String({ format: "uuid" }), t.Null()]),
  body: t.String(),
  resolved: t.Boolean(),
  resolvedById: t.Union([t.String(), t.Null()]),
  resolvedAt: t.Union([t.Date(), t.Null()]),
  anchor: t.Any(),
  deletedAt: t.Union([t.Date(), t.Null()]),
  createdAt: t.Date(),
  updatedAt: t.Date(),
});

export const CommentModelSchema = {
  projectParams: t.Object({ id: t.String({ format: "uuid" }) }),
  commentParams: t.Object({ id: t.String({ format: "uuid" }) }),
  tagParams: t.Object({
    id: t.String({ format: "uuid" }),
    tagId: t.String({ format: "uuid" }),
  }),
  listQuery: t.Object({
    fileId: t.Optional(t.String({ format: "uuid" })),
    resolved: t.Optional(t.String()),
  }),
  create: t.Object({
    fileId: t.String({ format: "uuid" }),
    parentId: t.Optional(t.Union([t.String({ format: "uuid" }), t.Null()])),
    body: t.String({ minLength: 1 }),
    anchor: t.Any(),
  }),
  patch: t.Object({
    body: t.Optional(t.String({ minLength: 1 })),
    resolved: t.Optional(t.Boolean()),
  }),
  tagBody: t.Object({ tagId: t.String({ format: "uuid" }) }),
  select: commentRow,
  listResponse: t.Array(commentRow),
  forbidden: t.Object({ error: t.Literal("Forbidden") }),
  notFound: t.Object({ error: t.Literal("Not found") }),
  invalidFile: t.Object({ error: t.Literal("Invalid fileId") }),
  invalidParent: t.Object({ error: t.Literal("Invalid parentId") }),
  invalidTag: t.Object({ error: t.Literal("Invalid tagId") }),
  rateLimited: t.Object({ error: t.Literal("Too many requests") }),
  deleteResponse: t.Object({
    ok: t.Literal(true),
    id: t.Optional(t.String({ format: "uuid" })),
  }),
  tagOk: t.Object({ ok: t.Literal(true) }),
} as const;

export type CommentModel = InferSchema<typeof CommentModelSchema>;
