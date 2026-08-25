export type ApiOrganization = {
  id: number;
  name: string;
  legal_form: string | null;
  tax_id: string | null;
  ogrn: string | null;
  kpp: string | null;
  tax_system: string | null;
  director: string | null;
  legal_address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OrganizationView = {
  id: number;
  name: string;
  legalForm: string;
  taxId: string;
  ogrn: string;
  kpp: string;
  taxSystem: string;
  director: string;
  legalAddress: string;
  isActive: boolean;
};

export type OrganizationDraft = {
  name: string;
  legalForm: string;
  taxId: string;
  ogrn: string;
  kpp: string;
  taxSystem: string;
  director: string;
  legalAddress: string;
  isActive: boolean;
};

export function fromApiOrganization(row: ApiOrganization): OrganizationView {
  return {
    id: row.id,
    name: row.name,
    legalForm: row.legal_form ?? "",
    taxId: row.tax_id ?? "",
    ogrn: row.ogrn ?? "",
    kpp: row.kpp ?? "",
    taxSystem: row.tax_system ?? "",
    director: row.director ?? "",
    legalAddress: row.legal_address ?? "",
    isActive: row.is_active,
  };
}

export function toOrganizationDraft(view: OrganizationView): OrganizationDraft {
  return {
    name: view.name,
    legalForm: view.legalForm,
    taxId: view.taxId,
    ogrn: view.ogrn,
    kpp: view.kpp,
    taxSystem: view.taxSystem,
    director: view.director,
    legalAddress: view.legalAddress,
    isActive: view.isActive,
  };
}

export function emptyOrganizationDraft(): OrganizationDraft {
  return {
    name: "",
    legalForm: "",
    taxId: "",
    ogrn: "",
    kpp: "",
    taxSystem: "",
    director: "",
    legalAddress: "",
    isActive: true,
  };
}

export function organizationMatchesQuery(
  org: OrganizationView,
  query: string,
): boolean {
  const q = query.trim().toLocaleLowerCase("ru");
  if (!q) return true;
  const haystack = [
    org.name,
    org.legalForm,
    org.taxId,
    org.director,
    org.kpp,
    org.ogrn,
  ]
    .join(" ")
    .toLocaleLowerCase("ru");
  return haystack.includes(q);
}
