
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

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const { handleSubmit, control, formState: { isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setApiError(null);
    const res = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });
    if (res.error) {
      setApiError(res.error.message ?? "Sign in failed");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["session"] });
    await navigate({ to: "/" });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1">
        <h2 className="text-[15px] font-semibold text-foreground">Sign in</h2>
        <p className="text-[13px] text-text-secondary">Enter your credentials to continue</p>
      </div>

      {apiError ? (
        <Alert variant="destructive">
          <AlertDescription className="text-[13px]">{apiError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-3.5">
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
              autoComplete="current-password"
              toggleAriaLabel={showPassword ? "Hide password" : "Show password"}
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
        Sign in
      </Button>
    </form>
  );
}
