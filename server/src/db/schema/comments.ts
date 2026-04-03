import { user } from "@/db/schema/auth";
import { fileVersions, projectFiles, projects } from "@/db/schema/projects";
import { tags } from "@/db/schema/tags";
import { boolean, index, integer, jsonb, pgTable, primaryKey, serial, text, timestamp } from "drizzle-orm/pg-core";

export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    fileId: integer("file_id")
      .notNull()
      .references(() => projectFiles.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    versionId: integer("version_id").references(() => fileVersions.id, { onDelete: "set null" }),
    parentId: integer("parent_id"),
    body: text("body").notNull(),
    resolved: boolean("resolved").notNull().default(false),
    resolvedById: text("resolved_by_id").references(() => user.id),
    resolvedAt: timestamp("resolved_at"),
    anchor: jsonb("anchor").notNull(),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("comments_project_id_deleted_at_idx").on(t.projectId, t.deletedAt),
    index("comments_project_id_version_id_idx").on(t.projectId, t.versionId),
  ],
);

export const commentTags = pgTable(
  "comment_tags",
  {
    commentId: integer("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.tagId] })],
);
