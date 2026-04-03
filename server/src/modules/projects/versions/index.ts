import { protectedApiDetail } from "@/lib/api-doc";
import { authMiddleware } from "@/middleware/auth";
import { Elysia } from "elysia";
import { FileVersionModelSchema } from "./model";
import { FileVersionService } from "./service";

export const fileVersionsRouter = new Elysia({
  prefix: "/:id/files/:fileId/versions",
  detail: { tags: ["FileVersions"], ...protectedApiDetail },
})
  .use(authMiddleware)
  .get(
    "/",
    ({ user, params }) => FileVersionService.list(user, params.id, params.fileId),
    {
      params: FileVersionModelSchema.params,
      response: { 200: FileVersionModelSchema.listResponse },
      auth: true,
    },
  )
  .post(
    "/",
    ({ user, params, body }) => FileVersionService.create(user, params.id, params.fileId, body),
    {
      params: FileVersionModelSchema.params,
      body: FileVersionModelSchema.create,
      response: { 200: FileVersionModelSchema.select },
      auth: true,
    },
  )
  .delete(
    "/:versionId",
    ({ user, params }) => FileVersionService.delete(user, params.id, params.fileId, params.versionId),
    {
      params: FileVersionModelSchema.versionParams,
      response: { 200: FileVersionModelSchema.ok },
      auth: true,
    },
  )
  .post(
    "/sync",
    ({ user, params }) => FileVersionService.syncAll(user, params.id, params.fileId),
    {
      params: FileVersionModelSchema.params,
      response: { 200: FileVersionModelSchema.listResponse },
      auth: true,
    },
  );
