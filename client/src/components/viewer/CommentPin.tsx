
import { getAuthorColor } from "@/components/shared/UserAvatar";
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

export function CommentPin({ comment, x, y, isActive, isOrphaned, replyCount, onClick }: CommentPinProps) {
  const authorName =
    comment.author?.name?.trim() ||
    comment.author?.email?.split("@")[0] ||
    "?";
  const initial = isOrphaned ? "!" : authorName[0]?.toUpperCase() ?? "?";
  const image = comment.author?.image ?? null;

  const size = 28;
  const tailH = 6;

  const bgColor = isOrphaned
    ? "#6E6E73"
    : comment.resolved
    ? "var(--status-done)"
    : getAuthorColor(comment.authorId);

  return (
    <div
      className={cn(
        "group pointer-events-auto absolute transition-transform duration-150",
        isActive && "z-20 scale-110",
        !isActive && "z-10 hover:z-20 hover:scale-110",
      )}
      style={{ left: x - 4, top: y - size - tailH }}
    >
      <button
        type="button"
        aria-label={isOrphaned ? "Orphaned comment" : `${authorName}'s comment`}
        onClick={onClick}
        className="relative flex flex-col items-start focus-visible:outline-none"
        style={{ cursor: "pointer", padding: 0, background: "none", border: "none" }}
      >
        {/* Bubble */}
        <div
          className={cn(
            "relative overflow-hidden transition-shadow duration-150",
            !isActive && "shadow-[0_1px_4px_rgba(0,0,0,0.15)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.2)]",
          )}
          style={{
            width: size,
            height: size,
            borderRadius: "50% 50% 50% 4px",
            background: image ? undefined : bgColor,
            ...(isActive
              ? { boxShadow: `0 0 0 2px ${bgColor}, 0 2px 6px rgba(0,0,0,0.15)` }
              : {}),
          }}
        >
          {image ? (
            <img
              src={image}
              alt={authorName}
              className="size-full object-cover"
              onError={(e) => {
                const el = e.target as HTMLImageElement;
                el.style.display = "none";
                if (el.parentElement) el.parentElement.style.background = bgColor;
              }}
            />
          ) : (
            <span
              className="flex size-full items-center justify-center text-[11px] font-semibold leading-none text-white select-none"
            >
              {initial}
            </span>
          )}
        </div>
      </button>

      {replyCount && replyCount > 0 ? (
        <span
          className="absolute -right-1.5 -top-1 flex min-w-3.5 items-center justify-center rounded-full bg-background border border-white/20 text-[8px] font-bold text-foreground"
          style={{ height: 14, padding: "0 2px", lineHeight: 1 }}
        >
          {replyCount > 9 ? "9+" : replyCount}
        </span>
      ) : null}
    </div>
  );
}

interface GhostPinProps {
  x: number;
  y: number;
}

export function GhostPin({ x, y }: GhostPinProps) {
  return (
    <div
      className="pointer-events-none absolute z-30"
      style={{
        left: x - 4,
        top: y - 34,
        width: 28,
        height: 28,
        borderRadius: "50% 50% 50% 4px",
        border: "2px dashed rgba(255,255,255,0.45)",
        opacity: 0.9,
        background: "rgba(255,255,255,0.06)",
      }}
    />
  );
}
