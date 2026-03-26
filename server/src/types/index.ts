export type UserRole = "admin" | "manager" | "client";

export type ProjectMemberRole = "manager" | "client";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image: string | null | undefined;
  role: UserRole;
  companyId: string | null;
  emailNotifications: boolean;
};
