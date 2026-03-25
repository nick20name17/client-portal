import { apiClient } from "@/api/client";
import type { User } from "./queries";

export const updateUserRole = (id: string, role: "admin" | "client") =>
    apiClient.patch<User>(`/api/users/${id}/role`, { role });
