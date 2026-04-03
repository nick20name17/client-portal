export type { Anchor, Comment, Tag } from "@/types";

export interface CommentsParams {
  fileId?: string;
  versionIdUpperBound?: number | null;
  resolved?: "true" | "false";
}

export interface CreateCommentPayload {
  fileId: number;
  versionId: number;
  body: string;
  anchor: import("@/types").Anchor;
  parentId?: number | null;
}

export interface PatchCommentPayload {
  body?: string;
  resolved?: boolean;
  anchor?: import("@/types").Anchor | null;
}
