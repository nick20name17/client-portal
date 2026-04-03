import { user } from "@/db/schema/auth";
import type { InferSchema } from "@/utils/typebox";
import { createSelectSchema } from "drizzle-typebox";
import { t } from "elysia";

const userSelect = createSelectSchema(user);

export const UserModelSchema = {
  params: t.Object({ id: t.String() }),
  query: t.Object({
    role: t.Optional(t.String()),
    companyId: t.Optional(t.Numeric()),
  }),
  create: t.Object({
    name: t.String({ minLength: 1 }),
    email: t.String({ format: "email" }),
    role: t.String(),
    companyId: t.Optional(t.Union([t.Number(), t.Null()])),
    tmpPassword: t.String({ minLength: 12, pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+" }),
  }),
  update: t.Object({
    role: t.Optional(t.String()),
    companyId: t.Optional(t.Union([t.Number(), t.Null()])),
  }),
  select: userSelect,
  listResponse: t.Array(userSelect),
  notFound: t.Object({ error: t.Literal("Not found") }),
  duplicateEmail: t.Object({
    error: t.Literal("User with this email already exists"),
  }),
  invalidCompany: t.Object({ error: t.Literal("Invalid companyId") }),
  adminCompany: t.Object({
    error: t.Literal("Admin must not be tied to a company"),
  }),
  ok: t.Object({ ok: t.Literal(true) }),
} as const;

export type UserModel = InferSchema<typeof UserModelSchema>;
