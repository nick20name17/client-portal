import { auth } from "@/lib/auth";
import type { SessionUser } from "@/types";

function parseUserRole(r: string | undefined): SessionUser["role"] {
  if (r === "admin" || r === "manager" || r === "client") return r;
  return "client";
}

/** Map Better Auth user → app `SessionUser` (used by `authMiddleware` macros). */
export function toSessionUser(
  raw: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["user"],
): SessionUser {
  const u = raw as typeof raw & {
    role?: string;
    companyId?: string | null;
    emailNotifications?: boolean;
  };
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    emailVerified: u.emailVerified,
    image: u.image,
    role: parseUserRole(u.role),
    companyId: u.companyId ?? null,
    emailNotifications: u.emailNotifications ?? true,
  };
}
