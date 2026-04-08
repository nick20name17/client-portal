import { protectedApiDetail } from "@/lib/api-doc";
import { authMiddleware } from "@/middleware/auth";
import { UserModelSchema } from "./model";
import { UserService } from "./service";
import { Elysia } from "elysia";

export const users = new Elysia({
  prefix: "/users",
  detail: { tags: ["Users"], ...protectedApiDetail },
})
  .use(authMiddleware)
  .get("/", ({ user, query }) => UserService.list(user, query), {
    query: UserModelSchema.query,
    response: { 200: UserModelSchema.listResponse },
    auth: true,
  })
  .post("/", ({ user, body }) => UserService.create(user, body), {
    body: UserModelSchema.create,
    response: { 200: UserModelSchema.select },
    auth: true,
  })
  .patch("/:id", ({ params, body }) => UserService.update(params.id, body), {
    params: UserModelSchema.params,
    body: UserModelSchema.update,
    response: { 200: UserModelSchema.select },
    admin: true,
  })
  .delete("/:id", ({ params }) => UserService.remove(params.id), {
    params: UserModelSchema.params,
    response: { 200: UserModelSchema.ok },
    admin: true,
  });
