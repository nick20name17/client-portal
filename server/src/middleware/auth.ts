import { auth } from "@/lib/auth";
import { toSessionUser } from "@/plugins/session";
import { Elysia } from "elysia";

/**
 * Better Auth + route macros (`auth` / `admin`): same idea as ps-crm.
 * Per module: `.use(authMiddleware)` and `auth: true` or `admin: true` on routes.
 */
export const authMiddleware = new Elysia({ name: "better-auth" })
  .mount(auth.handler)
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers });
        if (!session) return status(401);
        return {
          user: toSessionUser(session.user),
          session: session.session,
        };
      },
    },
    admin: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers });
        if (!session) return status(401);
        const user = toSessionUser(session.user);
        if (user.role !== "admin") return status(403, { error: "Forbidden" });
        return { user, session: session.session };
      },
    },
  });
