import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = { title: "Вход" };

export default function AdminLoginPage() {
  return (
    <div className="mx-auto max-w-sm pt-8">
      <h1 className="text-2xl font-bold">Вход в админку</h1>
      <p className="mt-2 text-muted">Пароль задаётся переменной ADMIN_PASSWORD.</p>
      <LoginForm />
    </div>
  );
}
