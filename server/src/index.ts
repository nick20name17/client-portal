import { pool } from "@/db";
import { auth, cors, openapi } from "@/lib";
import { comments, companies, projects, sse, tags, users } from "@/modules";
import { stats } from "@/modules/stats/index";
import { env } from "@/utils/env";
import { Elysia, t } from "elysia";

const app = new Elysia({ prefix: "/api" })
  .use(cors)
  .use(openapi)
  .get(
    "/health",
    async () => {
      const ok = await pool
        .query("SELECT 1")
        .then(() => true)
        .catch(() => false);

      return {
        status: ok ? ("ok" as const) : ("degraded" as const),
        db: ok,
      };
    },
    {
      detail: { tags: ["System"] },
      response: {
        200: t.Object({
          status: t.Union([t.Literal("ok"), t.Literal("degraded")]),
          db: t.Boolean(),
        }),
      },
    },
  )
  .mount(auth.handler)
  .use(companies)
  .use(users)
  .use(projects)
  .use(comments)
  .use(tags)
  .use(stats)
  .use(sse)
  .listen(env.PORT ?? 3000);

console.log(`API running at ${app.server?.hostname}:${app.server?.port}`);
console.log(
  "Registered stats routes:",
  app.routes
    .map((r) => `${r.method} ${r.path}`)
    .filter((p) => p.includes("stats")),
);
