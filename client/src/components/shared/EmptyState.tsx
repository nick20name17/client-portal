import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-border/50 px-6 py-14 text-center",
        "bg-linear-to-b from-bg-secondary/60 to-bg-secondary/20",
        className,
      )}
    >
      {/* Subtle radial glow behind icon */}
      {Icon ? (
        <div className="relative mb-4">
          <div
            aria-hidden
            className="absolute inset-0 -m-4 rounded-full opacity-40 blur-xl"
            style={{ background: "radial-gradient(circle, rgba(0,122,255,0.12) 0%, transparent 70%)" }}
          />
          <div className="relative flex size-11 items-center justify-center rounded-xl bg-muted ring-1 ring-border/60 text-muted-foreground/70">
            <Icon className="size-5" />
          </div>
        </div>
      ) : null}
      <p className="text-[14px] font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-text-secondary">{description}</p>
      ) : null}
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}
