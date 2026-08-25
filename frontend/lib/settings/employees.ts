export type ApiEmployee = {
  id: number;
  full_name: string;
  organization_id: number;
  organization_name: string;
  position: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  employment_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type EmployeeView = {
  id: number;
  fullName: string;
  organizationId: number;
  organizationName: string;
  position: string;
  department: string;
  phone: string;
  email: string;
  employmentDate: string;
  isActive: boolean;
};

export type EmployeeDraft = {
  fullName: string;
  organizationId: number | "";
  position: string;
  department: string;
  phone: string;
  email: string;
  employmentDate: string;
  isActive: boolean;
};

export function fromApiEmployee(row: ApiEmployee): EmployeeView {
  return {
    id: row.id,
    fullName: row.full_name,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    position: row.position ?? "",
    department: row.department ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    employmentDate: row.employment_date ?? "",
    isActive: row.is_active,
  };
}

export function toEmployeeDraft(view: EmployeeView): EmployeeDraft {
  return {
    fullName: view.fullName,
    organizationId: view.organizationId,
    position: view.position,
    department: view.department,
    phone: view.phone,
    email: view.email,
    employmentDate: view.employmentDate,
    isActive: view.isActive,
  };
}

export function emptyEmployeeDraft(): EmployeeDraft {
  return {
    fullName: "",
    organizationId: "",
    position: "",
    department: "",
    phone: "",
    email: "",
    employmentDate: "",
    isActive: true,
  };
}

export function employeeMatchesQuery(employee: EmployeeView, query: string): boolean {
  const q = query.trim().toLocaleLowerCase("ru");
  if (!q) return true;
  const haystack = [
    employee.fullName,
    employee.position,
    employee.department,
    employee.organizationName,
    employee.phone,
    employee.email,
  ]
    .join(" ")
    .toLocaleLowerCase("ru");
  return haystack.includes(q);
}

export function validateEmployeeEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return null;
  if (!value.includes("@") || value.includes(" ")) {
    return "Укажите корректный email";
  }
  return null;
}
