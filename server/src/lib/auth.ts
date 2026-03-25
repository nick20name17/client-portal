import { db } from "@/db";
import * as schema from "@/db/schema";
import { getAllowedOrigins } from "@/lib/trusted-origins";
import { env } from "@/utils/env";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { openAPI } from "better-auth/plugins";

export const auth = betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    // Static list: better-auth's origin-check middleware uses `options.trustedOrigins`
    // as the full allowlist when it is an array (see origin-check.mjs). A function
    // merge path has been unreliable with Sec-Fetch + CSRF validation in dev.
    trustedOrigins: getAllowedOrigins(),
    database: drizzleAdapter(db, {
        provider: "pg",
        schema,
    }),
    emailAndPassword: {
        enabled: true,
    },
    user: {
        additionalFields: {
            role: {
                type: "string",
                defaultValue: "client",
            },
        },
        deleteUser: {
            enabled: true,
        },
    },
    plugins: [openAPI()],
});
