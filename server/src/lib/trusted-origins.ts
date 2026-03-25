import { env } from "@/utils/env";

const isProd = process.env.NODE_ENV === "production";

/**
 * Origins allowed for CORS and Better Auth `trustedOrigins`.
 * In development, common localhost / 127.0.0.1 variants are included so
 * `localhost` vs `127.0.0.1` does not cause INVALID_ORIGIN.
 */
export function getAllowedOrigins(): string[] {
    const apiOrigin = new URL(env.BETTER_AUTH_URL).origin;
    const extra =
        env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
            .map((s) => s.trim())
            .filter(Boolean) ?? [];
    const devFallback = isProd
        ? []
        : [
              "http://localhost:3001",
              "http://127.0.0.1:3001",
              "http://localhost:3000",
              "http://127.0.0.1:3000",
          ];
    return [...new Set([env.TRUSTED_ORIGIN, apiOrigin, ...devFallback, ...extra])];
}
