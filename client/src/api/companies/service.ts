import type { Company } from "@/types";
import { apiClient } from "../client";
import type { CreateCompanyPayload, UpdateCompanyPayload } from "./schema";

export const companiesService = {
  getAll: async () => {
    const { data } = await apiClient.get<Company[]>("/companies");
    return data;
  },

  create: async (payload: CreateCompanyPayload) => {
    const { data } = await apiClient.post<Company>("/companies", payload);
    return data;
  },

  update: async (id: number, payload: UpdateCompanyPayload) => {
    const { data } = await apiClient.patch<Company>(`/companies/${id}`, payload);
    return data;
  },

  delete: async (id: number) => {
    const { data } = await apiClient.delete<{ ok: true }>(`/companies/${id}`);
    return data;
  },
};
