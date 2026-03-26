import { authMiddleware, requireAdmin, requireAdminOrManager } from "@/middleware/auth";
import { Elysia } from "elysia";
import { CompanyModelSchema } from "./model";
import { CompanyService } from "./service";

export const companyModule = new Elysia({
    prefix: "/companies",
    detail: {
        tags: ["Company"],
        security: [{ bearerAuth: [] }],
    },
})
    .use(authMiddleware)
    .get(
        "/",
        async () => CompanyService.getAll(),
        {
            response: { 200: CompanyModelSchema.select },
            auth: true,
            beforeHandle: requireAdmin,
        },
    )
    .post(
        "/",
        async ({ body }) => CompanyService.create(body),
        {
            body: CompanyModelSchema.create,
            response: {
                200: CompanyModelSchema.select,
                403: CompanyModelSchema.forbidden,
            },
            auth: true,
            beforeHandle: requireAdmin,
        },
    )
    .get(
        "/:id",
        async ({ user, params: { id } }) =>
            CompanyService.getById(id, user.id, user.role as string),
        {
            params: CompanyModelSchema.params,
            response: {
                200: CompanyModelSchema.select,
                403: CompanyModelSchema.forbidden,
                404: CompanyModelSchema.notFound,
            },
            auth: true,
        },
    )
    .patch(
        "/:id",
        async ({ params: { id }, body }) => CompanyService.update(id, body),
        {
            params: CompanyModelSchema.params,
            body: CompanyModelSchema.update,
            response: {
                200: CompanyModelSchema.select,
                403: CompanyModelSchema.forbidden,
                404: CompanyModelSchema.notFound,
            },
            auth: true,
            beforeHandle: requireAdmin,
        },
    )
    .delete(
        "/:id",
        async ({ params: { id } }) => CompanyService.delete(id),
        {
            params: CompanyModelSchema.params,
            response: {
                403: CompanyModelSchema.forbidden,
                404: CompanyModelSchema.notFound,
            },
            auth: true,
            beforeHandle: requireAdmin,
        },
    )
    .post(
        "/:id/users",
        async ({ user, params: { id }, body }) =>
            CompanyService.addUser(id, body.userId, user.id, user.role as string),
        {
            params: CompanyModelSchema.params,
            body: CompanyModelSchema.addUser,
            response: {
                403: CompanyModelSchema.forbidden,
                404: CompanyModelSchema.notFound,
            },
            auth: true,
            beforeHandle: requireAdminOrManager,
        },
    )
    .delete(
        "/:id/users/:userId",
        async ({ user, params: { id, userId } }) =>
            CompanyService.removeUser(id, userId, user.id, user.role as string),
        {
            params: CompanyModelSchema.userParams,
            response: {
                403: CompanyModelSchema.forbidden,
                404: CompanyModelSchema.notFound,
            },
            auth: true,
            beforeHandle: requireAdminOrManager,
        },
    );
