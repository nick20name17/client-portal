import { protectedApiDetail } from "@/lib/api-doc";
import { authMiddleware } from "@/middleware/auth";
import { StatsModelSchema } from "./model";
import { StatsService } from "./service";
import { Elysia } from "elysia";

export const stats = new Elysia({
  prefix: "/stats",
  detail: { tags: ["Stats"], ...protectedApiDetail },
})
  .use(authMiddleware)
  .get(
    "/",
    () => StatsService.getDashboardStats(),
    {
      response: { 200: StatsModelSchema.response },
      admin: true,
    },
  );
