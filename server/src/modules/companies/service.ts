import { db } from "@/db";
import { companies } from "@/db/schema/companies";
import { eq } from "drizzle-orm";
import { status } from "elysia";
import type { CompanyModel } from "./model";

export const CompanyService = {
  async list() {
    return db.select().from(companies);
  },

  async create(body: CompanyModel["create"]) {
    const [row] = await db.insert(companies).values({ name: body.name }).returning();
    return row;
  },

  async update(id: string, body: CompanyModel["update"]) {
    const [row] = await db
      .update(companies)
      .set({ name: body.name })
      .where(eq(companies.id, id))
      .returning();
    if (!row)
      throw status(404, {
        error: "Not found",
      } satisfies CompanyModel["notFound"]);
    return row;
  },

  async remove(id: string) {
    const [row] = await db.delete(companies).where(eq(companies.id, id)).returning();
    if (!row)
      throw status(404, {
        error: "Not found",
      } satisfies CompanyModel["notFound"]);
    return { ok: true as const };
  },
};
