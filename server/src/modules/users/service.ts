import { db } from "@/db";
import { account, user } from "@/db/schema/auth";
import { companies } from "@/db/schema/companies";
import type { SessionUser, UserRole } from "@/types";
import { generateId } from "@better-auth/core/utils/id";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { status } from "elysia";
import type { UserModel } from "./model";

function forbidden(): never {
  throw status(403, { error: "Forbidden" });
}

function parseRole(r: string): UserRole {
  if (r === "admin" || r === "manager" || r === "client") return r;
  return "client";
}

export const UserService = {
  async list(caller: SessionUser, query: UserModel["query"]) {
    if (caller.role !== "admin" && caller.role !== "manager") forbidden();
    const conditions = [];
    if (caller.role === "manager") {
      if (!caller.companyId) forbidden();
      conditions.push(eq(user.companyId, caller.companyId));
    }
    if (query.role) conditions.push(eq(user.role, query.role));
    if (query.companyId) conditions.push(eq(user.companyId, query.companyId));
    const where =
      conditions.length === 0
        ? undefined
        : conditions.length === 1
          ? conditions[0]
          : and(...conditions);
    return db.select().from(user).where(where).orderBy(user.createdAt);
  },

  async create(caller: SessionUser, body: UserModel["create"]) {
    if (caller.role !== "admin" && caller.role !== "manager") forbidden();
    if (caller.role === "manager") {
      if (parseRole(body.role) !== "client") forbidden();
      if (!caller.companyId) forbidden();
      body.companyId = caller.companyId as unknown as number;
    }
    const email = body.email.trim().toLowerCase();
    const existing = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    if (existing.length > 0) {
      throw status(422, {
        error: "User with this email already exists",
      } satisfies UserModel["duplicateEmail"]);
    }
    if (body.companyId) {
      const [c] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, body.companyId))
        .limit(1);
      if (!c) {
        throw status(400, {
          error: "Invalid companyId",
        } satisfies UserModel["invalidCompany"]);
      }
    }
    const role = parseRole(body.role);
    if (role === "admin" && body.companyId) {
      throw status(400, {
        error: "Admin must not be tied to a company",
      } satisfies UserModel["adminCompany"]);
    }
    const userId = generateId();
    const hashed = await hashPassword(body.tmpPassword);
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(user).values({
        id: userId,
        name: body.name,
        email,
        emailVerified: false,
        image: null,
        role,
        companyId: role === "admin" ? null : (body.companyId ?? null),
        emailNotifications: true,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(account).values({
        id: generateId(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: hashed,
        createdAt: now,
        updatedAt: now,
      });
    });
    const [created] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
    return created;
  },

  async update(id: string, body: UserModel["update"]) {
    const [existing] = await db.select().from(user).where(eq(user.id, id)).limit(1);
    if (!existing) {
      throw status(404, { error: "Not found" } satisfies UserModel["notFound"]);
    }
    if (body.companyId !== undefined && body.companyId !== null) {
      const [c] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, body.companyId))
        .limit(1);
      if (!c) {
        throw status(400, {
          error: "Invalid companyId",
        } satisfies UserModel["invalidCompany"]);
      }
    }
    const nextRole = body.role !== undefined ? parseRole(body.role) : parseRole(existing.role);
    const nextCompany =
      body.companyId !== undefined
        ? body.companyId === null
          ? null
          : body.companyId
        : existing.companyId;
    if (nextRole === "admin" && nextCompany) {
      throw status(400, {
        error: "Admin must not be tied to a company",
      } satisfies UserModel["adminCompany"]);
    }
    const patch: {
      role?: string;
      companyId?: string | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    if (body.role !== undefined) patch.role = nextRole;
    if (body.companyId !== undefined) {
      patch.companyId = nextRole === "admin" ? null : nextCompany;
    }
    const [row] = await db.update(user).set(patch).where(eq(user.id, id)).returning();
    return row;
  },

  async remove(id: string) {
    const [row] = await db.delete(user).where(eq(user.id, id)).returning();
    if (!row) throw status(404, { error: "Not found" } satisfies UserModel["notFound"]);
    return { ok: true as const };
  },
};
