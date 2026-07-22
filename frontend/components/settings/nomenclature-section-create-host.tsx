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
import type { NomenclatureCategory } from "@/lib/nomenclature";

type NomenclatureSectionCreateHostProps = {
  categories?: NomenclatureCategory[];
  toolbarStart?: ReactNode;
  children: ReactNode;
};

/**
 * Page shell: toolbar create menu + docked CreateDrawer (materials pattern).
 * Children may include a left EditDrawer beside the list.
 */
export function NomenclatureSectionCreateHost({
  categories = [],
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
          onClose={() => setCreateKind(null)}
        />
      </div>
    </div>
  );
}
