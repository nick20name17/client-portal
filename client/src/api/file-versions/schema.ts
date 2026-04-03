export type { FileVersion } from "@/types";

export interface CreateFileVersionPayload {
  commitSha?: string;
  label?: string | null;
}
