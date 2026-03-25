import { projectMembers, projects } from "@/db/schema/app";
import { createInsertSchema, createSelectSchema } from "drizzle-typebox";
import { t } from "elysia";

const _insertSchema = createInsertSchema(projects, {
    name: t.String({ minLength: 1, maxLength: 500 }),
    repoUrl: t.String({ minLength: 1, maxLength: 2048 }),
    description: t.Optional(t.String({ maxLength: 2000 })),
});

export const ProjectModelSchema = {
    params: t.Object({ projectId: t.Numeric() }),
    memberParams: t.Object({ projectId: t.Numeric(), userId: t.String() }),
    select: createSelectSchema(projects),
    create: t.Omit(_insertSchema, ["id", "createdBy", "createdAt", "updatedAt"]),
    update: t.Partial(
        t.Omit(_insertSchema, ["id", "createdBy", "createdAt", "updatedAt"]),
    ),
    addMember: t.Object({ userId: t.String() }),
    member: createSelectSchema(projectMembers),
    notFound: t.Object({ message: t.Literal("Project not found") }),
    forbidden: t.Object({ message: t.Literal("Forbidden") }),
    memberNotFound: t.Object({ message: t.Literal("Member not found") }),
    alreadyMember: t.Object({ message: t.Literal("User is already a member") }),
} as const;
