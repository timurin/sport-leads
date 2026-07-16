export type EntityId = string | number;

export type EntityStatus = {
  id: string;
  title: string;
  colorClass: string;
};

export type EntityField = {
  id: string;
  label: string;
  value: string | number | null;
  type?:
    | "text"
    | "number"
    | "date"
    | "money"
    | "phone"
    | "email"
    | "status";
};

export type EntityRecord = {
  id: EntityId;
  title: string;
  subtitle?: string;
  status?: EntityStatus;
  responsible?: string;
  createdAt?: string;
  updatedAt?: string;
  fields?: EntityField[];
};

export type EntityColumn = {
  id: string;
  title: string;
  field: string;
  width?: number;
  sortable?: boolean;
};

export type EntityAction = {
  id: string;
  title: string;
  variant?: "default" | "danger";
};