import { db } from "@/db";
import { projectMembers, projects } from "@/db/schema/app";
import { and, eq } from "drizzle-orm";
import { status } from "elysia";

type CreateBody = { name: string; repoUrl: string; description?: string };
type UpdateBody = Partial<CreateBody>;

export const ProjectService = {
    async getAll(userId: string, role: string) {
        if (role === "admin") {
            return db.query.projects.findMany({
                with: { members: true, files: true },
            });
        }

        const memberships = await db.query.projectMembers.findMany({
            where: eq(projectMembers.userId, userId),
            with: {
                project: {
                    with: { members: true, files: true },
                },
            },
        });

        return memberships.map((m) => m.project);
    },

    async getById(id: number, userId: string, role: string) {
        const project = await db.query.projects.findFirst({
            where: eq(projects.id, id),
            with: { members: true, files: true },
        });

        if (!project)
            throw status(404, { message: "Project not found" } as const);

        if (role !== "admin") {
            const isMember = project.members.some((m) => m.userId === userId);
            if (!isMember)
                throw status(403, { message: "Forbidden" } as const);
        }

        return project;
    },

    async create(userId: string, body: CreateBody) {
        const [project] = await db
            .insert(projects)
            .values({ ...body, createdBy: userId })
            .returning();

        return project;
    },

    async update(id: number, userId: string, role: string, body: UpdateBody) {
        await ProjectService.getById(id, userId, role);

        const [updated] = await db
            .update(projects)
            .set(body)
            .where(eq(projects.id, id))
            .returning();

        if (!updated)
            throw status(404, { message: "Project not found" } as const);

        return updated;
    },

    async delete(id: number) {
        const [deleted] = await db
            .delete(projects)
            .where(eq(projects.id, id))
            .returning({ id: projects.id });

        if (!deleted)
            throw status(404, { message: "Project not found" } as const);
    },

    async addMember(projectId: number, userId: string) {
        const project = await db.query.projects.findFirst({
            where: eq(projects.id, projectId),
        });

        if (!project)
            throw status(404, { message: "Project not found" } as const);

        const existing = await db.query.projectMembers.findFirst({
            where: and(
                eq(projectMembers.projectId, projectId),
                eq(projectMembers.userId, userId),
            ),
        });

        if (existing)
            throw status(409, { message: "User is already a member" } as const);

        const [member] = await db
            .insert(projectMembers)
            .values({ projectId, userId })
            .returning();

        return member;
    },

    async removeMember(projectId: number, userId: string) {
        const [deleted] = await db
            .delete(projectMembers)
            .where(
                and(
                    eq(projectMembers.projectId, projectId),
                    eq(projectMembers.userId, userId),
                ),
            )
            .returning({ id: projectMembers.id });

        if (!deleted)
            throw status(404, { message: "Member not found" } as const);
    },
};
