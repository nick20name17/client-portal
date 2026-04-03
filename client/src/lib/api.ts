import { apiClient } from "@/api/client";

export { ApiError } from "@/api/client";

export async function apiText(path: string): Promise<string> {
  const { data } = await apiClient.get<string>(path, { responseType: "text" });
  return data;
}
