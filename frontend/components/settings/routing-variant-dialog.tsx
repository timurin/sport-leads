"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { RoutingOperationDialog } from "@/components/settings/routing-operation-dialog";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import type { CapacityResource } from "@/lib/tech-operation-capacity";
import type { ProductionStage } from "@/lib/production-stages";
import type { TechOperation } from "@/lib/tech-operations";

export type VariantMemberDraft = {
  key: string | null;
  operationId: number;
};

type RoutingVariantDialogProps = {
  title: string;
  workshopId: number;
  workshopName: string;
  productionStages: ProductionStage[];
  operations: TechOperation[];
  resources: CapacityResource[];
  initialName: string;
  initialCode: string;
  initialMembers: VariantMemberDraft[];
  initialDefaultKey: string | null;
  canDelete: boolean;
  onClose: () => void;
  onDelete: () => void;
  onSave: (value: { name: string; code: string; members: VariantMemberDraft[]; defaultKey: string | null; defaultOperationId: number }) => void;
};

export function RoutingVariantDialog({
  title,
  workshopId,
  workshopName,
  productionStages,
  operations,
  resources,
  initialName,
  initialCode,
  initialMembers,
  initialDefaultKey,
  canDelete,
  onClose,
  onDelete,
  onSave,
}: RoutingVariantDialogProps) {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode);
  const [members, setMembers] = useState(initialMembers);
  const [defaultKey, setDefaultKey] = useState(initialDefaultKey ?? initialMembers[0]?.key ?? null);
  const [picking, setPicking] = useState(false);
  const operationById = new Map(operations.map((operation) => [operation.id, operation]));
  const memberToken = (member: VariantMemberDraft) => member.key ?? `new:${member.operationId}`;
  const defaultMember = members.find((member) => memberToken(member) === defaultKey) ?? members[0];
  const canSave = name.trim().length > 0 && members.length > 0 && defaultMember != null;

  function addMember(operation: TechOperation) {
    setPicking(false);
    setMembers((current) => {
      if (current.some((member) => member.operationId === operation.id)) return current;
      const next = [...current, { key: null, operationId: operation.id }];
      return next;
    });
    setDefaultKey((current) => current ?? `new:${operation.id}`);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-portal-4" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="routing-variant-dialog-title"
        className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4 shadow-portal-overlay"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-portal-3">
          <div className="min-w-0">
            <h2 id="routing-variant-dialog-title" className="text-portal-body font-semibold">{title}</h2>
            <p className="mt-1 text-portal-caption text-portal-muted">Цех: {workshopName}. Выполняется один вариант.</p>
          </div>
          <IconButton label="Закрыть окно" variant="secondary" onClick={onClose}>
            <X className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
        <div className="mt-portal-4 grid gap-portal-3">
          <Field label="Название" required>
            <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={255} />
          </Field>
          <Field label="Код">
            <Input value={code} onChange={(event) => setCode(event.target.value)} maxLength={64} />
          </Field>
          <fieldset>
            <legend className="text-portal-caption text-portal-muted">Варианты</legend>
            <ul className="mt-portal-2 space-y-1">
              {members.map((member, index) => {
                const operation = operationById.get(member.operationId);
                const token = memberToken(member);
                const selected = defaultMember != null && memberToken(defaultMember) === token;
                return (
                  <li key={token} className="flex items-center gap-portal-2 rounded-portal-md border border-portal-border px-portal-2 py-1">
                    <label className="flex min-w-0 flex-1 items-center gap-portal-2">
                      <input
                        type="radio"
                        name="variant-default"
                        checked={selected}
                        onChange={() => setDefaultKey(member.key ?? `new:${member.operationId}`)}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-portal-body">{operation?.name ?? "Операция"}</span>
                        <span className="block text-portal-caption text-portal-muted">{selected ? "По умолчанию" : "Вариант"}</span>
                      </span>
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="compact"
                      onClick={() => {
                        const next = members.filter((_, itemIndex) => itemIndex !== index);
                        setMembers(next);
                        if (selected) setDefaultKey(next[0] ? memberToken(next[0]) : null);
                      }}
                    >
                      Убрать из группы
                    </Button>
                  </li>
                );
              })}
            </ul>
            {members.length === 0 ? <p className="mt-portal-2 text-portal-caption text-portal-muted">Добавьте хотя бы одну операцию и отметьте вариант по умолчанию.</p> : null}
            <Button type="button" className="mt-portal-2" variant="secondary" size="compact" onClick={() => setPicking(true)}>Добавить операцию</Button>
          </fieldset>
          <div className="flex flex-wrap justify-between gap-portal-2">
            {canDelete ? (
              <Button type="button" variant="danger" onClick={onDelete}>Удалить группу</Button>
            ) : <span />}
            <div className="flex gap-portal-2">
              <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
              <Button
                type="button"
                variant="primary"
                disabled={!canSave}
                onClick={() => {
                  if (!defaultMember) return;
                  onSave({
                    name: name.trim(),
                    code: code.trim(),
                    members,
                    defaultKey: defaultMember.key,
                    defaultOperationId: defaultMember.operationId,
                  });
                }}
              >
                Сохранить
              </Button>
            </div>
          </div>
        </div>
      </div>
      {picking ? (
        <RoutingOperationDialog
          title="Добавить операцию в группу"
          workshopId={workshopId}
          workshopName={workshopName}
          productionStages={productionStages}
          operations={operations}
          resources={resources}
          onClose={() => setPicking(false)}
          onSelect={addMember}
        />
      ) : null}
    </div>
  );
}
