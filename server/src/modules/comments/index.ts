import { protectedApiDetail } from "@/lib/api-doc";
import { authMiddleware } from "@/middleware/auth";
import { CommentModelSchema } from "./model";
import { CommentService } from "./service";
import { Elysia } from "elysia";

export const comments = new Elysia({
  detail: { tags: ["Comments"], ...protectedApiDetail },
})
  .use(authMiddleware)
  .get(
    "/projects/:id/comments",
    ({ user, params, query }) => CommentService.list(user, params.id, query),
    {
      params: CommentModelSchema.projectParams,
      query: CommentModelSchema.listQuery,
      response: { 200: CommentModelSchema.listResponse },
      auth: true,
    },
  )
  .post(
    "/projects/:id/comments",
    ({ user, params, body, request }) =>
      CommentService.create(user, params.id, body, request),
    {
      params: CommentModelSchema.projectParams,
      body: CommentModelSchema.create,
      response: { 200: CommentModelSchema.select },
      auth: true,
    },
  )
  .patch(
    "/comments/:id",
    ({ user, params, body }) => CommentService.patch(user, params.id, body),
    {
      params: CommentModelSchema.commentParams,
      body: CommentModelSchema.patch,
      response: { 200: CommentModelSchema.select },
      auth: true,
    },
  )
  .delete(
    "/comments/:id",
    ({ user, params }) => CommentService.remove(user, params.id),
    {
      params: CommentModelSchema.commentParams,
      response: { 200: CommentModelSchema.deleteResponse },
      auth: true,
    },
  )
  .post(
    "/comments/:id/tags",
    ({ user, params, body }) =>
      CommentService.addTag(user, params.id, body.tagId),
    {
      params: CommentModelSchema.commentParams,
      body: CommentModelSchema.tagBody,
      response: { 200: CommentModelSchema.tagOk },
      auth: true,
    },
  )
  .delete(
    "/comments/:id/tags/:tagId",
    ({ user, params }) =>
      CommentService.removeTag(user, params.id, params.tagId),
    {
      params: CommentModelSchema.tagParams,
      response: { 200: CommentModelSchema.tagOk },
      auth: true,
    },
  );
