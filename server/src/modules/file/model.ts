import { projectFiles } from "@/db/schema/app";
import { createSelectSchema } from "drizzle-typebox";
import { t } from "elysia";

export const FileModelSchema = {
    params: t.Object({ projectId: t.Numeric() }),
    fileParams: t.Object({ projectId: t.Numeric(), fileId: t.Numeric() }),
    select: createSelectSchema(projectFiles),
    create: t.Object({
        path: t.String({ minLength: 1, maxLength: 1024 }),
    }),
    notFound: t.Object({ message: t.Literal("File not found") }),
    projectNotFound: t.Object({ message: t.Literal("Project not found") }),
    forbidden: t.Object({ message: t.Literal("Forbidden") }),
    githubError: t.Object({ message: t.Literal("Failed to fetch file from GitHub") }),
} as const;
