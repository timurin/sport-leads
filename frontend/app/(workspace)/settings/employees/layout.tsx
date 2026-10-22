import { EmployeeNavProvider } from "@/components/settings/employee-nav-context";

export default function EmployeesLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal?: React.ReactNode;
}) {
  return (
    <EmployeeNavProvider>
      {children}
      {modal}
    </EmployeeNavProvider>
  );
}
