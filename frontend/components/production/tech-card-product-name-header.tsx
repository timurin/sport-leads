"use client";

import { Pencil, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { updateTechnicalCardProductNameAction } from "@/app/(workspace)/production/tech-cards/tech-card-actions";
import { IconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import { techCardPositionLabel } from "@/lib/production/tech-cards";
import type { ApiTechnicalCard } from "@/lib/sales/order-tech-cards-api";

type TechCardProductNameHeaderProps = {
  card: ApiTechnicalCard;
  allowEdit?: boolean;
  disabled?: boolean;
};

export function TechCardProductNameHeader({
  card,
  allowEdit = false,
  disabled = false,
}: TechCardProductNameHeaderProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(card.nomenclature_name ?? "");
  const viewLabel = techCardPositionLabel(card);
  const controlsDisabled = disabled || pending;

  const beginEdit = () => {
    setDraft(card.nomenclature_name ?? "");
    setError(null);
    setEditing(true);
  };

  const onCancel = () => {
    setEditing(false);
    setError(null);
    setDraft(card.nomenclature_name ?? "");
  };

  const onSave = async () => {
    setPending(true);
    setError(null);
    const trimmed = draft.trim();
    const result = await updateTechnicalCardProductNameAction(
      card.id,
      trimmed.length === 0 ? null : trimmed,
    );
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setEditing(false);
    router.refresh();
  };

  const printNameCaption = (
    <p
      className="text-portal-caption text-portal-muted"
      data-tech-card-print-name-label
    >
      Название изделия для печати:
    </p>
  );

  if (!allowEdit || !editing) {
    return (
      <div data-tech-card-product-name className="flex min-w-0 flex-col gap-0.5 text-portal-text">
        {printNameCaption}
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <span className="min-w-0">{viewLabel}</span>
          {allowEdit ? (
            <div
              className="flex items-center gap-1"
              role="toolbar"
              aria-label="Правка наименования изделия"
              data-tech-card-product-name-chrome
            >
              <IconButton
                label="Редактировать наименование изделия"
                variant="ghost"
                disabled={disabled}
                onClick={beginEdit}
              >
                <Pencil className="size-4" aria-hidden="true" />
              </IconButton>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div data-tech-card-product-name className="flex min-w-0 flex-col gap-1 text-portal-text">
      {printNameCaption}
      {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <Input
          data-tech-card-product-name-input
          size="compact"
          value={draft}
          maxLength={255}
          disabled={controlsDisabled}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Наименование изделия"
          className="min-w-0 max-w-md"
        />
        <div
          className="flex items-center gap-1"
          role="toolbar"
          aria-label="Правка наименования изделия"
          data-tech-card-product-name-chrome
        >
          <IconButton
            label="Отменить"
            variant="secondary"
            disabled={controlsDisabled}
            onClick={onCancel}
          >
            <X className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            label="Сохранить"
            variant="primary"
            disabled={controlsDisabled}
            onClick={() => void onSave()}
          >
            <Save className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
