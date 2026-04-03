import { tags } from "@/db/schema/tags";
import type { InferSchema } from "@/utils/typebox";
import { createSelectSchema } from "drizzle-typebox";
import { t } from "elysia";

const tagSelect = createSelectSchema(tags);

export const TagModelSchema = {
  params: t.Object({ id: t.Numeric() }),
  create: t.Object({
    name: t.String({ minLength: 1 }),
    color: t.String({ minLength: 1 }),
  }),
  update: t.Object({
    name: t.Optional(t.String({ minLength: 1 })),
    color: t.Optional(t.String({ minLength: 1 })),
  }),
  select: tagSelect,
  listResponse: t.Array(tagSelect),
  notFound: t.Object({ error: t.Literal("Not found") }),
  failed: t.Object({ error: t.Literal("Failed") }),
  ok: t.Object({ ok: t.Literal(true) }),
} as const;

export type TagModel = InferSchema<typeof TagModelSchema>;
