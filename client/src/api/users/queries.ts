import { apiClient } from "@/api/client";

export type User = {
    id: string;
    name: string;
    email: string;
    role: "admin" | "client";
    createdAt: string;
    updatedAt: string;
};

export const userKeys = {
    all: ["users"] as const,
};

export const usersQueryOptions = () => ({
    queryKey: userKeys.all,
    queryFn: () => apiClient.get<User[]>("/api/users"),
});
