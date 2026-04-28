import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ReconnectingWebSocket from "reconnecting-websocket";

import { COMMENT_KEYS } from "../comments/query";

export function useProjectWS(projectId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!projectId) return;

    const serverUrl = import.meta.env.VITE_SERVER_URL as string | undefined;
    const wsBase = serverUrl
      ? serverUrl.replace(/^http/, "ws")
      : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
    const url = `${wsBase}/api/ws/projects/${projectId}`;
    const rws = new ReconnectingWebSocket(url);

    rws.onmessage = (msg) => {
      let event: string | undefined;
      try {
        event = JSON.parse(typeof msg.data === "string" ? msg.data : "")?.event;
      } catch {
        // fall through to default invalidation
      }
      // comment.read is reconciled optimistically in useMarkProjectCommentsRead.
      if (event === "comment.read") return;

      void qc.invalidateQueries({ queryKey: COMMENT_KEYS.all(projectId) });
      // unread counts shift when comments are created/updated/deleted/resolved
      void qc.invalidateQueries({ queryKey: ["projects"] });
    };

    return () => {
      rws.close();
    };
  }, [projectId, qc]);
}
