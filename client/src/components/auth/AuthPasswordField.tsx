
import type { ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
  placeholder = "••••••••",
  ...inputProps
}: AuthPasswordFieldProps) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={inputProps.id}>{label}</FieldLabel>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          aria-invalid={!!error}
          className={cn("pr-9", className)}
          placeholder={placeholder}
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
      {error ? <FieldError errors={[{ message: error }]} /> : null}
    </Field>
  );
}
