import { Elysia } from "elysia";
import { openapi } from "./lib/openapi";

const app = new Elysia({ prefix: "/api" })
    .use(openapi)
    .listen(process.env.PORT ?? 3000);

export default app;
