"use client";

import {
  PanelRightOpen,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

import { EntityInspector } from "@/components/entity/entity-inspector";
import { EntityTable } from "@/components/entity/entity-table";
import { EntityToolbar } from "@/components/entity/entity-toolbar";
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

type InspectorMode =
  | "view"
  | "edit"
  | "create";

export function EntityWorkspace({
  definition,
  records: initialRecords,
}: EntityWorkspaceProps) {
  const [records, setRecords] =
    useState<EntityRecord[]>(
      initialRecords,
    );

  const [selectedId, setSelectedId] =
    useState<EntityId | null>(
      initialRecords[0]?.id ?? null,
    );

  const [inspectorOpen, setInspectorOpen] =
    useState(true);

  const [inspectorMode, setInspectorMode] =
    useState<InspectorMode>("view");

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
    setInspectorMode("view");
    setInspectorOpen(true);
  }

  function handleCreate() {
    setSelectedId(null);
    setInspectorMode("create");
    setInspectorOpen(true);
  }

  function handleEdit() {
    if (!selectedRecord) {
      return;
    }

    setInspectorMode("edit");
    setInspectorOpen(true);
  }

  function handleSave(
    savedRecord: EntityRecord,
  ) {
    setRecords((currentRecords) => {
      const existingIndex =
        currentRecords.findIndex(
          (record) =>
            record.id === savedRecord.id,
        );

      if (existingIndex === -1) {
        return [
          savedRecord,
          ...currentRecords,
        ];
      }

      return currentRecords.map(
        (record) =>
          record.id === savedRecord.id
            ? savedRecord
            : record,
      );
    });

    setSelectedId(savedRecord.id);
    setInspectorMode("view");
    setInspectorOpen(true);
  }

  function handleCloseInspector() {
    setInspectorOpen(false);
    setInspectorMode("view");
  }

  function handleCancelEdit() {
    if (selectedRecord) {
      setInspectorMode("view");
      return;
    }

    setInspectorOpen(false);
    setInspectorMode("view");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <EntityToolbar
        searchPlaceholder={`Поиск: ${definition.titlePlural.toLowerCase()}`}
        createLabel={`Создать ${definition.title.toLowerCase()}`}
        view={definition.defaultView}
        onCreate={handleCreate}
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
              mode={inspectorMode}
              onEdit={handleEdit}
              onSave={handleSave}
              onCancelEdit={
                handleCancelEdit
              }
              onClose={
                handleCloseInspector
              }
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
      </div>
    </div>
  );
}