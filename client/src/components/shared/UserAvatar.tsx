import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i + 1)) % 360;
  return h;
}

export function UserAvatar({
  name,
  image,
  className,
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const hue = hueFromString(name);

  return (
    <Avatar className={cn("size-8 border border-border", className)}>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback
        className="text-xs font-medium text-white"
        style={{ backgroundColor: `oklch(0.55 0.12 ${hue})` }}
      >
        {initials || "?"}
      </AvatarFallback>
    </Avatar>
  );
}
