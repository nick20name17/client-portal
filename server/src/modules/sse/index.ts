import { protectedApiDetail } from "@/lib/api-doc";
import { authMiddleware } from "@/middleware/auth";
import { SseModelSchema } from "./model";
import { SseService } from "./service";
import { Elysia, t } from "elysia";

export const sse = new Elysia({
  prefix: "/sse/projects",
  detail: { tags: ["SSE"], ...protectedApiDetail },
})
  .use(authMiddleware)
  .get(
    "/:id",
    async ({ user, params, set }) => {
      await SseService.assertProjectAccess(user, params.id);
      const stream = SseService.createEventStream(params.id);
      set.headers["content-type"] = "text/event-stream";
      set.headers["cache-control"] = "no-cache";
      set.headers.connection = "keep-alive";
      return new Response(stream);
    },
    {
      params: SseModelSchema.params,
      response: { 200: t.Any() },
      auth: true,
    },
  );
