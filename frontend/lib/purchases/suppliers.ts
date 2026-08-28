export type ApiSupplierListItem = {
  id: number;
  name: string;
  code: string | null;
  inn: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ApiSupplierPrice = {
  id: number;
  supplier_id: number;
  nomenclature_id: number;
  nomenclature_name: string;
  unit_price: string;
  currency: string;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiSupplierDetail = {
  id: number;
  name: string;
  code: string | null;
  inn: string | null;
  kpp: string | null;
  phone: string | null;
  email: string | null;
  legal_address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  prices: ApiSupplierPrice[];
};

export type SupplierListView = {
  id: number;
  name: string;
  code: string;
  inn: string;
  phone: string;
  email: string;
  isActive: boolean;
};

export type SupplierPriceView = {
  id: number;
  nomenclatureId: number;
  nomenclatureName: string;
  unitPrice: string;
  currency: string;
  comment: string;
};

export type SupplierDetailView = {
  id: number;
  name: string;
  code: string;
  inn: string;
  kpp: string;
  phone: string;
  email: string;
  legalAddress: string;
  notes: string;
  isActive: boolean;
  prices: SupplierPriceView[];
};

export type SupplierDraft = {
  name: string;
  code: string;
  inn: string;
  kpp: string;
  phone: string;
  email: string;
  legalAddress: string;
  notes: string;
  isActive: boolean;
};

export function fromApiSupplierListItem(row: ApiSupplierListItem): SupplierListView {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? "",
    inn: row.inn ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    isActive: row.is_active,
  };
}

export function fromApiSupplierDetail(row: ApiSupplierDetail): SupplierDetailView {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? "",
    inn: row.inn ?? "",
    kpp: row.kpp ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    legalAddress: row.legal_address ?? "",
    notes: row.notes ?? "",
    isActive: row.is_active,
    prices: row.prices.map((price) => ({
      id: price.id,
      nomenclatureId: price.nomenclature_id,
      nomenclatureName: price.nomenclature_name,
      unitPrice: String(price.unit_price),
      currency: price.currency,
      comment: price.comment ?? "",
    })),
  };
}

export function toSupplierDraft(view: SupplierDetailView): SupplierDraft {
  return {
    name: view.name,
    code: view.code,
    inn: view.inn,
    kpp: view.kpp,
    phone: view.phone,
    email: view.email,
    legalAddress: view.legalAddress,
    notes: view.notes,
    isActive: view.isActive,
  };
}

export function emptySupplierDraft(): SupplierDraft {
  return {
    name: "",
    code: "",
    inn: "",
    kpp: "",
    phone: "",
    email: "",
    legalAddress: "",
    notes: "",
    isActive: true,
  };
}

export function supplierMatchesQuery(
  supplier: SupplierListView,
  query: string,
): boolean {
  const q = query.trim().toLocaleLowerCase("ru");
  if (!q) return true;
  const haystack = [supplier.name, supplier.code, supplier.inn, supplier.phone]
    .join(" ")
    .toLocaleLowerCase("ru");
  return haystack.includes(q);
}
