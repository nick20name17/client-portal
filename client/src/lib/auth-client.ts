import { createAuthClient } from "better-auth/react";

const baseURL = import.meta.env.VITE_SERVER_URL ?? "";

export const authClient = createAuthClient({
  baseURL,
});
