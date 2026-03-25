import { authMiddleware, requireAdmin } from "@/middleware/auth";
import { Elysia } from "elysia";
import { UserModelSchema } from "./model";
import { UserService } from "./service";

export const userModule = new Elysia({
    prefix: "/users",
    detail: {
        tags: ["User"],
        security: [{ bearerAuth: [] }],
    },
})
    .use(authMiddleware)
    .patch(
        "/:id/role",
        async ({ params: { id }, body }) => UserService.updateRole(id, body),
        {
            params: UserModelSchema.params,
            body: UserModelSchema.updateRole,
            response: {
                200: UserModelSchema.select,
                403: UserModelSchema.forbidden,
                404: UserModelSchema.notFound,
            },
            auth: true,
            beforeHandle: requireAdmin,
        },
    );
