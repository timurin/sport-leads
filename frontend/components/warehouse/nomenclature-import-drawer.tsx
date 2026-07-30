"use client";

import { Download, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  downloadNomenclatureImportTemplate,
  importNomenclaturesFile,
} from "@/app/(workspace)/settings/catalogs/nomenclature/nomenclature-actions";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form-controls";
import { triggerBrowserDownload } from "@/lib/file-download";
import type { NomenclatureImportResult } from "@/lib/nomenclature-import";

type NomenclatureImportDrawerProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Catalog file import UX on `/warehouse/stock` (`4.5.1.3` + template via `4.5.2`).
 * Template columns match export. Dry-run first, then commit when `can_commit`.
 */
export function NomenclatureImportDrawer({
  open,
  onClose,
}: NomenclatureImportDrawerProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<NomenclatureImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [templatePending, startTemplateTransition] = useTransition();

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const downloadTemplate = (format: "csv" | "xlsx") => {
    setError(null);
    startTemplateTransition(async () => {
      try {
        const payload = await downloadNomenclatureImportTemplate(format);
        triggerBrowserDownload(payload);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Не удалось скачать шаблон импорта",
        );
      }
    });
  };

  const run = (dryRun: boolean) => {
    if (!file) {
      setError("Выберите файл CSV или XLSX");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("dry_run", dryRun ? "true" : "false");
    startTransition(async () => {
      try {
        const next = await importNomenclaturesFile(formData);
        setResult(next);
        if (
          !dryRun &&
          (next.created_count > 0 || next.updated_count > 0)
        ) {
          router.refresh();
        }
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Не удалось выполнить импорт номенклатуры",
        );
      }
    });
  };

  return (
    <CreateDrawer
      open={open}
      title="Импорт номенклатуры"
      description="Скачайте шаблон (те же колонки, что у экспорта), заполните и загрузите."
      onClose={handleClose}
      variant="overlay"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 space-y-portal-4 overflow-y-auto px-portal-6 py-portal-5">
          <div className="space-y-portal-2 rounded-portal-md border border-portal-border bg-portal-surface-secondary p-portal-3">
            <p className="text-portal-body font-medium text-portal-text">
              Шаблон для заполнения
            </p>
            <p className="text-portal-caption text-portal-muted">
              Колонки совпадают с экспортом: карточка (name, short_name,
              description, category, category_code, nomenclature_type,
              product_type_name, unit, storage_unit_code, base_price, currency,
              is_active), модели (product_model_articles через «|»), фото
              (photo_paths — локальные пути через «|»), характеристики
              (колонки char:код). category_path / photo_urls / даты — только
              для чтения. В шаблоне — две примерные строки.
            </p>
            <div className="flex flex-wrap gap-portal-2">
              <Button
                type="button"
                size="compact"
                variant="secondary"
                disabled={templatePending}
                onClick={() => downloadTemplate("csv")}
              >
                <Download className="size-4" aria-hidden="true" />
                Шаблон CSV
              </Button>
              <Button
                type="button"
                size="compact"
                variant="secondary"
                disabled={templatePending}
                onClick={() => downloadTemplate("xlsx")}
              >
                <Download className="size-4" aria-hidden="true" />
                Шаблон XLSX
              </Button>
            </div>
          </div>

          <Field label="Файл" required>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="block w-full text-portal-body text-portal-text file:mr-portal-3 file:rounded-portal-md file:border file:border-portal-border file:bg-portal-surface file:px-portal-3 file:py-portal-2 file:text-portal-caption"
              aria-label="Файл импорта номенклатуры"
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                setFile(next);
                setResult(null);
                setError(null);
              }}
            />
          </Field>
          {file ? (
            <p className="text-portal-caption text-portal-muted">
              Выбран: {file.name} ({Math.ceil(file.size / 1024)} КБ)
            </p>
          ) : null}

          {error ? (
            <p className="text-portal-caption text-portal-danger" role="alert">
              {error}
            </p>
          ) : null}

          {result ? (
            <div
              className="space-y-portal-2 rounded-portal-md border border-portal-border bg-portal-surface-secondary p-portal-3"
              aria-live="polite"
            >
              <p className="text-portal-body text-portal-text">
                Строк: {result.total_rows}, валидных: {result.valid_rows}, с
                ошибками: {result.error_rows}
              </p>
              {result.dry_run ? (
                <p className="text-portal-caption text-portal-muted">
                  {result.can_commit
                    ? `Проверка пройдена — будет создано: ${result.created_count}, изменено: ${result.updated_count}.`
                    : "Есть ошибки — исправьте файл и проверьте снова."}
                </p>
              ) : (
                <div className="space-y-1 text-portal-caption text-portal-text">
                  <p>Создано позиций: {result.created_count}</p>
                  <p>Изменено позиций: {result.updated_count}</p>
                </div>
              )}
              {result.errors.length > 0 ? (
                <ul className="max-h-48 space-y-1 overflow-y-auto text-portal-caption text-portal-danger">
                  {result.errors.slice(0, 40).map((row, index) => (
                    <li key={`${row.row_number}-${row.code}-${index}`}>
                      {row.row_number === 0
                        ? "Файл"
                        : `Строка ${row.row_number}`}
                      {row.column ? ` · ${row.column}` : ""}: {row.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              {result.preview.length > 0 && result.dry_run ? (
                <div className="space-y-1">
                  <p className="text-portal-caption font-medium text-portal-text">
                    Превью (до {result.preview.length})
                  </p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-portal-caption text-portal-muted">
                    {result.preview.map((row, index) => (
                      <li key={index}>
                        {String(row._action ?? "—")} · {String(row.name ?? "—")}
                        {row.category ? ` · ${String(row.category)}` : ""}
                        {row.nomenclature_type
                          ? ` · ${String(row.nomenclature_type)}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-portal-2 border-t border-portal-border px-portal-6 py-portal-4">
          <Button
            type="button"
            variant="secondary"
            size="compact"
            disabled={pending || templatePending}
            onClick={handleClose}
          >
            Закрыть
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="compact"
            disabled={pending || !file}
            onClick={() => run(true)}
          >
            <Upload className="size-4" aria-hidden="true" />
            {pending ? "Проверка…" : "Проверить"}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="compact"
            disabled={
              pending || !file || !result?.can_commit || result?.dry_run === false
            }
            onClick={() => run(false)}
          >
            {pending && result?.can_commit ? "Загрузка…" : "Загрузить"}
          </Button>
        </footer>
      </div>
    </CreateDrawer>
  );
}
