import { user } from "@/db/schema/auth";
import { companies } from "@/db/schema/companies";
import { boolean, index, integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const projectMemberRoleEnum = pgEnum("project_member_role", ["manager", "client"]);

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  repoUrl: text("repo_url").notNull(),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id),
  createdById: text("created_by_id").references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  archivedAt: timestamp("archived_at"),
});

export const projectFiles = pgTable(
  "project_files",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
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
  (t) => [
    uniqueIndex("project_files_project_id_path_unique").on(t.projectId, t.path),
    index("project_files_project_id_active_idx").on(t.projectId, t.active),
  ],
);

export const fileVersions = pgTable(
  "file_versions",
  {
    id: serial("id").primaryKey(),
    fileId: integer("file_id")
      .notNull()
      .references(() => projectFiles.id, { onDelete: "cascade" }),
    commitSha: varchar("commit_sha", { length: 40 }).notNull(),
    commitMessage: text("commit_message"),
    commitAuthor: text("commit_author"),
    commitDate: timestamp("commit_date"),
    label: text("label"),
    createdById: text("created_by_id").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("file_versions_file_id_commit_sha_unique").on(t.fileId, t.commitSha),
    index("file_versions_file_id_commit_date_idx").on(t.fileId, t.commitDate),
  ],
);

export const commitFiles = pgTable(
  "commit_files",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    commitSha: varchar("commit_sha", { length: 40 }).notNull(),
    path: text("path").notNull(),
    fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("commit_files_project_sha_path_unique").on(t.projectId, t.commitSha, t.path),
    index("commit_files_project_sha_idx").on(t.projectId, t.commitSha),
  ],
);

export const projectMembers = pgTable(
  "project_members",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
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
