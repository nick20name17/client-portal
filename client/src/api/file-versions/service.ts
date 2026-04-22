import type { FileVersion } from "@/types";
import { apiClient } from "../client";
import type { CreateFileVersionPayload } from "./schema";

const base = (projectId: string, fileId: string) =>
  `/projects/${projectId}/files/${fileId}/versions`;

export const fileVersionsService = {
  getAll: async (projectId: string, fileId: string) => {
    const { data } = await apiClient.get<FileVersion[]>(base(projectId, fileId));
    return data;
  },

  create: async (projectId: string, fileId: string, payload: CreateFileVersionPayload) => {
    const { data } = await apiClient.post<FileVersion>(base(projectId, fileId), payload);
    return data;
  },

  delete: async (projectId: string, fileId: string, versionId: number) => {
    const { data } = await apiClient.delete<{ ok: true }>(
      `${base(projectId, fileId)}/${versionId}`,
    );
    return data;
  },

  sync: async (projectId: string, fileId: string) => {
    const { data } = await apiClient.post<FileVersion[]>(`${base(projectId, fileId)}/sync`);
    return data;
  },

  checkNewVersions: async (projectId: string) => {
    const { data } = await apiClient.post<
      {
        fileId: number;
        filePath: string;
        latestCommitSha: string;
        latestCommitDate: string | null;
      }[]
    >(`/projects/${projectId}/check-new-versions`);
    return data;
  },
};
