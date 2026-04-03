import { db } from "@/db";
import { tags } from "@/db/schema/tags";
import { eq } from "drizzle-orm";
import { status } from "elysia";
import type { TagModel } from "./model";

export const TagService = {
  async list() {
    return db.select().from(tags).orderBy(tags.name);
  },

  async create(userId: string, body: TagModel["create"]) {
    const [row] = await db
      .insert(tags)
      .values({
        name: body.name,
        color: body.color,
        createdById: userId,
      })
      .returning();
    if (!row) {
      throw status(500, { error: "Failed" } satisfies TagModel["failed"]);
    }
    return row;
  },

  async update(id: string, body: TagModel["update"]) {
    const patch: { name?: string; color?: string } = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.color !== undefined) patch.color = body.color;
    const [row] = await db.update(tags).set(patch).where(eq(tags.id, id)).returning();
    if (!row) throw status(404, { error: "Not found" } satisfies TagModel["notFound"]);
    return row;
  },

  async remove(id: string) {
    const [row] = await db.delete(tags).where(eq(tags.id, id)).returning();
    if (!row) throw status(404, { error: "Not found" } satisfies TagModel["notFound"]);
    return { ok: true as const };
  },
};
