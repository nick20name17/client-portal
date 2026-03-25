import { cors } from "@/lib/cors";
import { handleError } from "@/lib/error-handler";
import { openapi } from "@/lib/openapi";
import { authMiddleware } from "@/middleware/auth";
import { commentModule, fileModule, projectModule, userModule } from "@/modules";
import { env } from "@/utils/env";
import { Elysia } from "elysia";

const app = new Elysia({ prefix: "/api" })
    .use(cors)
    .use(openapi)
    .use(authMiddleware)
    .use(userModule)
    .use(projectModule)
    .use(fileModule)
    .use(commentModule)
    .onError(handleError)
    .listen(env.PORT ?? 3000);

export default app;
