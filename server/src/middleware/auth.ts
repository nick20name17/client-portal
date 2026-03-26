import { auth } from "@/lib/auth";
import Elysia from "elysia";

export const authMiddleware = new Elysia({ name: "better-auth" })
    .mount(auth.handler)
    .macro({
        auth: {
            async resolve({ status, request: { headers } }) {
                const session = await auth.api.getSession({
                    headers,
                });

                if (!session) return status(401);

                return {
                    user: session.user,
                    session: session.session,
                };
            },
        },
    });

export function requireAdmin({
    user,
    status,
}: {
    user: { role: string };
    status: any;
}) {
    if (user.role !== "admin") return status(403, { message: "Forbidden" });
}

export function requireAdminOrManager({
    user,
    status,
}: {
    user: { role: string };
    status: any;
}) {
    if (user.role !== "admin" && user.role !== "manager")
        return status(403, { message: "Forbidden" });
}
