"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Subscribes to server-sent events for a project and refreshes comment queries.
 */
export function useProjectSSE(projectId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!projectId) return;

    const base = window.location.origin;
    const url = `${base}/api/sse/projects/${projectId}`;
    const es = new EventSource(url);

    const invalidate = () => {
      void qc.invalidateQueries({ queryKey: ["comments", projectId] });
    };

    es.addEventListener("comment.created", invalidate);
    es.addEventListener("comment.updated", invalidate);
    es.addEventListener("comment.deleted", invalidate);
    es.addEventListener("comment.resolved", invalidate);

    return () => {
      es.close();
    };
  }, [projectId, qc]);
}
