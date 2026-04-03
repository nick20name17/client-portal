import type { Tag } from "@/types";
import { apiClient } from "../client";
import type { CreateTagPayload, UpdateTagPayload } from "./schema";

export const tagsService = {
  getAll: async () => {
    const { data } = await apiClient.get<Tag[]>("/tags");
    return data;
  },

  create: async (payload: CreateTagPayload) => {
    const { data } = await apiClient.post<Tag>("/tags", payload);
    return data;
  },

  update: async (id: number, payload: UpdateTagPayload) => {
    const { data } = await apiClient.patch<Tag>(`/tags/${id}`, payload);
    return data;
  },

  delete: async (id: number) => {
    const { data } = await apiClient.delete<{ ok: true }>(`/tags/${id}`);
    return data;
  },
};
