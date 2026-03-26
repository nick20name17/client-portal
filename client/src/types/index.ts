export type Role = "admin" | "manager" | "client";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId: string | null;
  company?: Company;
  image?: string | null;
  emailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Company {
  id: string;
  name: string;
  createdAt?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  repoUrl: string;
  companyId: string;
  /** Present when API includes the joined company; may be absent on partial payloads. */
  company?: Company;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { comments: number; files: number; members: number };
  memberPreview?: { id: string; name: string; image: string | null }[];
}

export interface ProjectFile {
  id: string;
  projectId: string;
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
  relativeX?: number;
  relativeY?: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Comment {
  id: string;
  projectId: string;
  fileId: string;
  authorId: string;
  /** Included when API joins user; may be missing on partial payloads. */
  author?: User;
  parentId: string | null;
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
    id: string;
    body: string;
    createdAt: string;
    projectId: string;
    projectName: string;
    authorName: string;
  }[];
}

export interface ProjectMemberRow {
  id: string;
  projectId: string;
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
