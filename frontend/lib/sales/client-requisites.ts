export type ApiClientBankAccount = {
  id: number;
  client_id: number;
  bank_name: string;
  bik: string;
  account_number: string;
  corr_account: string | null;
  is_primary: boolean;
  sort_order: number;
};

export type ClientBankAccountView = {
  id: number;
  bankName: string;
  bik: string;
  accountNumber: string;
  corrAccount: string | null;
  isPrimary: boolean;
};

export type ClientRequisitesView = {
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  legalAddress: string | null;
  actualAddress: string | null;
  bankAccounts: ClientBankAccountView[];
};

export type ClientRequisitesDraft = {
  inn: string;
  kpp: string;
  ogrn: string;
  legalAddress: string;
  actualAddress: string;
};

export type ClientBankAccountDraft = {
  bankName: string;
  bik: string;
  accountNumber: string;
  corrAccount: string;
  isPrimary: boolean;
};

export function fromApiClientBankAccount(
  row: ApiClientBankAccount,
): ClientBankAccountView {
  return {
    id: row.id,
    bankName: row.bank_name,
    bik: row.bik,
    accountNumber: row.account_number,
    corrAccount: row.corr_account,
    isPrimary: row.is_primary,
  };
}

export function emptyRequisites(): ClientRequisitesView {
  return {
    inn: null,
    kpp: null,
    ogrn: null,
    legalAddress: null,
    actualAddress: null,
    bankAccounts: [],
  };
}

export function requisitesToDraft(view: ClientRequisitesView): ClientRequisitesDraft {
  return {
    inn: view.inn ?? "",
    kpp: view.kpp ?? "",
    ogrn: view.ogrn ?? "",
    legalAddress: view.legalAddress ?? "",
    actualAddress: view.actualAddress ?? "",
  };
}

export function emptyBankDraft(): ClientBankAccountDraft {
  return {
    bankName: "",
    bik: "",
    accountNumber: "",
    corrAccount: "",
    isPrimary: false,
  };
}

export function validateInn(value: string): string | null {
  const digits = value.trim();
  if (!digits) return null;
  if (!/^(\d{10}|\d{12})$/.test(digits)) return "ИНН: 10 или 12 цифр";
  return null;
}

export function validateKpp(value: string): string | null {
  const digits = value.trim();
  if (!digits) return null;
  if (!/^\d{9}$/.test(digits)) return "КПП: 9 цифр";
  return null;
}

export function validateOgrn(value: string): string | null {
  const digits = value.trim();
  if (!digits) return null;
  if (!/^(\d{13}|\d{15})$/.test(digits)) return "ОГРН: 13 или 15 цифр";
  return null;
}

export function validateBankDraft(draft: ClientBankAccountDraft): string | null {
  if (!draft.bankName.trim()) return "Укажите банк";
  if (!/^\d{9}$/.test(draft.bik.trim())) return "БИК: 9 цифр";
  if (!/^\d{20}$/.test(draft.accountNumber.trim())) return "Расчётный счёт: 20 цифр";
  if (draft.corrAccount.trim() && !/^\d{20}$/.test(draft.corrAccount.trim())) {
    return "Корр. счёт: 20 цифр";
  }
  return null;
}
