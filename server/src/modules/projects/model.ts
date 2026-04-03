import { projectFiles, projectMembers, projects } from "@/db/schema/projects";
import type { InferSchema } from "@/utils/typebox";
import { createSelectSchema } from "drizzle-typebox";
import { t } from "elysia";

const projectSelect = createSelectSchema(projects);
const projectFileSelect = createSelectSchema(projectFiles);
const projectMemberSelect = createSelectSchema(projectMembers);

const companyMini = t.Object({
  id: t.Number(),
  name: t.String(),
});

const memberPreviewUser = t.Object({
  id: t.String(),
  name: t.String(),
  image: t.Union([t.String(), t.Null()]),
});

const countShape = t.Object({
  comments: t.Number(),
  files: t.Number(),
  members: t.Number(),
});

const projectListItem = t.Object({
  id: t.Number(),
  name: t.String(),
  description: t.Union([t.String(), t.Null()]),
  repoUrl: t.String(),
  companyId: t.Number(),
  createdById: t.Union([t.String(), t.Null()]),
  createdAt: t.Date(),
  updatedAt: t.Date(),
  company: companyMini,
  _count: countShape,
  memberPreview: t.Array(memberPreviewUser),
});

const projectDetail = t.Object({
  id: t.Number(),
  name: t.String(),
  description: t.Union([t.String(), t.Null()]),
  repoUrl: t.String(),
  companyId: t.Number(),
  createdById: t.Union([t.String(), t.Null()]),
  createdAt: t.Date(),
  updatedAt: t.Date(),
  company: t.Union([companyMini, t.Null()]),
});

const memberWithUser = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  userId: t.String(),
  role: t.Union([t.Literal("manager"), t.Literal("client")]),
  addedById: t.Union([t.String(), t.Null()]),
  addedAt: t.Date(),
  user: t.Object({
    id: t.String(),
    name: t.String(),
    email: t.String(),
    emailVerified: t.Boolean(),
    image: t.Union([t.String(), t.Null()]),
    role: t.String(),
  }),
});

export const ProjectModelSchema = {
  idParams: t.Object({ id: t.Numeric() }),
  fileParams: t.Object({
    id: t.Numeric(),
    fileId: t.Numeric(),
  }),
  memberParams: t.Object({
    id: t.Numeric(),
    userId: t.String(),
  }),
  create: t.Object({
    name: t.String({ minLength: 1 }),
    description: t.Optional(t.String()),
    repoUrl: t.String({ minLength: 1 }),
    companyId: t.Number(),
  }),
  update: t.Object({
    name: t.Optional(t.String({ minLength: 1 })),
    description: t.Optional(t.Union([t.String(), t.Null()])),
    repoUrl: t.Optional(t.String({ minLength: 1 })),
  }),
  addMember: t.Object({
    userId: t.String(),
    role: t.Union([t.Literal("manager"), t.Literal("client")]),
  }),
  select: projectDetail,
  listResponse: t.Array(projectListItem),
  memberList: t.Array(memberWithUser),
  memberSingle: projectMemberSelect,
  fileList: t.Array(projectFileSelect),
  syncResponse: t.Object({
    synced: t.Number(),
    paths: t.Array(t.String()),
  }),
  syncUpstreamError: t.Object({
    error: t.Literal("GitHub sync failed"),
    detail: t.String(),
  }),
  forbidden: t.Object({ error: t.Literal("Forbidden") }),
  notFound: t.Object({ error: t.Literal("Not found") }),
  invalidRepo: t.Object({ error: t.Literal("Invalid repoUrl") }),
  upstreamFetch: t.Object({ error: t.Literal("Upstream fetch failed") }),
  memberConflict: t.Object({ error: t.Literal("Already a member") }),
  ok: t.Object({ ok: t.Literal(true) }),
} as const;

export type ProjectModel = InferSchema<typeof ProjectModelSchema>;

/** Raw project row schema (internal / legacy) */
export { projectSelect };
