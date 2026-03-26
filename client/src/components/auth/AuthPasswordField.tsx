"use client";

import type { ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type AuthPasswordFieldProps = Omit<ComponentProps<typeof Input>, "type"> & {
  label: string;
  show: boolean;
  onToggle: () => void;
  error?: string;
  toggleAriaLabel: string;
};

export function AuthPasswordField({
  label,
  show,
  onToggle,
  error,
  toggleAriaLabel,
  className,
  ...inputProps
}: AuthPasswordFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={inputProps.id}>{label}</Label>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          aria-invalid={!!error}
          className={cn("h-9 pr-9", className)}
          {...inputProps}
        />
        <button
          type="button"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onToggle}
          aria-label={toggleAriaLabel}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
