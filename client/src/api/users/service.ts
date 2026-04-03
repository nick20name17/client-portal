import type { User } from "@/types";
import { apiClient } from "../client";
import type { CreateUserPayload, UpdateUserPayload, UsersParams } from "./schema";

export const usersService = {
  getAll: async (params: UsersParams = {}) => {
    const { data } = await apiClient.get<User[]>("/users", {
      params: {
        ...(params.role && { role: params.role }),
        ...(params.companyId && { companyId: params.companyId }),
      },
    });
    return data;
  },

  create: async (payload: CreateUserPayload) => {
    const { data } = await apiClient.post<User>("/users", payload);
    return data;
  },

  update: async (id: string, payload: UpdateUserPayload) => {
    const { data } = await apiClient.patch<User>(`/users/${id}`, payload);
    return data;
  },

  delete: async (id: string) => {
    const { data } = await apiClient.delete<{ ok: true }>(`/users/${id}`);
    return data;
  },
};
