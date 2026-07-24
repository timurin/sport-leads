"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

import { NomenclatureCreatePanels } from "@/components/settings/nomenclature-create-panels";
import {
  NomenclatureSectionCreateMenu,
  parseNomenclatureCreateKind,
  type NomenclatureCreateKind,
} from "@/components/settings/nomenclature-section-create-menu";
import { PageToolbar } from "@/components/ui/page-header";
import type { NomenclatureCategory, UnitOfMeasure } from "@/lib/nomenclature";

type NomenclatureSectionCreateHostProps = {
  categories?: NomenclatureCategory[];
  units?: UnitOfMeasure[];
  toolbarStart?: ReactNode;
  children: ReactNode;
  /** Prefill category create parent (`4.9.3`). */
  categoryDefaultParentId?: number | null;
  /** Controlled create drawer (optional). */
  createKind?: NomenclatureCreateKind | null;
  onCreateKindChange?: (kind: NomenclatureCreateKind | null) => void;
};

/**
 * Page shell: toolbar create menu + fullscreen CreateDrawer (ADR-013 / 4.7.9).
 * Children may include a left EditDrawer beside the list.
 */
export function NomenclatureSectionCreateHost({
  categories = [],
  units = [],
  toolbarStart,
  children,
  categoryDefaultParentId = null,
  createKind: controlledKind,
  onCreateKindChange,
}: NomenclatureSectionCreateHostProps) {
  const searchParams = useSearchParams();
  const [internalKind, setInternalKind] = useState<NomenclatureCreateKind | null>(
    () => parseNomenclatureCreateKind(searchParams.get("create")),
  );
  const isControlled = onCreateKindChange != null;
  const createKind = isControlled ? (controlledKind ?? null) : internalKind;
  const setCreateKind = (kind: NomenclatureCreateKind | null) => {
    if (isControlled) {
      onCreateKindChange(kind);
    } else {
      setInternalKind(kind);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageToolbar
        start={toolbarStart}
        end={<NomenclatureSectionCreateMenu onSelect={setCreateKind} />}
      />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-auto">{children}</div>
        <NomenclatureCreatePanels
          kind={createKind}
          categories={categories}
          units={units}
          categoryDefaultParentId={categoryDefaultParentId}
          onClose={() => setCreateKind(null)}
          variant="fullscreen"
        />
      </div>
    </div>
  );
}
