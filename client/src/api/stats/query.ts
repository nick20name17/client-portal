import { queryOptions, useQuery } from "@tanstack/react-query";

import { statsService } from "./service";

export const STATS_KEYS = {
  all: () => ["stats"] as const,
};

export const statsQuery = () =>
  queryOptions({ queryKey: STATS_KEYS.all(), queryFn: statsService.get });

export function useStats(options?: { enabled?: boolean }) {
  return useQuery({
    ...statsQuery(),
    enabled: options?.enabled !== false,
  });
}
