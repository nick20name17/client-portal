import type { InferSchema } from "@/utils/typebox";
import { t } from "elysia";

const activityItem = t.Object({
  id: t.String({ format: "uuid" }),
  body: t.String(),
  createdAt: t.Date(),
  projectId: t.String({ format: "uuid" }),
  projectName: t.String(),
  authorName: t.String(),
});

export const StatsModelSchema = {
  response: t.Object({
    totalComments: t.Number(),
    resolvedComments: t.Number(),
    openComments: t.Number(),
    projects: t.Number(),
    users: t.Number(),
    recentActivity: t.Array(activityItem),
  }),
} as const;

export type StatsModel = InferSchema<typeof StatsModelSchema>;
