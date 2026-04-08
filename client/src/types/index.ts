export type Role = "admin" | "manager" | "client";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId: number | null;
  company?: Company;
  image?: string | null;
  emailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
  projects?: { id: number; name: string }[];
}

export interface Company {
  id: number;
  name: string;
  createdAt?: string;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  repoUrl: string;
  companyId: number;
  /** Present when API includes the joined company; may be absent on partial payloads. */
  company?: Company;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  _count?: { comments: number; files: number; members: number };
  memberPreview?: { id: string; name: string; image: string | null }[];
}

export interface ProjectFile {
  id: number;
  projectId: number;
  path: string;
  githubRawUrl: string;
  active: boolean;
  updatedAt: string;
}

export interface Anchor {
  dataComment: string | null;
  selector: string;
  textContent: string | null;
  tagName: string;
  xpath: string;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface Comment {
  id: number;
  projectId: number;
  fileId: number;
  versionId: number | null;
  authorId: string;
  /** Included when API joins user; may be missing on partial payloads. */
  author?: User;
  parentId: number | null;
  replies?: Comment[];
  body: string;
  resolved: boolean;
  resolvedBy?: User | null;
  resolvedAt: string | null;
  anchor: Anchor;
  tags: Tag[];
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalComments: number;
  resolvedComments: number;
  openComments: number;
  projects: number;
  users: number;
  recentActivity: {
    id: number;
    body: string;
    createdAt: string;
    projectId: number;
    projectName: string;
    authorName: string;
  }[];
}

export interface FileVersion {
  id: number;
  fileId: number;
  commitSha: string;
  commitMessage: string | null;
  commitAuthor: string | null;
  commitDate: string | null;
  label: string | null;
  createdById: string | null;
  createdAt: string;
}

export interface ProjectMemberRow {
  id: number;
  projectId: number;
  userId: string;
  role: "manager" | "client";
  addedById: string | null;
  addedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    role: string;
  };
}
