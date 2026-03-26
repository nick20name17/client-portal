import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-(--shadow-card)">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold text-primary">HTML Review</p>
        </div>
        <RegisterForm />
      </div>
    </div>
  );
}
