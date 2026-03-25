import { authMiddleware, requireAdmin } from "@/middleware/auth";
import { Elysia, t } from "elysia";
import { ProjectModelSchema } from "./model";
import { ProjectService } from "./service";

export const projectModule = new Elysia({
    prefix: "/projects",
    detail: {
        tags: ["Project"],
        security: [{ bearerAuth: [] }],
    },
})
    .use(authMiddleware)
    .get(
        "/",
        async ({ user }) =>
            ProjectService.getAll(user.id, user.role as string),
        {
            response: { 200: t.Array(ProjectModelSchema.select) },
            auth: true,
        },
    )
    .post(
        "/",
        async ({ user, body }) => ProjectService.create(user.id, body),
        {
            body: ProjectModelSchema.create,
            response: {
                200: ProjectModelSchema.select,
                403: ProjectModelSchema.forbidden,
            },
            auth: true,
            beforeHandle: requireAdmin,
        },
    )
    .get(
        "/:projectId",
        async ({ user, params: { projectId } }) =>
            ProjectService.getById(projectId, user.id, user.role as string),
        {
            params: ProjectModelSchema.params,
            response: {
                200: ProjectModelSchema.select,
                403: ProjectModelSchema.forbidden,
                404: ProjectModelSchema.notFound,
            },
            auth: true,
        },
    )
    .patch(
        "/:projectId",
        async ({ user, params: { projectId }, body }) =>
            ProjectService.update(
                projectId,
                user.id,
                user.role as string,
                body,
            ),
        {
            params: ProjectModelSchema.params,
            body: ProjectModelSchema.update,
            response: {
                200: ProjectModelSchema.select,
                403: ProjectModelSchema.forbidden,
                404: ProjectModelSchema.notFound,
            },
            auth: true,
            beforeHandle: requireAdmin,
        },
    )
    .delete(
        "/:projectId",
        async ({ params: { projectId } }) => ProjectService.delete(projectId),
        {
            params: ProjectModelSchema.params,
            response: {
                403: ProjectModelSchema.forbidden,
                404: ProjectModelSchema.notFound,
            },
            auth: true,
            beforeHandle: requireAdmin,
        },
    )
    .post(
        "/:projectId/members",
        async ({ params: { projectId }, body }) =>
            ProjectService.addMember(projectId, body.userId),
        {
            params: ProjectModelSchema.params,
            body: ProjectModelSchema.addMember,
            response: {
                200: ProjectModelSchema.member,
                403: ProjectModelSchema.forbidden,
                404: ProjectModelSchema.notFound,
                409: ProjectModelSchema.alreadyMember,
            },
            auth: true,
            beforeHandle: requireAdmin,
        },
    )
    .delete(
        "/:projectId/members/:userId",
        async ({ params: { projectId, userId } }) =>
            ProjectService.removeMember(projectId, userId),
        {
            params: ProjectModelSchema.memberParams,
            response: {
                403: ProjectModelSchema.forbidden,
                404: ProjectModelSchema.memberNotFound,
            },
            auth: true,
            beforeHandle: requireAdmin,
        },
    );
