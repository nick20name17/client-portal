import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ReconnectingWebSocket from "reconnecting-websocket";

import { COMMENT_KEYS } from "../comments/query";

export function useProjectWS(projectId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!projectId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/api/ws/projects/${projectId}`;
    const rws = new ReconnectingWebSocket(url);

    rws.onmessage = () => {
      void qc.invalidateQueries({ queryKey: COMMENT_KEYS.all(projectId) });
    };

    return () => {
      rws.close();
    };
  }, [projectId, qc]);
}
