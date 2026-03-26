import { t } from "elysia";

export const SseModelSchema = {
  params: t.Object({ id: t.String({ format: "uuid" }) }),
  forbidden: t.Object({ error: t.Literal("Forbidden") }),
} as const;
