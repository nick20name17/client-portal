import { cors as corsMiddleware } from "@elysiajs/cors";
import { getAllowedOrigins } from "@/lib/trusted-origins";

export const cors = corsMiddleware({
    origin: getAllowedOrigins(),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400,
});
