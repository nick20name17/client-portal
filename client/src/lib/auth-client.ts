import { createAuthClient } from "better-auth/react";

/**
 * Default base URL = current origin (Next dev on :3001). `/api/*` is rewritten to Elysia (:3000).
 * Server `BETTER_AUTH_URL` must be that same origin (e.g. `http://localhost:3001`).
 */
export const authClient = createAuthClient();
