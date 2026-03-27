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
  index?: number;
  onClick: () => void;
}

export function CommentPin({ comment, x, y, isActive, isOrphaned, replyCount, index = 0, onClick }: CommentPinProps) {
  const size = isActive ? 28 : 24;
  const label = isOrphaned ? "!" : String(index + 1);

  const bgColor = isOrphaned
    ? "var(--muted-foreground)"
    : comment.resolved
    ? "oklch(0.527 0.154 150.069)"
    : "var(--primary)";

  const preview = comment.body.slice(0, 60);

  return (
    <button
      type="button"
      aria-label={isOrphaned ? "Orphaned comment" : `Comment ${index + 1}`}
      title={preview}
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
        background: bgColor,
        boxShadow: isActive
          ? `0 0 0 3px ${bgColor}40, 0 4px 12px rgba(0,0,0,0.25)`
          : "0 2px 6px rgba(0,0,0,0.20)",
        padding: 0,
        cursor: "pointer",
      }}
    >
      <span
        className="flex items-center justify-center text-white"
        style={{
          fontSize: size <= 24 ? 10 : 11,
          fontWeight: 700,
          lineHeight: 1,
          userSelect: "none",
        }}
      >
        {label}
      </span>

      {replyCount && replyCount > 0 ? (
        <span
          className="absolute -right-1.5 -top-1.5 flex min-w-3.5 items-center justify-center rounded-full bg-background border border-border text-[8px] font-bold text-foreground"
          style={{ height: 14, padding: "0 2px", lineHeight: 1 }}
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
        left: x - 12,
        top: y - 12,
        width: 24,
        height: 24,
        border: "2px dashed var(--primary)",
        opacity: 0.6,
        background: "var(--primary-foreground)",
      }}
    />
  );
}
