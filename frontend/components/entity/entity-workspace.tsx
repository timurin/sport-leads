"use client";

import {
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

import { EntityInspector } from "@/components/entity/entity-inspector";
import { EntityTable } from "@/components/entity/entity-table";
import { EntityToolbar } from "@/components/entity/entity-toolbar";
import { PageHeader } from "@/components/ui/page-header";
import type {
  EntityId,
  EntityRecord,
} from "@/types/entity/entity";
import type {
  EntityDefinition,
} from "@/types/entity/entity-config";

type EntityWorkspaceProps = {
  definition: EntityDefinition;
  records: EntityRecord[];
};

export function EntityWorkspace({
  definition,
  records,
}: EntityWorkspaceProps) {
  const [selectedId, setSelectedId] =
    useState<EntityId | null>(
      records[0]?.id ?? null,
    );

  const [inspectorOpen, setInspectorOpen] =
    useState(true);

  const selectedRecord = useMemo(
    () =>
      records.find(
        (record) =>
          record.id === selectedId,
      ) ?? null,
    [records, selectedId],
  );

  function handleSelect(
    record: EntityRecord,
  ) {
    setSelectedId(record.id);
    setInspectorOpen(true);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={definition.titlePlural}
        description={definition.description}
      />

      <EntityToolbar
        searchPlaceholder={`Поиск: ${definition.titlePlural.toLowerCase()}`}
        createLabel={`Добавить ${definition.title.toLowerCase()}`}
        view={definition.defaultView}
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <section className="min-w-0 flex-1 overflow-auto bg-white">
          <EntityTable
            definition={definition}
            records={records}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        </section>

        {inspectorOpen ? (
          <section className="w-[520px] shrink-0 overflow-hidden">
            <EntityInspector
              definition={definition}
              record={selectedRecord}
              onClose={() => {
                setInspectorOpen(false);
              }}
            />
          </section>
        ) : (
          <button
            type="button"
            onClick={() => {
              setInspectorOpen(true);
            }}
            className="absolute right-4 top-4 z-20 rounded-lg border border-slate-200 bg-white p-2 text-slate-500 shadow-sm hover:text-blue-600"
            title="Открыть карточку"
          >
            <PanelRightOpen size={19} />
          </button>
        )}

        {inspectorOpen ? (
          <button
            type="button"
            onClick={() => {
              setInspectorOpen(false);
            }}
            className="absolute right-[528px] top-3 z-20 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 shadow-sm hover:text-slate-700"
            title="Скрыть карточку"
          >
            <PanelRightClose size={17} />
          </button>
        ) : null}
      </div>
    </div>
  );
}