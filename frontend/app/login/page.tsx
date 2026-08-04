import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { getMe } from "@/lib/auth/session";

export default async function LoginPage() {
  const me = await getMe();

  return (
    <main className="flex min-h-0 flex-1 items-center justify-center bg-portal-surface-secondary">
      <Suspense
        fallback={
          <div className="p-portal-6 text-portal-body text-portal-muted">
            Загрузка…
          </div>
        }
      >
        <LoginForm alreadyAuthenticated={me != null} />
      </Suspense>
    </main>
  );
}
