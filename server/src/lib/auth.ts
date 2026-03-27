import { db } from "@/db";
import * as schema from "@/db/schema";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { openAPI } from "better-auth/plugins";

export const auth = betterAuth({
  baseURL: "http://localhost:3000",
  trustedOrigins: ["http://localhost:3000", "http://localhost:3001"],
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
        required: false,
        input: false,
      },
      companyId: {
        type: "string",
        required: false,
        input: false,
      },
      emailNotifications: {
        type: "boolean",
        defaultValue: true,
        required: false,
        input: false,
      },
    },
    deleteUser: {
      enabled: true,
    },
  },
  plugins: [openAPI()],
});
