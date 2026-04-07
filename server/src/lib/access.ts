import { db } from "@/db";
import { projectMembers, projects } from "@/db/schema/projects";
import type { SessionUser } from "@/types";
import type { UserRole } from "@/types";
import { and, eq } from "drizzle-orm";

export async function getProjectOrNull(projectId: string) {
  const rows = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  return rows[0] ?? null;
}

async function isProjectMember(userId: string, projectId: string): Promise<boolean> {
  const rows = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

export async function getProjectMemberRole(
  userId: string,
  projectId: string,
): Promise<"manager" | "client" | null> {
  const rows = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  return rows[0]?.role ?? null;
}

export async function canViewProject(user: SessionUser, projectId: string): Promise<boolean> {
  if (user.role === "admin") return true;
  return isProjectMember(user.id, projectId);
}

export async function assertProjectView(user: SessionUser, projectId: string): Promise<void> {
  const ok = await canViewProject(user, projectId);
  if (!ok) {
    const err = new Error("Forbidden");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}

export function assertRole(user: SessionUser, ...roles: UserRole[]): void {
  if (!roles.includes(user.role)) {
    const err = new Error("Forbidden");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}
