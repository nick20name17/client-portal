import type { InferSchema } from "@/utils/typebox";
import { Type } from "@sinclair/typebox";
import { t } from "elysia";

const commentRow = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  fileId: t.Number(),
  versionId: t.Union([t.Number(), t.Null()]),
  authorId: t.String(),
  parentId: t.Union([t.Number(), t.Null()]),
  body: t.String(),
  resolved: t.Boolean(),
  resolvedById: t.Union([t.String(), t.Null()]),
  resolvedAt: t.Union([t.Date(), t.Null()]),
  anchor: t.Any(),
  deletedAt: t.Union([t.Date(), t.Null()]),
  createdAt: t.Date(),
  updatedAt: t.Date(),
});

const userPublic = Type.Object({
  id: Type.String(),
  name: Type.String(),
  email: Type.String(),
  role: Type.String(),
  image: Type.Union([Type.String(), Type.Null()]),
});

const tagChip = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  color: Type.String(),
});

/** Nested comment thread for list API (TypeScript shape; OpenAPI uses listResponse) */
export const CommentRichSchema = Type.Recursive((This) =>
  Type.Object({
    id: Type.Number(),
    projectId: Type.Number(),
    fileId: Type.Number(),
    versionId: Type.Union([Type.Number(), Type.Null()]),
    authorId: Type.String(),
    parentId: Type.Union([Type.Number(), Type.Null()]),
    body: Type.String(),
    resolved: Type.Boolean(),
    resolvedById: Type.Union([Type.String(), Type.Null()]),
    resolvedAt: Type.Union([Type.Date(), Type.Null()]),
    anchor: Type.Any(),
    deletedAt: Type.Union([Type.Date(), Type.Null()]),
    createdAt: Type.Date(),
    updatedAt: Type.Date(),
    author: userPublic,
    resolvedBy: Type.Union([userPublic, Type.Null()]),
    tags: Type.Array(tagChip),
    replies: Type.Array(This),
  }),
);

export const CommentModelSchema = {
  projectParams: t.Object({ id: t.Numeric() }),
  commentParams: t.Object({ id: t.Numeric() }),
  tagParams: t.Object({
    id: t.Numeric(),
    tagId: t.Numeric(),
  }),
  listQuery: t.Object({
    fileId: t.Optional(t.Numeric()),
    versionId: t.Optional(t.Numeric()),
    versionIdUpperBound: t.Optional(t.Numeric()),
    resolved: t.Optional(t.String()),
  }),
  create: t.Object({
    fileId: t.Number(),
    versionId: t.Number(),
    parentId: t.Optional(t.Union([t.Number(), t.Null()])),
    body: t.String({ minLength: 1 }),
    anchor: t.Any(),
  }),
  patch: t.Object({
    body: t.Optional(t.String({ minLength: 1 })),
    resolved: t.Optional(t.Boolean()),
    anchor: t.Optional(t.Nullable(t.Any())),
  }),
  tagBody: t.Object({ tagId: t.Number() }),
  select: commentRow,
  /** Enriched threads; loose schema for Elysia/OpenAPI (recursive tree) */
  listResponse: t.Array(t.Any()),
  forbidden: t.Object({ error: t.Literal("Forbidden") }),
  notFound: t.Object({ error: t.Literal("Not found") }),
  invalidFile: t.Object({ error: t.Literal("Invalid fileId") }),
  invalidVersion: t.Object({ error: t.Literal("Invalid versionId") }),
  invalidParent: t.Object({ error: t.Literal("Invalid parentId") }),
  invalidTag: t.Object({ error: t.Literal("Invalid tagId") }),
  rateLimited: t.Object({ error: t.Literal("Too many requests") }),
  deleteResponse: t.Object({
    ok: t.Literal(true),
    id: t.Optional(t.Number()),
  }),
  tagOk: t.Object({ ok: t.Literal(true) }),
} as const;

export type CommentModel = InferSchema<typeof CommentModelSchema>;
