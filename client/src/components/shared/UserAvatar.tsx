import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export const AUTHOR_COLORS = [
  "#ef4444", // red-500
  "#f97316", // orange-500
  "#eab308", // yellow-500
  "#22c55e", // green-500
  "#14b8a6", // teal-500
  "#06b6d4", // cyan-500
  "#3b82f6", // blue-500
  "#6366f1", // indigo-500
  "#8b5cf6", // violet-500
  "#a855f7", // purple-500
  "#ec4899", // pink-500
  "#f43f5e", // rose-500
];

export function getAuthorColor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  return AUTHOR_COLORS[Math.abs(h) % AUTHOR_COLORS.length];
}

export function UserAvatar({
  name,
  image,
  className,
  userId,
}: {
  name: string;
  image?: string | null;
  className?: string;
  userId?: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const bg = getAuthorColor(userId ?? name);

  return (
    <Avatar className={cn("size-8", className)}>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback
        className="text-[10px] font-semibold text-white tracking-tight"
        style={{ backgroundColor: bg }}
      >
        {initials || "?"}
      </AvatarFallback>
    </Avatar>
  );
}
