
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";
import { AuthPasswordField } from "@/components/auth/AuthPasswordField";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const registerSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.string().min(1, "Email is required").email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const { handleSubmit, control, formState: { isSubmitting } } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: RegisterValues) {
    setApiError(null);
    const res = await authClient.signUp.email({
      email: values.email,
      password: values.password,
      name: values.name,
    });
    if (res.error) {
      setApiError(res.error.message ?? "Could not create account");
      return;
    }
    queryClient.removeQueries({ queryKey: ["session"] });
    await navigate({ to: "/" });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1">
        <h2 className="text-[15px] font-semibold text-foreground">Create account</h2>
        <p className="text-[13px] text-text-secondary">Set up your workspace access</p>
      </div>

      {apiError ? (
        <Alert variant="destructive">
          <AlertDescription className="text-[13px]">{apiError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-3.5">
        <Controller
          name="name"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Full name</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="text"
                autoComplete="name"
                placeholder="Jane Smith"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="email"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Email</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="password"
          control={control}
          render={({ field, fieldState }) => (
            <AuthPasswordField
              {...field}
              id={field.name}
              label="Password"
              show={showPassword}
              onToggle={() => setShowPassword((s) => !s)}
              error={fieldState.error?.message}
              autoComplete="new-password"
              toggleAriaLabel={showPassword ? "Hide password" : "Show password"}
            />
          )}
        />

        <Controller
          name="confirmPassword"
          control={control}
          render={({ field, fieldState }) => (
            <AuthPasswordField
              {...field}
              id={field.name}
              label="Confirm password"
              show={showConfirm}
              onToggle={() => setShowConfirm((s) => !s)}
              error={fieldState.error?.message}
              autoComplete="new-password"
              toggleAriaLabel={showConfirm ? "Hide confirm password" : "Show confirm password"}
            />
          )}
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        isPending={isSubmitting}
        disabled={isSubmitting}
      >
        Create account
      </Button>
    </form>
  );
}
