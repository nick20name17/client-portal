import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { status } from "elysia";

type UpdateRoleBody = { role: "admin" | "client" };

export const UserService = {
    async updateRole(id: string, body: UpdateRoleBody) {
        const [updated] = await db
            .update(user)
            .set({ role: body.role })
            .where(eq(user.id, id))
            .returning();

        if (!updated)
            throw status(404, { message: "User not found" } as const);

        return updated;
    },
};
