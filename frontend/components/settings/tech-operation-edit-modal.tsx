"use client";

import { CircleAlert, TriangleAlert, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { updateTechOperation } from "@/app/(workspace)/settings/catalogs/tech-operations/tech-operation-actions";
import { TechOperationResourcesPanel } from "@/components/settings/tech-operation-capacity-fields";
import { Button, IconButton } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import type { CapacityResource } from "@/lib/tech-operation-capacity";
import {
  DEMAND_RULE_LABEL,
  demandDurationField,
  demandRuleHint,
  isDemandRule,
  parseDemandDuration,
  type DemandRule,
} from "@/lib/tech-operation-demand";
import {
  diagnosticHighlight,
  diagnosticsOnTab,
  fieldHighlight,
  headerDiagnosticPreview,
  highlightClass,
  openingTab,
  sectionSetupText,
} from "@/lib/production/readiness-highlight";
import { diagnosticKey, readDiagnostics, type ProductionDiagnostic } from "@/lib/production/readiness-stickers";
import { calculationModeLabel, operationMode, type OperationEditorTab } from "@/lib/tech-operation-ux";
import {
  TECH_OPERATION_VOLUME_UNIT_LABELS,
  type TechOperation,
  type TechOperationDraft,
  type TechOperationVolumeUnit,
} from "@/lib/tech-operations";
import type { ProductionStage } from "@/lib/production-stages";
import type { WorkCenter } from "@/lib/shop-routings";

function operationDraft(operation: TechOperation): TechOperationDraft {
  const duration = demandDurationField(operation.demand_duration_seconds);
  return {
    name: operation.name, code: operation.code, volume_unit: operation.volume_unit,
    production_stage_id: operation.production_stage_id, is_active: operation.is_active,
    required_materials: operation.required_materials.map((material) => ({ ...material })),
    capacity_resource_keys: operation.capacity_resource_keys ?? [],
    demand_rule: isDemandRule(operation.demand_rule) ? operation.demand_rule : null,
    demand_duration_minutes: duration.value,
    demand_duration_unit: duration.unit,
  };
}

function DiagnosticAlert({ rows, onSelect }: { rows: ProductionDiagnostic[]; onSelect: (row: ProductionDiagnostic) => void }) {
  const [open, setOpen] = useState(false);
  const preview = headerDiagnosticPreview(rows);
  if (!preview.first) return null;
  const tone = preview.first.severity === "warning"
    ? "border-portal-warning bg-portal-warning-soft text-portal-warning"
    : preview.first.severity === "info"
      ? "border-portal-border bg-portal-surface-secondary text-portal-text"
      : "border-portal-danger bg-portal-danger-soft text-portal-danger";
  const Icon = preview.first.severity === "warning" ? TriangleAlert : CircleAlert;
  return (
    <div className={`mt-portal-2 rounded-portal-md border px-portal-3 py-portal-2 ${tone}`} data-readiness-alert role="alert">
      <div className="flex items-start gap-portal-2">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <button type="button" className="text-left text-portal-caption font-medium" onClick={() => onSelect(preview.first as ProductionDiagnostic)}>
          {preview.first.message}
        </button>
      </div>
      {preview.rest.length > 0 && !open ? (
        <button type="button" className="mt-1 text-portal-caption font-medium underline" onClick={() => setOpen(true)}>
          Ещё {preview.rest.length}
        </button>
      ) : null}
      {open ? preview.rest.map((row) => (
        <button key={diagnosticKey(row)} type="button" className="mt-1 block text-left text-portal-caption" onClick={() => onSelect(row)}>
          {row.message}
        </button>
      )) : null}
    </div>
  );
}

const EDITOR_TABS: Array<{ id: OperationEditorTab; label: string }> = [
  { id: "main", label: "Основное" },
  { id: "capacity", label: "Мощность" },
  { id: "equipment", label: "Оборудование" },
  { id: "schedule", label: "График" },
  { id: "exceptions", label: "Исключения" },
];

export function TechOperationEditModal({ operation, productionStages, workCenters, resources, operations, materialOptions, initialTab = "main", focusField = null, onClose, onSaved, onResourceSaved, onOperationKeys }: {
  operation: TechOperation;
  productionStages: ProductionStage[];
  workCenters: WorkCenter[];
  resources: CapacityResource[];
  operations: TechOperation[];
  materialOptions: Array<{ id: number; name: string; unit: string; is_active: boolean }>;
  onClose: () => void;
  onSaved: (operation: TechOperation) => void;
  onResourceSaved: (resource: CapacityResource) => void;
  onOperationKeys: (operationId: number, keys: string[]) => void;
  initialTab?: OperationEditorTab;
  focusField?: string | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pendingRef = useRef(false);
  const [initialDraft] = useState(() => operationDraft(operation));
  const [draft, setDraft] = useState(initialDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingException, setPendingException] = useState(false);
  const [resourceDirty, setResourceDirty] = useState(false);
  const diagnostics = readDiagnostics(operation.diagnostics);
  const [tab, setTab] = useState<OperationEditorTab>(() => openingTab({
    requestedTab: initialTab,
    requestedField: focusField,
    diagnostics: readDiagnostics(operation.diagnostics),
    userSteered: false,
  }));
  const [seenTab, setSeenTab] = useState(initialTab);
  if (initialTab !== seenTab) {
    setSeenTab(initialTab);
    setTab(initialTab);
  }
  const [pinnedField, setPinnedField] = useState<string | null>(focusField);
  const [seenFocus, setSeenFocus] = useState(focusField);
  if (focusField !== seenFocus) {
    setSeenFocus(focusField);
    setPinnedField(focusField);
  }
  const [focusNonce, setFocusNonce] = useState(0);
  const dirty = pendingException || resourceDirty || JSON.stringify(draft) !== JSON.stringify(initialDraft);

  const requestClose = useCallback(() => {
    if (pendingRef.current) return;
    if (dirty && !window.confirm("Есть несохранённые изменения. Закрыть без сохранения?")) return;
    onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    if (!pinnedField) return;
    const node = document.querySelector(`[data-diagnostic-field="${pinnedField}"]`)
      ?? document.querySelector(`[data-diagnostic-section="${pinnedField}"]`);
    if (!(node instanceof HTMLElement)) return;
    node.scrollIntoView({ block: "nearest" });
    node.focus();
  }, [pinnedField, tab, focusNonce]);

  useEffect(() => {
    if (!dirty && !saving) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, saving]);

  function update<K extends keyof TechOperationDraft>(key: K, value: TechOperationDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    if (pendingException) {
      setError("Добавьте заполненное исключение в список или очистите его поля перед сохранением.");
      return;
    }
    pendingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const result = await updateTechOperation(operation.id, draft);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onSaved(result.operation);
    } catch {
      setError("Не удалось сохранить изменения. Проверьте соединение и повторите попытку.");
    } finally {
      pendingRef.current = false;
      setSaving(false);
    }
  }

  const demandRuleRow = diagnostics.find((item) => diagnosticHighlight(item).fieldId === "demand_rule");
  const durationHit = fieldHighlight(diagnostics, "demand_duration_seconds");
  const pinnedHit = pinnedField ? fieldHighlight(diagnostics, pinnedField) : null;
  const pinnedResource = diagnostics.find((item) => diagnosticHighlight(item).fieldId === pinnedField)?.resource_key ?? null;

  const stageOptions = productionStages
    .filter((stage) => stage.is_active || stage.id === draft.production_stage_id)
    .toSorted((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "ru"));

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="tech-operation-edit-title"
      className="fixed inset-0 m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-4xl overflow-hidden rounded-portal-lg border border-portal-border bg-portal-surface p-0 text-portal-text shadow-portal-overlay backdrop:bg-[#101828]/40"
      onCancel={(event) => { event.preventDefault(); requestClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) requestClose();
      }}
    >
      <form onSubmit={submit} className="flex max-h-[calc(100dvh_-_2rem)] min-h-0 flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-portal-3 border-b border-portal-border px-portal-4 py-portal-4 sm:px-portal-6">
          <div className="min-w-0 flex-1 basis-48">
            <h2 id="tech-operation-edit-title" className="text-portal-section font-semibold">Редактирование операции</h2>
            <p className="mt-1 break-words text-portal-caption text-portal-muted">{operation.name}</p>
            <DiagnosticAlert rows={diagnostics} onSelect={(row) => {
              const target = diagnosticHighlight(row);
              setTab(target.tab);
              setPinnedField(target.fieldId);
              setFocusNonce((current) => current + 1);
            }} />
          </div>
          <div className="flex shrink-0 items-center gap-portal-2">
            <Button type="submit" variant="primary" size="compact" disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Button>
            <Button type="button" size="compact" disabled={saving} onClick={requestClose}>Отмена</Button>
            <IconButton label="Закрыть окно редактирования" disabled={saving} onClick={requestClose}><X className="size-4" aria-hidden="true" /></IconButton>
          </div>
        </header>
        <div className="flex shrink-0 gap-portal-2 overflow-x-auto border-b border-portal-border px-portal-4" role="tablist" aria-label="Разделы операции">
          {EDITOR_TABS.map((item) => {
            const count = diagnosticsOnTab(diagnostics, item.id).length;
            return (
              <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={`border-b-2 px-portal-3 py-portal-2 text-portal-caption font-medium ${tab === item.id ? "border-portal-primary text-portal-primary" : "border-transparent text-portal-muted"}`} onClick={() => setTab(item.id)}>
                {item.label}
                {count > 0 ? <span className="ml-1 rounded-portal-full bg-portal-danger-soft px-1.5 text-portal-danger" data-tab-diagnostic-count={count}>{count}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="min-h-0 space-y-portal-5 overflow-y-auto px-portal-4 py-portal-5 sm:px-portal-6">
          {error ? <p role="alert" className="rounded-portal-md bg-portal-danger-soft p-portal-3 text-portal-body text-portal-danger">{error}</p> : null}
          {tab === "main" ? <fieldset disabled={saving} className="grid min-w-0 gap-portal-4 sm:grid-cols-2">
            <Field label="Наименование" htmlFor="tech-operation-name" required className={fieldHighlight(diagnostics, "name")?.scope === "field" ? highlightClass(fieldHighlight(diagnostics, "name")!.tone) : undefined} error={fieldHighlight(diagnostics, "name")?.scope === "field" ? fieldHighlight(diagnostics, "name")?.message : undefined}><Input id="tech-operation-name" data-diagnostic-field="name" invalid={fieldHighlight(diagnostics, "name")?.tone === "danger"} autoFocus required maxLength={255} value={draft.name} onChange={(event) => update("name", event.target.value)} /></Field>
            <Field label="Код" htmlFor="tech-operation-code" required className={fieldHighlight(diagnostics, "code")?.scope === "field" ? highlightClass(fieldHighlight(diagnostics, "code")!.tone) : undefined} error={fieldHighlight(diagnostics, "code")?.scope === "field" ? fieldHighlight(diagnostics, "code")?.message : undefined}><Input id="tech-operation-code" data-diagnostic-field="code" invalid={fieldHighlight(diagnostics, "code")?.tone === "danger"} required maxLength={64} value={draft.code} onChange={(event) => update("code", event.target.value)} /></Field>
            <Field label="Единица объёма" htmlFor="tech-operation-unit"><Select id="tech-operation-unit" value={draft.volume_unit} onChange={(event) => update("volume_unit", event.target.value as TechOperationVolumeUnit)}>
              <option value="pieces">{TECH_OPERATION_VOLUME_UNIT_LABELS.pieces}</option>
              <option value="linear_meters">{TECH_OPERATION_VOLUME_UNIT_LABELS.linear_meters}</option>
            </Select></Field>
            <Field label="Цех" htmlFor="tech-operation-stage"><Select id="tech-operation-stage" data-diagnostic-field="production_stage_id" value={draft.production_stage_id ?? ""} onChange={(event) => update("production_stage_id", event.target.value ? Number(event.target.value) : null)}>
              <option value="">Не указан</option>
              {draft.production_stage_id != null && !stageOptions.some((stage) => stage.id === draft.production_stage_id) ? <option value={draft.production_stage_id}>Цех #{draft.production_stage_id} (недоступен в списке)</option> : null}
              {stageOptions.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}{stage.is_active ? "" : " (отключён)"}</option>)}
            </Select></Field>
            <span data-diagnostic-field="is_active"><Checkbox label="Активна" checked={draft.is_active} onChange={(event) => update("is_active", event.target.checked)} /></span>
            <Field className="sm:col-span-2" label="Как рассчитывается потребность" help="Определяет, откуда система получает объём работы для конкретной техкарты.">
              {(() => {
                const mode = operationMode(draft.capacity_resource_keys ?? [], resources);
                const duration = parseDemandDuration(draft.demand_duration_minutes ?? "", draft.demand_duration_unit ?? "min");
                const ruleHit = demandRuleRow ? fieldHighlight(diagnostics, "demand_rule") : null;
                return (
                  <div className="grid gap-portal-3">
                    <p tabIndex={-1} data-diagnostic-field="calculation_mode" className="text-portal-body" title={mode ?? undefined}>
                      {mode ? calculationModeLabel(mode) : "Не задан"}
                    </p>
                    {mode === "explicit_hours" ? (
                      <div
                        data-diagnostic-section="demand_rule"
                        className={ruleHit?.scope === "section" ? `grid gap-portal-3 sm:grid-cols-2 ${highlightClass(ruleHit.tone)}` : "grid gap-portal-3 sm:grid-cols-2"}
                      >
                        {demandRuleRow && ruleHit?.scope === "section" ? <p className="text-portal-caption sm:col-span-2">{sectionSetupText(demandRuleRow)}</p> : null}
                        <Field label="Основа расчёта" htmlFor="tech-operation-demand-rule">
                          <Select
                            id="tech-operation-demand-rule"
                            data-diagnostic-field="demand_rule"
                            invalid={ruleHit?.tone === "danger"}
                            value={draft.demand_rule ?? ""}
                            onChange={(event) => update("demand_rule", isDemandRule(event.target.value) ? event.target.value : null)}
                          >
                            <option value="">Не выбрана</option>
                            {(Object.keys(DEMAND_RULE_LABEL) as DemandRule[]).map((rule) => (
                              <option key={rule} value={rule}>{DEMAND_RULE_LABEL[rule]}</option>
                            ))}
                          </Select>
                        </Field>
                        <Field
                          label="Норма времени"
                          htmlFor="tech-operation-demand-duration"
                          className={durationHit?.scope === "field" ? highlightClass(durationHit.tone) : undefined}
                          error={durationHit?.scope === "field" ? durationHit.message : undefined}
                        >
                          <div className="flex items-center gap-portal-2">
                            <Input
                              id="tech-operation-demand-duration"
                              data-diagnostic-field="demand_duration_seconds"
                              invalid={durationHit?.tone === "danger"}
                              inputMode="decimal"
                              value={draft.demand_duration_minutes ?? ""}
                              onChange={(event) => update("demand_duration_minutes", event.target.value)}
                            />
                            <span className="shrink-0 text-portal-caption text-portal-muted">{draft.demand_duration_unit === "sec" ? "сек." : "мин."}</span>
                          </div>
                        </Field>
                        <p className={`text-portal-caption sm:col-span-2 ${duration.error ? "text-portal-danger" : "text-portal-muted"}`}>{duration.error ?? demandRuleHint(draft.demand_rule ?? null, duration.seconds)}</p>
                      </div>
                    ) : null}
                  </div>
                );
              })()}
            </Field>
          </fieldset> : null}
          {tab === "main" ? <section className="space-y-portal-3 border-t border-portal-border pt-portal-4" aria-label="Необходимые материалы">
            <div className="flex flex-wrap items-center justify-between gap-portal-2">
              <h3 className="font-semibold">Необходимые материалы</h3>
              <Button type="button" size="compact" disabled={saving} onClick={() => update("required_materials", [...draft.required_materials, { nomenclature_id: 0, quantity: "" }])}>Добавить материал</Button>
            </div>
            {draft.required_materials.length === 0 ? <p className="text-portal-caption text-portal-muted">Материалы не заданы.</p> : null}
            {draft.required_materials.map((material, index) => (
              <fieldset key={index} disabled={saving} className="grid min-w-0 items-end gap-portal-3 rounded-portal-md border border-portal-border p-portal-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Field label="Материал" required><Select required value={material.nomenclature_id || ""} onChange={(event) => {
                  const option = materialOptions.find((row) => row.id === Number(event.target.value));
                  update("required_materials", draft.required_materials.map((row, rowIndex) => rowIndex === index ? { ...row, nomenclature_id: Number(event.target.value), nomenclature_name: option?.name, unit: option?.unit } : row));
                }}>
                  <option value="">Выберите материал</option>
                  {!materialOptions.some((option) => option.id === material.nomenclature_id) && material.nomenclature_id > 0 ? <option value={material.nomenclature_id}>{material.nomenclature_name ?? `#${material.nomenclature_id}`}</option> : null}
                  {materialOptions.map((option) => <option key={option.id} value={option.id}>{option.name} · {option.unit}</option>)}
                </Select></Field>
                <Field label={`Расход на 1 ${TECH_OPERATION_VOLUME_UNIT_LABELS[draft.volume_unit]}`} required><Input required type="number" min="0" step="0.001" value={String(material.quantity)} onChange={(event) => update("required_materials", draft.required_materials.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))} /></Field>
                <IconButton label="Удалить материал" disabled={saving} onClick={() => update("required_materials", draft.required_materials.filter((_, rowIndex) => rowIndex !== index))}><X className="size-4" aria-hidden="true" /></IconButton>
              </fieldset>
            ))}
          </section> : null}
          <section className={tab === "main" ? "hidden" : "border-t border-portal-border pt-portal-4"} hidden={tab === "main"}>
            <TechOperationResourcesPanel
              operationId={operation.id}
              resourceKeys={draft.capacity_resource_keys ?? []}
              resources={resources}
              operations={operations}
              productionStages={productionStages}
              workCenters={workCenters}
              disabled={saving}
              view={tab === "main" ? "capacity" : tab}
              diagnosticField={pinnedField}
              diagnosticResourceKey={pinnedResource}
              diagnosticMessage={pinnedHit?.message ?? null}
              diagnosticTone={pinnedHit?.tone ?? null}
              onDiagnosticReady={() => setFocusNonce((current) => current + 1)}
              onDraftDirty={setResourceDirty}
              onKeysChange={(keys) => {
                update("capacity_resource_keys", keys);
                onOperationKeys(operation.id, keys);
              }}
              onResourceSaved={onResourceSaved}
              onPendingExceptionChange={setPendingException}
            />
          </section>
        </div>
      </form>
    </dialog>
  );
}
