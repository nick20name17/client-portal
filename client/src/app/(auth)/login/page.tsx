import { FileCode2 } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <FileCode2 className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">HTML Review</h1>
            <p className="mt-1 text-sm text-muted-foreground">Client feedback, beautifully organized</p>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-(--shadow-card)">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
