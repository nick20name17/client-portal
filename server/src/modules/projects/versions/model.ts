import type { InferSchema } from "@/utils/typebox";
import { t } from "elysia";

const fileVersionRow = t.Object({
  id: t.Number(),
  fileId: t.Number(),
  commitSha: t.String(),
  commitMessage: t.Union([t.String(), t.Null()]),
  commitAuthor: t.Union([t.String(), t.Null()]),
  commitDate: t.Union([t.Date(), t.Null()]),
  label: t.Union([t.String(), t.Null()]),
  createdById: t.Union([t.String(), t.Null()]),
  createdAt: t.Date(),
});

export const FileVersionModelSchema = {
  params: t.Object({
    id: t.Numeric(),
    fileId: t.Numeric(),
  }),
  versionParams: t.Object({
    id: t.Numeric(),
    fileId: t.Numeric(),
    versionId: t.Numeric(),
  }),
  create: t.Object({
    commitSha: t.Optional(t.String({ minLength: 1 })),
    label: t.Optional(t.Union([t.String(), t.Null()])),
  }),
  select: fileVersionRow,
  listResponse: t.Array(fileVersionRow),
  forbidden: t.Object({ error: t.Literal("Forbidden") }),
  notFound: t.Object({ error: t.Literal("Not found") }),
  conflict: t.Object({ error: t.Literal("Version already exists") }),
  hasComments: t.Object({ error: t.Literal("Version has comments") }),
  ok: t.Object({ ok: t.Literal(true) }),
  checkNewVersionsResponse: t.Array(
    t.Object({
      fileId: t.Number(),
      filePath: t.String(),
      latestCommitSha: t.String(),
      latestCommitDate: t.Union([t.Date(), t.Null()]),
    }),
  ),
} as const;

export type FileVersionModel = InferSchema<typeof FileVersionModelSchema>;
