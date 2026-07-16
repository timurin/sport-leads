import type {
  EntityAction,
  EntityColumn,
  EntityField,
  EntityId,
  EntityRecord,
} from "@/types/entity/entity";

export type EntityViewType =
  | "table"
  | "kanban";

export type EntityInspectorTab = {
  id: string;
  title: string;
};

export type EntityDefinition = {
  id: string;
  title: string;
  titlePlural: string;
  description?: string;

  defaultView: EntityViewType;
  availableViews: EntityViewType[];

  columns: EntityColumn[];
  fields: EntityField[];

  inspectorTabs: EntityInspectorTab[];
  actions?: EntityAction[];
};

export type EntityWorkspaceData = {
  definition: EntityDefinition;
  records: EntityRecord[];
  selectedId?: EntityId | null;
};