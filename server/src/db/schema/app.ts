import { relations } from "drizzle-orm";
import {
    index,
    integer,
    jsonb,
    pgTable,
    serial,
    text,
    timestamp,
    unique,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const projects = pgTable(
    "projects",
    {
        id: serial("id").primaryKey(),
        name: text("name").notNull(),
        description: text("description"),
        repoUrl: text("repo_url").notNull(),
        createdBy: text("created_by")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [index("projects_createdBy_idx").on(table.createdBy)],
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
        addedAt: timestamp("added_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        unique("project_members_project_user_unique").on(
            table.projectId,
            table.userId,
        ),
        index("project_members_projectId_idx").on(table.projectId),
        index("project_members_userId_idx").on(table.userId),
    ],
);

export const projectFiles = pgTable(
    "project_files",
    {
        id: serial("id").primaryKey(),
        projectId: integer("project_id")
            .notNull()
            .references(() => projects.id, { onDelete: "cascade" }),
        path: text("path").notNull(),
        githubUrl: text("github_url").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("project_files_projectId_idx").on(table.projectId),
        unique("project_files_project_path_unique").on(
            table.projectId,
            table.path,
        ),
    ],
);

export const comments = pgTable(
    "comments",
    {
        id: serial("id").primaryKey(),
        fileId: integer("file_id")
            .notNull()
            .references(() => projectFiles.id, { onDelete: "cascade" }),
        authorId: text("author_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        cssSelector: text("css_selector"),
        anchorJson: jsonb("anchor_json").$type<Record<string, unknown>>(),
        content: text("content").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        index("comments_fileId_idx").on(table.fileId),
        index("comments_authorId_idx").on(table.authorId),
    ],
);

export const replies = pgTable(
    "replies",
    {
        id: serial("id").primaryKey(),
        commentId: integer("comment_id")
            .notNull()
            .references(() => comments.id, { onDelete: "cascade" }),
        authorId: text("author_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        content: text("content").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        index("replies_commentId_idx").on(table.commentId),
        index("replies_authorId_idx").on(table.authorId),
    ],
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
    creator: one(user, {
        fields: [projects.createdBy],
        references: [user.id],
    }),
    members: many(projectMembers),
    files: many(projectFiles),
}));

export const projectMembersRelations = relations(
    projectMembers,
    ({ one }) => ({
        project: one(projects, {
            fields: [projectMembers.projectId],
            references: [projects.id],
        }),
        user: one(user, {
            fields: [projectMembers.userId],
            references: [user.id],
        }),
    }),
);

export const projectFilesRelations = relations(
    projectFiles,
    ({ one, many }) => ({
        project: one(projects, {
            fields: [projectFiles.projectId],
            references: [projects.id],
        }),
        comments: many(comments),
    }),
);

export const commentsRelations = relations(comments, ({ one, many }) => ({
    file: one(projectFiles, {
        fields: [comments.fileId],
        references: [projectFiles.id],
    }),
    author: one(user, {
        fields: [comments.authorId],
        references: [user.id],
    }),
    replies: many(replies),
}));

export const repliesRelations = relations(replies, ({ one }) => ({
    comment: one(comments, {
        fields: [replies.commentId],
        references: [comments.id],
    }),
    author: one(user, {
        fields: [replies.authorId],
        references: [user.id],
    }),
}));
