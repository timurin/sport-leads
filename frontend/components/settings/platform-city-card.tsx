"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  deletePlatformCity,
  updatePlatformCity,
} from "@/app/(workspace)/settings/platform-directories/platform-directory-actions";
import { SimpleEntityCard } from "@/components/entity/simple-entity-card";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form-controls";
import { EntityHeader } from "@/components/ui/entity-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import {
  cityToDraft,
  validatePlatformCityDraft,
  type PlatformCity,
  type PlatformCityDraft,
} from "@/lib/platform-directories";

export function PlatformCityCard({
  city,
  canWrite,
}: {
  city: PlatformCity;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [draft, setDraft] = useState<PlatformCityDraft>(() => cityToDraft(city));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => {
    const baseline = cityToDraft(city);
    return (
      baseline.name !== draft.name.trim() ||
      baseline.region !== draft.region.trim() ||
      baseline.is_active !== draft.is_active ||
      baseline.sort_order !== draft.sort_order
    );
  }, [city, draft]);

  const save = async () => {
    if (!canWrite) return;
    setError(null);
    const validation = validatePlatformCityDraft(draft);
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    const result = await updatePlatformCity(city.id, draft);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDraft(cityToDraft(result.city));
    pushToast("Город сохранён", "success");
    router.refresh();
  };

  const remove = async () => {
    if (!canWrite) return;
    if (!window.confirm(`Удалить город «${city.name}»?`)) return;
    setSaving(true);
    const result = await deletePlatformCity(city.id);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    pushToast("Город удалён", "success");
    router.push("/settings/platform-directories/cities");
    router.refresh();
  };

  return (
    <SimpleEntityCard
      header={
        <EntityHeader
          eyebrow={
            <Link
              href="/settings/platform-directories/cities"
              className="text-portal-primary hover:underline"
            >
              Города
            </Link>
          }
          title={city.name}
          description="Карточка города справочника платформы"
          status={
            <StatusBadge
              size="compact"
              tone={draft.is_active ? "success" : "neutral"}
            >
              {draft.is_active ? "Активен" : "Выкл."}
            </StatusBadge>
          }
          actions={
            <div className="flex flex-wrap items-center gap-portal-2">
              <Link
                href="/settings/platform-directories/cities"
                className="portal-focus-ring inline-flex h-portal-control-default items-center justify-center gap-portal-2 rounded-portal-md border border-portal-border bg-portal-surface px-portal-4 text-portal-body font-medium text-portal-text hover:bg-portal-state-hover"
              >
                ← К списку
              </Link>
              {canWrite ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={saving || !dirty}
                    onClick={() => {
                      setDraft(cityToDraft(city));
                      setError(null);
                    }}
                  >
                    Сбросить
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={saving || !dirty}
                    onClick={() => void save()}
                  >
                    {saving ? "Сохранение…" : "Сохранить"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={saving}
                    onClick={() => void remove()}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Удалить
                  </Button>
                </>
              ) : null}
            </div>
          }
        />
      }
    >
      <SectionCard title="Реквизиты" size="compact">
        {error ? (
          <p className="mb-portal-3 text-portal-body text-portal-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="grid gap-portal-4 md:grid-cols-2">
          <Field label="Название" htmlFor="city-name">
            <Input
              id="city-name"
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
              disabled={!canWrite || saving}
            />
          </Field>
          <Field label="Регион" htmlFor="city-region">
            <Input
              id="city-region"
              value={draft.region}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  region: event.target.value,
                }))
              }
              disabled={!canWrite || saving}
            />
          </Field>
          <Field label="Порядок" htmlFor="city-sort">
            <Input
              id="city-sort"
              type="number"
              value={String(draft.sort_order)}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  sort_order: Number(event.target.value) || 0,
                }))
              }
              disabled={!canWrite || saving}
            />
          </Field>
          <label className="flex items-center gap-portal-2 self-end pb-portal-2 text-portal-body text-portal-text">
            <Checkbox
              checked={draft.is_active}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  is_active: event.target.checked,
                }))
              }
              disabled={!canWrite || saving}
            />
            Активен
          </label>
        </div>
      </SectionCard>
    </SimpleEntityCard>
  );
}
