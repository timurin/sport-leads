"use client";

import { Save, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { updateTechnicalCardSettings } from "@/app/(workspace)/settings/catalogs/tech-cards/tech-card-settings-actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Radio } from "@/components/ui/form-controls";
import { SectionCard } from "@/components/ui/section-card";
import {
  isTechnicalCardSettingsDirty,
  TECHNICAL_CARD_ELIGIBLE_TYPE_OPTIONS,
  TECHNICAL_CARD_UNIT_FIELD_OPTIONS,
  toTechnicalCardSettingsDraft,
  validateTechnicalCardSettingsDraft,
  type TechnicalCardSettings,
  type TechnicalCardSettingsDraft,
} from "@/lib/technical-card-settings";

type Props = {
  settings: TechnicalCardSettings;
};

export function TechnicalCardSettingsWorkspace({ settings }: Props) {
  const [currentSettings, setCurrentSettings] = useState<TechnicalCardSettings>(
    settings,
  );
  const [draft, setDraft] = useState<TechnicalCardSettingsDraft>(() =>
    toTechnicalCardSettingsDraft(settings),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const dirty = useMemo(
    () => isTechnicalCardSettingsDirty(currentSettings, draft),
    [currentSettings, draft],
  );
  const validationError = useMemo(
    () => validateTechnicalCardSettingsDraft(draft),
    [draft],
  );

  const toggleEligible = (
    value: TechnicalCardSettingsDraft["eligible_nomenclature_types"][number],
    checked: boolean,
  ) => {
    setDraft((current) => {
      const next = checked
        ? [...current.eligible_nomenclature_types, value]
        : current.eligible_nomenclature_types.filter((item) => item !== value);
      return {
        ...current,
        eligible_nomenclature_types: Array.from(new Set(next)),
      };
    });
  };

  const save = async () => {
    setError(null);
    setSavedAt(null);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    const result = await updateTechnicalCardSettings(draft);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setCurrentSettings(result.settings);
    setDraft(toTechnicalCardSettingsDraft(result.settings));
    setSavedAt(new Date().toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    }));
  };

  return (
    <div className="min-w-0 flex-1 overflow-auto bg-portal-bg">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-portal-4 p-portal-4 lg:p-portal-6">
        <SectionCard
          title="Настройки технических карт"
          description="Документные defaults для генерации и поштучной матрицы. Каталоги техопераций, маршрутов и цехов остаются в Stage 8 и не дублируются здесь."
          actions={
            <div className="flex flex-wrap items-center gap-portal-2">
              <Button
                type="button"
                variant="secondary"
                disabled={saving || !dirty}
                onClick={() => {
                  setDraft(toTechnicalCardSettingsDraft(currentSettings));
                  setError(null);
                  setSavedAt(null);
                }}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Сбросить
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={saving || !dirty || validationError != null}
                onClick={() => void save()}
              >
                <Save className="size-4" aria-hidden="true" />
                {saving ? "Сохранение…" : "Сохранить"}
              </Button>
            </div>
          }
          footer={
            <div className="flex flex-wrap items-center justify-between gap-portal-2 text-portal-caption">
              <span className="text-portal-muted">
                Пока effect wiring ещё доводится в `9.6.4`, здесь фиксируется
                единый контракт настроек без дублирования Stage 8.
              </span>
              {savedAt ? (
                <span className="text-portal-success">Сохранено в {savedAt}</span>
              ) : dirty ? (
                <span className="text-portal-warning">Есть несохранённые изменения</span>
              ) : (
                <span className="text-portal-muted">Изменений нет</span>
              )}
            </div>
          }
        >
          <div className="grid gap-portal-4">
            {error ? (
              <p
                className="rounded-portal-md border border-portal-danger/30 bg-portal-danger-soft px-portal-4 py-portal-3 text-portal-body text-portal-danger"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <SectionCard
              title="Eligibility"
              description="Какие типы номенклатуры допускаются для генерации техкарт. Базовый инвариант ADR-016 сохраняется: одна техкарта на одну строку заказа."
              size="compact"
            >
              <div className="grid gap-portal-3">
                {TECHNICAL_CARD_ELIGIBLE_TYPE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-start gap-portal-3 rounded-portal-md border border-portal-border bg-portal-surface-secondary px-portal-3 py-portal-3"
                  >
                    <Checkbox
                      checked={draft.eligible_nomenclature_types.includes(
                        option.value,
                      )}
                      onChange={(event) =>
                        toggleEligible(option.value, event.target.checked)
                      }
                      disabled={saving}
                      aria-label={option.label}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-portal-text">
                        {option.label}
                      </span>
                      <span className="block text-portal-caption text-portal-muted">
                        Код типа: {option.value}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Нумерация"
              description="Шаблон default-нумерации техкарты. Семантика `orderNo + stable cardSeq` остаётся базовой по ADR-016."
              size="compact"
            >
              <Field
                label="Шаблон номера"
                htmlFor="technical-card-numbering-template"
                help="MVP default: `{orderNo}-{cardSeq}`. Редактор оставлен в рамках контракта настроек, применение в сервисах завершается в `9.6.4`."
              >
                <Input
                  id="technical-card-numbering-template"
                  value={draft.numbering_template}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      numbering_template: event.target.value,
                    }))
                  }
                  disabled={saving}
                />
              </Field>
            </SectionCard>

            <SectionCard
              title="Поля поштучной матрицы"
              description="Управляет активными полями unit lines и агрегированного импорта без изменения самой модели строки."
              size="compact"
            >
              <div className="grid gap-portal-3">
                {TECHNICAL_CARD_UNIT_FIELD_OPTIONS.map((option) => (
                  <label
                    key={option.key}
                    className="flex items-start gap-portal-3 rounded-portal-md border border-portal-border bg-portal-surface-secondary px-portal-3 py-portal-3"
                  >
                    <Checkbox
                      checked={draft[option.key]}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          [option.key]: event.target.checked,
                        }))
                      }
                      disabled={saving}
                      aria-label={option.label}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-portal-text">
                        {option.label}
                      </span>
                      <span className="block text-portal-caption text-portal-muted">
                        {option.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Подпись этапа"
              description="Execution gates продолжают работать по `production_stage_id`; настройка задаёт только display policy для label."
              size="compact"
            >
              <div className="grid gap-portal-3">
                <Radio
                  checked={draft.stage_label_binding_mode === "snapshot"}
                  onChange={() =>
                    setDraft((current) => ({
                      ...current,
                      stage_label_binding_mode: "snapshot",
                    }))
                  }
                  disabled
                  label="Snapshot label from route/card state"
                />
                <p className="text-portal-caption text-portal-muted">
                  В MVP свободный текст и альтернативные политики не
                  поддерживаются: UI фиксирует принятую в ADR-016 модель.
                </p>
              </div>
            </SectionCard>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
