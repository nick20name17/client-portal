export type { User } from "@/types";

export interface UsersParams {
  role?: string;
  companyId?: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  role: string;
  companyId?: number | null;
  tmpPassword: string;
}

export interface UpdateUserPayload {
  role?: string;
  companyId?: number | null;
}
