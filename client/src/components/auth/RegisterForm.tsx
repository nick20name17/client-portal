"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { AuthPasswordField } from "@/components/auth/AuthPasswordField";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const registerSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.string().min(1, "Email is required").email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
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
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Create account</h1>
        <p className="text-sm text-muted-foreground">Set up your workspace access</p>
      </div>

      {apiError ? (
        <Alert variant="destructive">
          <AlertDescription>{apiError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="register-name">Full name</Label>
        <Input
          id="register-name"
          type="text"
          autoComplete="name"
          aria-invalid={!!errors.name}
          className="h-9"
          {...register("name")}
        />
        {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          className="h-9"
          {...register("email")}
        />
        {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
      </div>

      <AuthPasswordField
        id="register-password"
        label="Password"
        show={showPassword}
        onToggle={() => setShowPassword((s) => !s)}
        error={errors.password?.message}
        autoComplete="new-password"
        toggleAriaLabel={showPassword ? "Hide password" : "Show password"}
        {...register("password")}
      />

      <AuthPasswordField
        id="register-confirm"
        label="Confirm password"
        show={showConfirm}
        onToggle={() => setShowConfirm((s) => !s)}
        error={errors.confirmPassword?.message}
        autoComplete="new-password"
        toggleAriaLabel={showConfirm ? "Hide confirm password" : "Show confirm password"}
        {...register("confirmPassword")}
      />

      <Button type="submit" variant="default" className="h-10 w-full gap-2" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Creating account…
          </>
        ) : (
          "Create account"
        )}
      </Button>
    </form>
  );
}
