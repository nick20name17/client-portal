import { apiClient, ApiError } from "@/api/client";

export { ApiError };

export function apiErrorMsg(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

export async function apiText(path: string): Promise<string> {
  const { data } = await apiClient.get<string>(path, { responseType: "text" });
  return data;
}
