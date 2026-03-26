import { commentTags, comments, replies } from "@/db/schema/app";
import { createInsertSchema, createSelectSchema } from "drizzle-typebox";
import { t } from "elysia";

const _insertReplySchema = createInsertSchema(replies, {
    content: t.String({ minLength: 1, maxLength: 10000 }),
});

const replySelect = createSelectSchema(replies);
const commentSelect = createSelectSchema(comments);
const tagSelect = createSelectSchema(commentTags);

const commentWithReplies = t.Object({
    id: t.Number(),
    fileId: t.Number(),
    authorId: t.String(),
    cssSelector: t.Union([t.String(), t.Null()]),
    anchorJson: t.Union([t.Unknown(), t.Null()]),
    content: t.String(),
    resolvedAt: t.Union([t.Date(), t.Null()]),
    resolvedBy: t.Union([t.String(), t.Null()]),
    createdAt: t.Date(),
    updatedAt: t.Date(),
    tags: t.Array(tagSelect),
    replies: t.Array(replySelect),
});

export const CommentModelSchema = {
    fileParams: t.Object({
        projectId: t.Numeric(),
        fileId: t.Numeric(),
    }),
    commentParams: t.Object({ id: t.Numeric() }),
    tagParams: t.Object({ id: t.Numeric(), tag: t.String() }),
    replyParams: t.Object({ id: t.Numeric() }),
    selectComment: commentSelect,
    selectReply: replySelect,
    selectTag: tagSelect,
    commentWithReplies,
    createComment: t.Object({
        content: t.String({ minLength: 1, maxLength: 10000 }),
        cssSelector: t.Optional(t.String({ minLength: 1, maxLength: 2048 })),
        anchorJson: t.Optional(t.Any()),
    }),
    updateComment: t.Object({
        content: t.String({ minLength: 1, maxLength: 10000 }),
    }),
    addTag: t.Object({
        tag: t.String({ minLength: 1, maxLength: 100 }),
    }),
    setResolved: t.Object({ resolved: t.Boolean() }),
    createReply: t.Pick(_insertReplySchema, ["content"]),
    updateReply: t.Object({
        content: t.String({ minLength: 1, maxLength: 10000 }),
    }),
    notFound: t.Object({ message: t.Literal("Comment not found") }),
    replyNotFound: t.Object({ message: t.Literal("Reply not found") }),
    forbidden: t.Object({ message: t.Literal("Forbidden") }),
    fileNotFound: t.Object({ message: t.Literal("File not found") }),
} as const;
