"use client";

import { cn } from "@/lib/utils";
import type { Comment } from "@/types";

interface CommentPinProps {
  comment: Comment;
  x: number;
  y: number;
  isActive: boolean;
  isOrphaned?: boolean;
  replyCount?: number;
  onClick: () => void;
}

export function CommentPin({ comment, x, y, isActive, isOrphaned, replyCount, onClick }: CommentPinProps) {
  const authorName =
    comment.author?.name?.trim() ||
    comment.author?.email?.split("@")[0] ||
    `user-${comment.authorId.slice(0, 6)}`;
  const authorImage = comment.author?.image ?? null;
  const initials = authorName
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function hueFromString(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i + 1)) % 360;
    return h;
  }
  const hue = hueFromString(authorName);

  const size = isActive ? 32 : 28;
  const borderColor = isOrphaned
    ? "var(--muted-foreground)"
    : comment.resolved
    ? "oklch(0.527 0.154 150.069)"
    : "var(--primary)";

  return (
    <button
      type="button"
      aria-label={isOrphaned ? "Orphaned comment" : `Comment by ${authorName}`}
      title={isOrphaned ? "⚠ Element not found" : comment.body.slice(0, 40)}
      onClick={onClick}
      className={cn(
        "group pointer-events-auto absolute flex items-center justify-center rounded-full transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isActive && "z-20",
        !isActive && "z-10 hover:z-20",
      )}
      style={{
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        border: `2px solid ${borderColor}`,
        boxShadow: isActive
          ? `0 0 0 3px ${borderColor}40, 0 4px 12px rgba(0,0,0,0.25)`
          : "0 2px 8px rgba(0,0,0,0.18)",
        overflow: "visible",
        background: "transparent",
        padding: 0,
        cursor: "pointer",
      }}
    >
      {isOrphaned ? (
        <span
          className="flex items-center justify-center rounded-full text-xs"
          style={{
            width: size - 4,
            height: size - 4,
            background: "var(--muted)",
            color: "var(--muted-foreground)",
            fontSize: 12,
          }}
        >
          ⚠️
        </span>
      ) : authorImage ? (
        <img
          src={authorImage}
          alt={authorName}
          className="rounded-full object-cover"
          style={{ width: size - 4, height: size - 4 }}
        />
      ) : (
        <span
          className="flex items-center justify-center rounded-full text-white"
          style={{
            width: size - 4,
            height: size - 4,
            background: `oklch(0.55 0.12 ${hue})`,
            fontSize: size <= 28 ? 10 : 11,
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          {initials || "?"}
        </span>
      )}

      {replyCount && replyCount > 0 ? (
        <span
          className="absolute -right-1.5 -top-1.5 flex min-w-[16px] items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground"
          style={{ height: 16, padding: "0 3px", lineHeight: 1 }}
        >
          {replyCount > 9 ? "9+" : replyCount}
        </span>
      ) : null}
    </button>
  );
}

interface GhostPinProps {
  x: number;
  y: number;
}

export function GhostPin({ x, y }: GhostPinProps) {
  return (
    <div
      className="pointer-events-none absolute z-30 flex items-center justify-center rounded-full"
      style={{
        left: x - 14,
        top: y - 14,
        width: 28,
        height: 28,
        border: "2px dashed var(--primary)",
        opacity: 0.6,
        background: "var(--primary-foreground)",
      }}
    />
  );
}
