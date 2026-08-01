"use client";

import { Checkbox } from "@/components/ui/form-controls";
import { toggleSewingWorkCenterId } from "@/lib/sewing-operations";
import type { WorkCenter } from "@/lib/shop-routings";

type SewingOperationEquipmentPickerProps = {
  workCenters: WorkCenter[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
  idPrefix: string;
  compact?: boolean;
};

/** Multi-select of active sewing-shop WorkCenters (`6.3.10.4`). */
export function SewingOperationEquipmentPicker({
  workCenters,
  selectedIds,
  onChange,
  disabled = false,
  idPrefix,
  compact = false,
}: SewingOperationEquipmentPickerProps) {
  if (workCenters.length === 0) {
    return (
      <p className="text-portal-caption text-portal-muted">
        Нет активного оборудования цеха Пошив. Добавьте станки в справочнике
        «Оборудование».
      </p>
    );
  }

  return (
    <div className="space-y-portal-2">
      <p className="text-portal-caption text-portal-muted">
        Выбрано: {selectedIds.length}
      </p>
      <ul
        className={
          compact
            ? "max-h-36 space-y-portal-1 overflow-y-auto rounded-portal-md border border-portal-border p-portal-2"
            : "divide-y divide-portal-border overflow-hidden rounded-portal-md border border-portal-border"
        }
      >
        {workCenters.map((row) => {
          const checked = selectedIds.includes(row.id);
          const controlId = `${idPrefix}-${row.id}`;
          return (
            <li
              key={row.id}
              className={compact ? undefined : "px-portal-3 py-portal-2"}
            >
              <Checkbox
                id={controlId}
                checked={checked}
                disabled={disabled}
                onChange={() =>
                  onChange(toggleSewingWorkCenterId(selectedIds, row.id))
                }
                label={`${row.name} (${row.code})`}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
