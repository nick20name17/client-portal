import { canViewProject } from "@/lib/access";
import { sseConnect, sseDisconnect } from "@/plugins/sse";
import type { SessionUser } from "@/types";
import { status } from "elysia";

export const SseService = {
  async assertProjectAccess(user: SessionUser, projectId: string) {
    if (!(await canViewProject(user, projectId))) {
      throw status(403, { error: "Forbidden" });
    }
  },

  createEventStream(projectId: string): ReadableStream<Uint8Array> {
    let clientRef: { write: (c: string) => void; close: () => void } | null = null;
    return new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const write = (chunk: string) => {
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            /* stream closed */
          }
        };
        const client = {
          write,
          close: () => {
            try {
              controller.close();
            } catch {
              /* */
            }
          },
        };
        clientRef = client;
        sseConnect(projectId, client);
        write(`event: connected\ndata: ${JSON.stringify({ projectId })}\n\n`);
      },
      cancel() {
        if (clientRef) sseDisconnect(projectId, clientRef);
      },
    });
  },
};
