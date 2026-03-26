import { user } from "@/db/schema/auth";
import { companies } from "@/db/schema/companies";
import { boolean, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const projectMemberRoleEnum = pgEnum("project_member_role", ["manager", "client"]);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  repoUrl: text("repo_url").notNull(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  createdById: text("created_by_id").references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const projectFiles = pgTable(
  "project_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    githubRawUrl: text("github_raw_url").notNull(),
    active: boolean("active").notNull().default(true),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [uniqueIndex("project_files_project_id_path_unique").on(t.projectId, t.path)],
);

export const projectMembers = pgTable(
  "project_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: projectMemberRoleEnum("role").notNull(),
    addedById: text("added_by_id").references(() => user.id),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("project_members_project_id_user_id_unique").on(t.projectId, t.userId)],
);
