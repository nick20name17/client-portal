import type { DashboardStats } from "@/types";
import { apiClient } from "../client";

export const statsService = {
  get: async () => {
    const { data } = await apiClient.get<DashboardStats>("/stats");
    return data;
  },
};
