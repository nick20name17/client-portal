import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PROJECT_COLORS = ["#6366F1", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#EC4899"];

export function getProjectColor(id: string): string {
  return PROJECT_COLORS[id.charCodeAt(0) % PROJECT_COLORS.length];
}
