import { authMiddleware } from "@/middleware/auth";
import { Elysia, t } from "elysia";
import { CommentModelSchema } from "./model";
import { CommentService } from "./service";

export const commentModule = new Elysia({
    detail: {
        tags: ["Comment"],
        security: [{ bearerAuth: [] }],
    },
})
    .use(authMiddleware)
    .get(
        "/projects/:projectId/files/:fileId/comments",
        async ({ user, params: { projectId, fileId } }) =>
            CommentService.getAll(
                projectId,
                fileId,
                user.id,
                user.role as string,
            ),
        {
            params: CommentModelSchema.fileParams,
            response: {
                403: CommentModelSchema.forbidden,
                404: CommentModelSchema.fileNotFound,
            },
            auth: true,
        },
    )
    .post(
        "/projects/:projectId/files/:fileId/comments",
        async ({ user, params: { projectId, fileId }, body }) =>
            CommentService.create(
                projectId,
                fileId,
                user.id,
                user.role as string,
                body,
            ),
        {
            params: CommentModelSchema.fileParams,
            body: CommentModelSchema.createComment,
            response: {
                200: CommentModelSchema.selectComment,
                403: CommentModelSchema.forbidden,
                404: CommentModelSchema.fileNotFound,
                422: t.Object({ message: t.String() }),
            },
            auth: true,
        },
    )
    .patch(
        "/comments/:id",
        async ({ user, params: { id }, body }) =>
            CommentService.update(
                id,
                user.id,
                user.role as string,
                body.content,
            ),
        {
            params: CommentModelSchema.commentParams,
            body: CommentModelSchema.updateComment,
            response: {
                200: CommentModelSchema.selectComment,
                403: CommentModelSchema.forbidden,
                404: CommentModelSchema.notFound,
            },
            auth: true,
        },
    )
    .delete(
        "/comments/:id",
        async ({ user, params: { id } }) =>
            CommentService.delete(id, user.id, user.role as string),
        {
            params: CommentModelSchema.commentParams,
            response: {
                403: CommentModelSchema.forbidden,
                404: CommentModelSchema.notFound,
            },
            auth: true,
        },
    )
    .post(
        "/comments/:id/replies",
        async ({ user, params: { id }, body }) =>
            CommentService.createReply(id, user.id, body.content),
        {
            params: CommentModelSchema.commentParams,
            body: CommentModelSchema.createReply,
            response: {
                200: CommentModelSchema.selectReply,
                404: CommentModelSchema.notFound,
            },
            auth: true,
        },
    )
    .patch(
        "/replies/:id",
        async ({ user, params: { id }, body }) =>
            CommentService.updateReply(
                id,
                user.id,
                user.role as string,
                body.content,
            ),
        {
            params: CommentModelSchema.replyParams,
            body: CommentModelSchema.updateReply,
            response: {
                200: CommentModelSchema.selectReply,
                403: CommentModelSchema.forbidden,
                404: CommentModelSchema.replyNotFound,
            },
            auth: true,
        },
    )
    .delete(
        "/replies/:id",
        async ({ user, params: { id } }) =>
            CommentService.deleteReply(id, user.id, user.role as string),
        {
            params: CommentModelSchema.replyParams,
            response: {
                403: CommentModelSchema.forbidden,
                404: CommentModelSchema.replyNotFound,
            },
            auth: true,
        },
    )
    .post(
        "/comments/:id/tags",
        async ({ user, params: { id }, body }) =>
            CommentService.addTag(id, body.tag, user.id, user.role as string),
        {
            params: CommentModelSchema.commentParams,
            body: CommentModelSchema.addTag,
            response: {
                200: CommentModelSchema.selectTag,
                403: CommentModelSchema.forbidden,
                404: CommentModelSchema.notFound,
            },
            auth: true,
        },
    )
    .delete(
        "/comments/:id/tags/:tag",
        async ({ user, params: { id, tag } }) =>
            CommentService.removeTag(id, tag, user.id, user.role as string),
        {
            params: CommentModelSchema.tagParams,
            response: {
                403: CommentModelSchema.forbidden,
                404: CommentModelSchema.notFound,
            },
            auth: true,
        },
    )
    .patch(
        "/comments/:id/resolve",
        async ({ user, params: { id }, body }) =>
            CommentService.setResolved(
                id,
                body.resolved,
                user.id,
                user.role as string,
            ),
        {
            params: CommentModelSchema.commentParams,
            body: CommentModelSchema.setResolved,
            response: {
                200: CommentModelSchema.selectComment,
                403: CommentModelSchema.forbidden,
                404: CommentModelSchema.notFound,
            },
            auth: true,
        },
    );
