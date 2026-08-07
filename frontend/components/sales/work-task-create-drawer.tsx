"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createWorkTask } from "@/app/(workspace)/sales/tasks/work-task-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import {
  emptyWorkTaskCreateDraft,
  validateWorkTaskCreateDraft,
  workTaskAnchorTypeLabels,
  workTaskCreateDraftToPayload,
  type WorkTaskAnchorType,
  type WorkTaskCreateDraft,
  type WorkTaskListItem,
} from "@/lib/work-tasks";

export type WorkTaskAnchorOption = { id: number; label: string };

export type WorkTaskLockedAnchor = {
  type: WorkTaskAnchorType;
  id: number;
  label: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  stages: WorkTaskAnchorOption[];
  users: WorkTaskAnchorOption[];
  leads?: WorkTaskAnchorOption[];
  orders?: WorkTaskAnchorOption[];
  productionOrders?: WorkTaskAnchorOption[];
  lockedAnchor?: WorkTaskLockedAnchor | null;
  /** When false, stay on host and call onCreated (default true → open chat). */
  navigateOnCreate?: boolean;
  onCreated?: (task: WorkTaskListItem) => void;
};

function draftFromLocked(
  locked: WorkTaskLockedAnchor | null | undefined,
): WorkTaskCreateDraft {
  const base = emptyWorkTaskCreateDraft();
  if (!locked) return base;
  return {
    ...base,
    anchor_type: locked.type,
    anchor_id: String(locked.id),
  };
}

export function WorkTaskCreateDrawer({
  open,
  onClose,
  stages,
  users,
  leads = [],
  orders = [],
  productionOrders = [],
  lockedAnchor = null,
  navigateOnCreate = true,
  onCreated,
}: Props) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [draft, setDraft] = useState<WorkTaskCreateDraft>(() =>
    draftFromLocked(lockedAnchor),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(draftFromLocked(lockedAnchor));
    setError("");
  }, [open, lockedAnchor]);

  const anchorOptions = useMemo(() => {
    if (draft.anchor_type === "lead") return leads;
    if (draft.anchor_type === "sales_order") return orders;
    if (draft.anchor_type === "production_order") return productionOrders;
    return [];
  }, [draft.anchor_type, leads, orders, productionOrders]);

  const update = <K extends keyof WorkTaskCreateDraft>(
    field: K,
    value: WorkTaskCreateDraft[K],
  ) => {
    setDraft((current) => {
      const next = { ...current, [field]: value };
      if (field === "anchor_type" && !lockedAnchor) {
        next.anchor_id = "";
      }
      return next;
    });
    setError("");
  };

  const close = () => {
    if (saving) return;
    setDraft(draftFromLocked(lockedAnchor));
    setError("");
    onClose();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateWorkTaskCreateDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      const result = await createWorkTask(workTaskCreateDraftToPayload(draft));
      if (!result.ok) {
        setError(result.message);
        return;
      }
      pushToast("Задача создана", "success");
      setDraft(draftFromLocked(lockedAnchor));
      setError("");
      onClose();
      onCreated?.(result.data);
      if (navigateOnCreate) {
        router.push(result.data.href);
      }
      router.refresh();
    } catch {
      setError("Не удалось связаться с API. Задача не создана.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CreateDrawer
      open={open}
      title="Новая задача"
      description={
        lockedAnchor
          ? `Объект: ${lockedAnchor.label}. Цех и участники (ADR-028).`
          : "Привязка к одному объекту, цех и участники (ADR-028)."
      }
      onClose={close}
      variant="overlay"
    >
      <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 space-y-portal-4 overflow-y-auto p-portal-6">
          <Field label="Название" required>
            <Input
              autoFocus
              required
              maxLength={255}
              value={draft.title}
              onChange={(event) => update("title", event.target.value)}
              disabled={saving}
            />
          </Field>
          {lockedAnchor ? (
            <Field label="Объект">
              <Input value={lockedAnchor.label} readOnly disabled />
            </Field>
          ) : (
            <>
              <Field label="Тип объекта" required>
                <Select
                  required
                  value={draft.anchor_type}
                  onChange={(event) =>
                    update(
                      "anchor_type",
                      event.target.value as WorkTaskAnchorType | "",
                    )
                  }
                  disabled={saving}
                >
                  <option value="">Выберите…</option>
                  {(
                    Object.keys(workTaskAnchorTypeLabels) as WorkTaskAnchorType[]
                  ).map((value) => (
                    <option key={value} value={value}>
                      {workTaskAnchorTypeLabels[value]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Объект" required>
                <Select
                  required
                  value={draft.anchor_id}
                  onChange={(event) => update("anchor_id", event.target.value)}
                  disabled={saving || !draft.anchor_type}
                >
                  <option value="">
                    {draft.anchor_type ? "Выберите…" : "Сначала тип объекта"}
                  </option>
                  {anchorOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}
          <Field label="Цех">
            <Select
              value={draft.production_stage_id}
              onChange={(event) =>
                update("production_stage_id", event.target.value)
              }
              disabled={saving}
            >
              <option value="">Не назначен</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ответственный">
            <Select
              value={draft.responsible_platform_user_id}
              onChange={(event) =>
                update("responsible_platform_user_id", event.target.value)
              }
              disabled={saving}
            >
              <option value="">Не назначен</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Исполнитель">
            <Select
              value={draft.executor_platform_user_id}
              onChange={(event) =>
                update("executor_platform_user_id", event.target.value)
              }
              disabled={saving}
            >
              <option value="">Не назначен</option>
              {users.map((user) => (
                <option key={`ex-${user.id}`} value={user.id}>
                  {user.label}
                </option>
              ))}
            </Select>
          </Field>
          {error ? (
            <p className="text-sm text-portal-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 justify-end gap-portal-2 border-t border-portal-border px-portal-6 py-portal-4">
          <Button type="button" variant="ghost" onClick={close} disabled={saving}>
            Отмена
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Создание…" : "Создать"}
          </Button>
        </div>
      </form>
    </CreateDrawer>
  );
}
