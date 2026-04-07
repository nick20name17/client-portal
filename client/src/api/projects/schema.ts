export interface CreateProjectPayload {
  name: string;
  description?: string;
  repoUrl: string;
  companyId: number;
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string | null;
  repoUrl?: string;
}

export interface AddMemberPayload {
  userId: string;
  role: "manager" | "client";
}
