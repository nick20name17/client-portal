import { protectedApiDetail } from "@/lib/api-doc";
import { authMiddleware } from "@/middleware/auth";
import { ProjectModelSchema } from "./model";
import { ProjectService } from "./service";
import { fileVersionsRouter } from "./versions";
import { FileVersionModelSchema } from "./versions/model";
import { FileVersionService } from "./versions/service";
import { Elysia, t } from "elysia";

export const projects = new Elysia({
  prefix: "/projects",
  detail: { tags: ["Projects"], ...protectedApiDetail },
})
  .use(authMiddleware)
  .get("/", ({ user }) => ProjectService.listForUser(user), {
    response: { 200: ProjectModelSchema.listResponse },
    auth: true,
  })
  .post("/", ({ user, body }) => ProjectService.create(user, body), {
    body: ProjectModelSchema.create,
    response: { 200: ProjectModelSchema.select },
    auth: true,
  })
  .get("/:id", ({ user, params }) => ProjectService.getById(user, params.id), {
    params: ProjectModelSchema.idParams,
    response: { 200: ProjectModelSchema.select },
    auth: true,
  })
  .patch(
    "/:id",
    ({ user, params, body }) => ProjectService.update(user, params.id, body),
    {
      params: ProjectModelSchema.idParams,
      body: ProjectModelSchema.update,
      response: { 200: ProjectModelSchema.select },
      auth: true,
    },
  )
  .delete("/:id", ({ user, params }) => ProjectService.delete(user, params.id), {
    params: ProjectModelSchema.idParams,
    response: { 200: ProjectModelSchema.ok },
    auth: true,
  })
  .get(
    "/:id/members",
    ({ user, params }) => ProjectService.listMembers(user, params.id),
    {
      params: ProjectModelSchema.idParams,
      response: { 200: ProjectModelSchema.memberList },
      auth: true,
    },
  )
  .post(
    "/:id/members",
    ({ user, params, body }) => ProjectService.addMember(user, params.id, body),
    {
      params: ProjectModelSchema.idParams,
      body: ProjectModelSchema.addMember,
      response: { 200: ProjectModelSchema.memberSingle },
      auth: true,
    },
  )
  .delete(
    "/:id/members/:userId",
    ({ user, params }) =>
      ProjectService.removeMember(user, params.id, params.userId),
    {
      params: ProjectModelSchema.memberParams,
      response: { 200: ProjectModelSchema.ok },
      auth: true,
    },
  )
  .get(
    "/:id/files",
    ({ user, params }) => ProjectService.listFiles(user, params.id),
    {
      params: ProjectModelSchema.idParams,
      response: { 200: ProjectModelSchema.fileList },
      auth: true,
    },
  )
  .post(
    "/:id/files/sync",
    ({ user, params }) => ProjectService.syncFiles(user, params.id),
    {
      params: ProjectModelSchema.idParams,
      response: { 200: ProjectModelSchema.syncResponse },
      auth: true,
    },
  )
  .post(
    "/:id/check-new-versions",
    ({ user, params }) => FileVersionService.checkNewVersions(user, params.id),
    {
      params: ProjectModelSchema.idParams,
      response: { 200: FileVersionModelSchema.checkNewVersionsResponse },
      auth: true,
    },
  )
  .use(fileVersionsRouter)
  .get(
    "/:id/files/:fileId/html",
    async ({ user, params, query, set }) => {
      const html = await ProjectService.getFileHtml(user, params.id, params.fileId, query.versionId);
      set.headers["content-type"] = "text/html; charset=utf-8";
      set.headers["cache-control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
      set.headers.pragma = "no-cache";
      set.headers.expires = "0";
      return html;
    },
    {
      params: ProjectModelSchema.fileParams,
      query: t.Object({ versionId: t.Optional(t.Numeric()) }),
      response: { 200: t.String() },
      auth: true,
    },
  );
