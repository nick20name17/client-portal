import { protectedApiDetail } from "@/lib/api-doc";
import { authMiddleware } from "@/middleware/auth";
import { TagModelSchema } from "./model";
import { TagService } from "./service";
import { Elysia } from "elysia";

export const tags = new Elysia({
  prefix: "/tags",
  detail: { tags: ["Tags"], ...protectedApiDetail },
})
  .use(authMiddleware)
  .get("/", () => TagService.list(), {
    response: { 200: TagModelSchema.listResponse },
    auth: true,
  })
  .post(
    "/",
    ({ user, body }) => TagService.create(user.id, body),
    {
      body: TagModelSchema.create,
      response: { 200: TagModelSchema.select },
      admin: true,
    },
  )
  .patch(
    "/:id",
    ({ params, body }) => TagService.update(params.id, body),
    {
      params: TagModelSchema.params,
      body: TagModelSchema.update,
      response: { 200: TagModelSchema.select },
      admin: true,
    },
  )
  .delete(
    "/:id",
    ({ params }) => TagService.remove(params.id),
    {
      params: TagModelSchema.params,
      response: { 200: TagModelSchema.ok },
      admin: true,
    },
  );
