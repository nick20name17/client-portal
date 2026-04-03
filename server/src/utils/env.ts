import { FormatRegistry, type Static } from "@sinclair/typebox";
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
  PORT: t.Optional(t.Integer({ minimum: 1, maximum: 65535, default: 3000 })),
  RESEND_API_KEY: t.Optional(t.String()),
  EMAIL_FROM: t.Optional(t.String()),
  APP_URL: t.Optional(t.String({ format: "uri" })),
});

export type Env = Static<typeof EnvSchema>;

const raw = {
  DATABASE_URL: process.env.DATABASE_URL,
  TRUSTED_ORIGIN: process.env.TRUSTED_ORIGIN,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  PORT:
    process.env.PORT === undefined || process.env.PORT === ""
      ? undefined
      : Number(process.env.PORT),
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  APP_URL: process.env.APP_URL,
};

const withDefaults = Value.Default(EnvSchema, raw);
const converted = Value.Convert(EnvSchema, withDefaults);
export const env: Env = Value.Parse(EnvSchema, converted);

/** Frontend + API origins for CORS and Better Auth (e.g. Scalar/OpenAPI use the API host as Origin). */
export const trustedOrigins = [
  ...new Set(
    [env.TRUSTED_ORIGIN, env.BETTER_AUTH_URL].map((u) => new URL(u).origin),
  ),
];
