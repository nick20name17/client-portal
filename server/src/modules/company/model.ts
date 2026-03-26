import { companies } from "@/db/schema/company";
import { createInsertSchema, createSelectSchema } from "drizzle-typebox";
import { t } from "elysia";

const _insertSchema = createInsertSchema(companies, {
    name: t.String({ minLength: 1, maxLength: 500 }),
    description: t.Optional(t.String({ maxLength: 2000 })),
});

export const CompanyModelSchema = {
    params: t.Object({ id: t.Numeric() }),
    userParams: t.Object({ id: t.Numeric(), userId: t.String() }),
    select: createSelectSchema(companies),
    create: t.Omit(_insertSchema, ["id", "createdAt", "updatedAt"]),
    update: t.Partial(t.Omit(_insertSchema, ["id", "createdAt", "updatedAt"])),
    addUser: t.Object({ userId: t.String() }),
    notFound: t.Object({ message: t.Literal("Company not found") }),
    forbidden: t.Object({ message: t.Literal("Forbidden") }),
} as const;
