/**
 * Product-model catalog import DTOs (mirrors backend `ProductModelImportResult`).
 * Roadmap `4.5.3` / ADR-020 contour A.
 */

export type ProductModelImportRowError = {
  row_number: number;
  column: string | null;
  code: string;
  message: string;
};

export type ProductModelImportResult = {
  dry_run: boolean;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  errors: ProductModelImportRowError[];
  preview: Array<Record<string, unknown>>;
  can_commit: boolean;
  created_count: number;
  updated_count: number;
  created_ids: number[];
  updated_ids: number[];
};
