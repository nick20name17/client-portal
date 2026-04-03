import { auth } from "@/lib/auth";
import { canViewProject } from "@/lib/access";
import { toSessionUser } from "@/plugins/session";
import { Elysia, t } from "elysia";

export const ws = new Elysia({ prefix: "/ws/projects" })
  .ws("/:id", {
    params: t.Object({ id: t.Numeric() }),
    async beforeHandle({ request, status, params }) {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) return status(401);
      const user = toSessionUser(session.user);
      if (!(await canViewProject(user, String(params.id)))) return status(403);
    },
    open(ws) {
      ws.subscribe(`project:${ws.data.params.id}`);
    },
  });
