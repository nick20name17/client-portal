import { FormatRegistry } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { t } from "elysia";

FormatRegistry.Set("uri", (value) => {
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
});

const EnvSchema = t.Object({
    DATABASE_URL: t.String({ minLength: 1, format: "uri" }),
    TRUSTED_ORIGIN: t.String({ minLength: 1, format: "uri" }),
    BETTER_AUTH_URL: t.String({ minLength: 1, format: "uri" }),
    BETTER_AUTH_SECRET: t.String({ minLength: 32 }),
    PORT: t.Optional(t.Number({ minimum: 1, maximum: 65535, default: 3000 })),
    RESEND_API_KEY: t.Optional(t.String({ minLength: 1 })),
    RESEND_FROM_EMAIL: t.Optional(t.String({ minLength: 1 })),
});

export const env = Value.Parse(EnvSchema, process.env);
