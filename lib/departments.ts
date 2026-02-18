export type Department = "Primary" | "Secondary" | "Admin";
export type DepartmentKey = "primary" | "secondary" | "admin";

function canonicalDepartmentToken(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/[^a-z]/g, "");
}

export function normalizeDepartment(value: unknown): Department | null {
  const token = canonicalDepartmentToken(value);
  if (!token) return null;

  if (token === "primary") return "Primary";
  if (token === "secondary") return "Secondary";
  if (
    token === "admin" ||
    token === "opsadmin" ||
    token === "operationsadmin" ||
    token === "ops" ||
    token === "operations"
  ) {
    return "Admin";
  }

  return null;
}

export function toDepartmentKey(value: unknown): DepartmentKey | null {
  const department = normalizeDepartment(value);
  if (department === "Primary") return "primary";
  if (department === "Secondary") return "secondary";
  if (department === "Admin") return "admin";
  return null;
}

export function fromDepartmentKey(value: DepartmentKey): Department {
  if (value === "primary") return "Primary";
  if (value === "secondary") return "Secondary";
  return "Admin";
}
