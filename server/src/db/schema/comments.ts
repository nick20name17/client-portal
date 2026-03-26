import { user } from "@/db/schema/auth";
import { projectFiles, projects } from "@/db/schema/projects";
import { tags } from "@/db/schema/tags";
import { boolean, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  fileId: uuid("file_id")
    .notNull()
    .references(() => projectFiles.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => user.id),
  parentId: uuid("parent_id"),
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
});

export const commentTags = pgTable(
  "comment_tags",
  {
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.tagId] })],
);
