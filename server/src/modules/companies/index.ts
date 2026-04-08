import { protectedApiDetail } from "@/lib/api-doc";
import { authMiddleware } from "@/middleware/auth";
import { CompanyModelSchema } from "./model";
import { CompanyService } from "./service";
import { Elysia } from "elysia";

export const companies = new Elysia({
  prefix: "/companies",
  detail: { tags: ["Companies"], ...protectedApiDetail },
})
  .use(authMiddleware)
  .get("/", () => CompanyService.list(), {
    response: { 200: CompanyModelSchema.listResponse },
    auth: true,
  })
  .post("/", ({ body }) => CompanyService.create(body), {
    body: CompanyModelSchema.create,
    response: { 200: CompanyModelSchema.select },
    admin: true,
  })
  .patch("/:id", ({ params, body }) => CompanyService.update(params.id, body), {
    params: CompanyModelSchema.params,
    body: CompanyModelSchema.update,
    response: { 200: CompanyModelSchema.select },
    admin: true,
  })
  .delete("/:id", ({ params }) => CompanyService.remove(params.id), {
    params: CompanyModelSchema.params,
    response: { 200: CompanyModelSchema.ok },
    admin: true,
  });
