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
}: NomenclatureSectionCreateHostProps) {
  const searchParams = useSearchParams();
  const [createKind, setCreateKind] = useState<NomenclatureCreateKind | null>(
    () => parseNomenclatureCreateKind(searchParams.get("create")),
  );

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
          onClose={() => setCreateKind(null)}
          variant="fullscreen"
        />
      </div>
    </div>
  );
}
