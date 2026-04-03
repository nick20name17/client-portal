import type { InferSchema } from "@/utils/typebox";
import { t } from "elysia";

export const CompanyModelSchema = {
  params: t.Object({ id: t.Numeric() }),
  create: t.Object({ name: t.String({ minLength: 1 }) }),
  update: t.Object({ name: t.String({ minLength: 1 }) }),
  select: t.Object({
    id: t.Number(),
    name: t.String(),
    createdAt: t.Date(),
  }),
  listResponse: t.Array(
    t.Object({
      id: t.Number(),
      name: t.String(),
      createdAt: t.Date(),
    }),
  ),
  notFound: t.Object({ error: t.Literal("Not found") }),
  ok: t.Object({ ok: t.Literal(true) }),
} as const;

export type CompanyModel = InferSchema<typeof CompanyModelSchema>;
