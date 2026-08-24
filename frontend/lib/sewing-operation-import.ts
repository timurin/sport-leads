/**
 * Sewing-operation catalog import DTOs (mirrors backend `SewingOperationImportResult`).
 * Roadmap `4.5.4` / ADR-020 contour A.
 */

export type SewingOperationImportRowError = {
  row_number: number;
  column: string | null;
  code: string;
  message: string;
};

export type SewingOperationImportResult = {
  dry_run: boolean;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  errors: SewingOperationImportRowError[];
  preview: Array<Record<string, unknown>>;
  can_commit: boolean;
  created_count: number;
  updated_count: number;
  created_ids: number[];
  updated_ids: number[];
};
