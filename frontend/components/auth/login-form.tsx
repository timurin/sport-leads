"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

import { loginAction, logoutAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";

/** Minimal login form (ADR-023 / 17.1.1.3) — outside AppShell. */
export function LoginForm({
  alreadyAuthenticated,
}: {
  alreadyAuthenticated: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await loginAction(login, password, nextPath);
      if (!result.ok) {
        setError(result.message);
      }
    });
  };

  if (alreadyAuthenticated) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col gap-portal-4 p-portal-6">
        <h1 className="text-portal-title font-semibold text-portal-fg">
          Вы уже вошли
        </h1>
        <p className="text-portal-body text-portal-muted">
          Сессия активна. Можно продолжить работу или выйти.
        </p>
        <div className="flex flex-wrap gap-portal-2">
          <Button
            type="button"
            variant="primary"
            onClick={() => router.push("/sales/dashboard")}
          >
            В рабочую область
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                await logoutAction();
              });
            }}
          >
            Выйти
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto flex w-full max-w-sm flex-col gap-portal-4 p-portal-6"
    >
      <div className="space-y-portal-1">
        <h1 className="text-portal-title font-semibold text-portal-fg">
          Вход в Sport-Lead
        </h1>
        <p className="text-portal-body text-portal-muted">
          Учётная запись платформы (PlatformUser).
        </p>
      </div>
      <Field label="Логин" required htmlFor="login">
        <Input
          id="login"
          name="login"
          autoComplete="username"
          autoFocus
          required
          value={login}
          onChange={(event) => setLogin(event.target.value)}
          disabled={pending}
        />
      </Field>
      <Field label="Пароль" required htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={pending}
        />
      </Field>
      {error ? (
        <p className="text-portal-body text-portal-danger" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Вход…" : "Войти"}
      </Button>
    </form>
  );
}
