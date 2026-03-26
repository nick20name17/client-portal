import { createAuthClient } from "better-auth/react";

const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

export const authClient = createAuthClient({
  baseURL,
});
