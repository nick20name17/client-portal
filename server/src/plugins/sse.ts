type SseClient = {
  write: (chunk: string) => void;
  close: () => void;
};

const projectClients = new Map<string, Set<SseClient>>();

export const sseEvents = {
  commentCreated: "comment.created",
  commentUpdated: "comment.updated",
  commentDeleted: "comment.deleted",
  commentResolved: "comment.resolved",
} as const;

export function sseConnect(projectId: string, client: SseClient): void {
  let set = projectClients.get(projectId);
  if (!set) {
    set = new Set();
    projectClients.set(projectId, set);
  }
  set.add(client);
}

export function sseDisconnect(projectId: string, client: SseClient): void {
  const set = projectClients.get(projectId);
  if (!set) return;
  set.delete(client);
  if (set.size === 0) projectClients.delete(projectId);
}

export function sseEmit(projectId: string, event: string, data: Record<string, unknown>): void {
  const set = projectClients.get(projectId);
  if (!set || set.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of set) {
    try {
      c.write(payload);
    } catch {
      c.close();
    }
  }
}
