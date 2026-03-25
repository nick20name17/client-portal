import { authMiddleware, requireAdmin } from "@/middleware/auth";
import { Elysia, t } from "elysia";
import { FileModelSchema } from "./model";
import { FileService } from "./service";

export const fileModule = new Elysia({
    prefix: "/projects",
    detail: {
        tags: ["File"],
        security: [{ bearerAuth: [] }],
    },
})
    .use(authMiddleware)
    .post(
        "/:projectId/files",
        async ({ user, params: { projectId }, body }) =>
            FileService.create(projectId, user.id, body.path),
        {
            params: FileModelSchema.params,
            body: FileModelSchema.create,
            response: {
                200: FileModelSchema.select,
                403: FileModelSchema.forbidden,
                404: FileModelSchema.projectNotFound,
                422: FileModelSchema.githubError,
            },
            auth: true,
            beforeHandle: requireAdmin,
        },
    )
    .get(
        "/:projectId/files",
        async ({ user, params: { projectId } }) =>
            FileService.getAll(projectId, user.id, user.role as string),
        {
            params: FileModelSchema.params,
            response: {
                200: t.Array(FileModelSchema.select),
                403: FileModelSchema.forbidden,
                404: FileModelSchema.projectNotFound,
            },
            auth: true,
        },
    )
    .get(
        "/:projectId/files/:fileId",
        async ({ user, params: { projectId, fileId } }) =>
            FileService.getById(
                projectId,
                fileId,
                user.id,
                user.role as string,
            ),
        {
            params: FileModelSchema.fileParams,
            response: {
                403: FileModelSchema.forbidden,
                404: FileModelSchema.notFound,
            },
            auth: true,
        },
    );
