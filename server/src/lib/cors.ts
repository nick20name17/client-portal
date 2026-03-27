import { trustedOrigins } from "@/utils/env";
import { cors as corsMiddleware } from "@elysiajs/cors";

export const cors = corsMiddleware({
  origin: trustedOrigins,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposeHeaders: ["Content-Length", "X-Request-Id"],
  maxAge: 86400,
  credentials: true,
});
