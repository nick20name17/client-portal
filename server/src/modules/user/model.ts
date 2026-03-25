import { t } from "elysia";

export const UserModelSchema = {
    params: t.Object({ id: t.String() }),
    updateRole: t.Object({
        role: t.UnionEnum(["admin", "client"]),
    }),
    select: t.Object({
        id: t.String(),
        name: t.String(),
        email: t.String(),
        role: t.String(),
        createdAt: t.Date(),
        updatedAt: t.Date(),
    }),
    notFound: t.Object({ message: t.Literal("User not found") }),
    forbidden: t.Object({ message: t.Literal("Forbidden") }),
} as const;
