import { createFileRoute, redirect } from "@tanstack/react-router";
import { FileCode2 } from "lucide-react";

import { RegisterForm } from "@/components/auth/RegisterForm";
import { authClient } from "@/lib/auth-client";

const SESSION_QUERY = {
  queryKey: ["session"] as const,
  queryFn: () => authClient.getSession(),
  staleTime: 5 * 60 * 1000,
};

export const Route = createFileRoute("/(auth)/register/")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(SESSION_QUERY);
    if (session?.data?.user) {
      throw redirect({ to: "/" });
    }
  },
  component: RegisterPage,
});

function RegisterPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-page-canvas p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 size-[600px] rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(0,122,255,0.18) 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-20 size-[500px] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(175,82,222,0.15) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 w-full max-w-[360px] animate-fade-in">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/25">
            <FileCode2 className="size-5.5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-foreground">Create account</h1>
            <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
              Join your team on HTML Review
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-card/90 p-7 shadow-xl shadow-black/6 ring-1 ring-foreground/8 backdrop-blur-sm">
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
