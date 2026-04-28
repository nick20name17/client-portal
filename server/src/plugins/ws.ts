import type { Server } from "bun";

let _server: Server | null = null;

export const wsEvents = {
  commentCreated: "comment.created",
  commentUpdated: "comment.updated",
  commentDeleted: "comment.deleted",
  commentResolved: "comment.resolved",
  commentRead: "comment.read",
} as const;

export function setWsServer(server: Server): void {
  _server = server;
}

export function wsEmit(projectId: string | number, event: string, data: Record<string, unknown>): void {
  _server?.publish(`project:${projectId}`, JSON.stringify({ event, ...data }));
}
