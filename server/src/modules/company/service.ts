import { db } from "@/db";
import { companies } from "@/db/schema/company";
import { user } from "@/db/schema/auth";
import { eq } from "drizzle-orm";
import { status } from "elysia";

type CreateBody = { name: string; description?: string };
type UpdateBody = Partial<CreateBody>;

async function getCompany(id: number) {
    const company = await db.query.companies.findFirst({
        where: eq(companies.id, id),
    });
    if (!company) throw status(404, { message: "Company not found" } as const);
    return company;
}

export const CompanyService = {
    async getAll() {
        return db.query.companies.findMany();
    },

    async getById(id: number, callerId: string, callerRole: string) {
        const company = await getCompany(id);

        if (callerRole !== "admin") {
            const caller = await db.query.user.findFirst({
                where: eq(user.id, callerId),
            });
            if (caller?.companyId !== id)
                throw status(403, { message: "Forbidden" } as const);
        }

        return company;
    },

    async create(body: CreateBody) {
        const [company] = await db
            .insert(companies)
            .values(body)
            .returning();
        return company;
    },

    async update(id: number, body: UpdateBody) {
        await getCompany(id);

        const [updated] = await db
            .update(companies)
            .set(body)
            .where(eq(companies.id, id))
            .returning();

        return updated;
    },

    async delete(id: number) {
        const [deleted] = await db
            .delete(companies)
            .where(eq(companies.id, id))
            .returning({ id: companies.id });

        if (!deleted)
            throw status(404, { message: "Company not found" } as const);
    },

    async addUser(
        companyId: number,
        targetUserId: string,
        callerId: string,
        callerRole: string,
    ) {
        await getCompany(companyId);

        if (callerRole === "manager") {
            const caller = await db.query.user.findFirst({
                where: eq(user.id, callerId),
            });
            if (caller?.companyId !== companyId)
                throw status(403, { message: "Forbidden" } as const);
        }

        const targetUser = await db.query.user.findFirst({
            where: eq(user.id, targetUserId),
        });
        if (!targetUser)
            throw status(404, { message: "User not found" } as const);

        const [updated] = await db
            .update(user)
            .set({ companyId })
            .where(eq(user.id, targetUserId))
            .returning();

        return updated;
    },

    async removeUser(
        companyId: number,
        targetUserId: string,
        callerId: string,
        callerRole: string,
    ) {
        await getCompany(companyId);

        if (callerRole === "manager") {
            const caller = await db.query.user.findFirst({
                where: eq(user.id, callerId),
            });
            if (caller?.companyId !== companyId)
                throw status(403, { message: "Forbidden" } as const);
        }

        const targetUser = await db.query.user.findFirst({
            where: eq(user.id, targetUserId),
        });
        if (!targetUser || targetUser.companyId !== companyId)
            throw status(404, { message: "User not found" } as const);

        const [updated] = await db
            .update(user)
            .set({ companyId: null })
            .where(eq(user.id, targetUserId))
            .returning();

        return updated;
    },
};
