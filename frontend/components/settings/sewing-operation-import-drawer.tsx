"use client";

import { Download, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  downloadSewingOperationImportTemplate,
  importSewingOperationsFile,
} from "@/app/(workspace)/settings/catalogs/sewing_operations/sewing-operation-actions";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form-controls";
import { triggerBrowserDownload } from "@/lib/file-download";
import type { SewingOperationImportResult } from "@/lib/sewing-operation-import";

type SewingOperationImportDrawerProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Catalog file import UX on `/settings/catalogs/sewing_operations` (`4.5.4`).
 */
export function SewingOperationImportDrawer({
  open,
  onClose,
}: SewingOperationImportDrawerProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<SewingOperationImportResult | null>(null);
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
        const payload = await downloadSewingOperationImportTemplate(format);
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
        const next = await importSewingOperationsFile(formData);
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
            : "Не удалось выполнить импорт операций",
        );
      }
    });
  };

  return (
    <CreateDrawer
      open={open}
      title="Импорт операций пошива"
      description="Скачайте шаблон или загрузите CSV/XLSX экспорта. Сначала «Проверить», затем «Импортировать»."
      onClose={handleClose}
      variant="overlay"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 space-y-portal-4 overflow-y-auto px-portal-6 py-portal-5">
          <div className="space-y-portal-2 rounded-portal-md border border-portal-border bg-portal-surface-secondary p-portal-3">
            <p className="text-portal-body font-medium text-portal-text">
              Формат CSV / XLSX
            </p>
            <ul className="list-disc space-y-1 pl-portal-4 text-portal-caption text-portal-muted">
              <li>
                Файлы: <strong className="font-medium text-portal-text">.csv</strong> или{" "}
                <strong className="font-medium text-portal-text">.xlsx</strong> (UTF-8; BOM
                допустим).
              </li>
              <li>
                Разделитель колонок CSV:{" "}
                <strong className="font-medium text-portal-text">;</strong> (Excel RU) или{" "}
                <strong className="font-medium text-portal-text">,</strong> — определяется
                по строке заголовка.
              </li>
              <li>
                Обязательная колонка: <code className="text-portal-text">name</code>. При
                создании нужен <code className="text-portal-text">cost</code>.
              </li>
              <li>
                Папка: <code className="text-portal-text">folder_path</code> с разделителем{" "}
                <code className="text-portal-text"> / </code>. Пустое значение — корень
                каталога. Недостающие папки создаются при импорте.
              </li>
              <li>
                Оборудование: <code className="text-portal-text">work_center_codes</code>,
                коды через{" "}
                <strong className="font-medium text-portal-text">|</strong>. Только цех
                Пошив.
              </li>
              <li>
                Upsert по <code className="text-portal-text">id</code> или уникальному{" "}
                <code className="text-portal-text">name</code>. Даты — только экспорт.
              </li>
            </ul>
          </div>

          <div className="space-y-portal-2 rounded-portal-md border border-portal-border bg-portal-surface-secondary p-portal-3">
            <p className="text-portal-body font-medium text-portal-text">
              Шаблон для заполнения
            </p>
            <p className="text-portal-caption text-portal-muted">
              Колонки: id, name, cost, quantity_per_item, duration_seconds, folder_path,
              sort_order, work_center_codes (+ даты для round-trip).
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
              aria-label="Файл импорта операций пошива"
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
            <div className="space-y-portal-2 rounded-portal-md border border-portal-border p-portal-3">
              <p className="text-portal-body text-portal-text">
                {result.dry_run ? "Проверка" : "Импорт"}: строк{" "}
                {result.total_rows}, валидных {result.valid_rows}, ошибок{" "}
                {result.error_rows}
                {result.dry_run
                  ? `, план: создать ${result.created_count}, обновить ${result.updated_count}`
                  : `, создано ${result.created_count}, обновлено ${result.updated_count}`}
              </p>
              {result.errors.length > 0 ? (
                <ul className="max-h-40 space-y-1 overflow-y-auto text-portal-caption text-portal-danger">
                  {result.errors.slice(0, 30).map((err, index) => (
                    <li key={`${err.row_number}-${err.code}-${index}`}>
                      Строка {err.row_number}
                      {err.column ? ` · ${err.column}` : ""}: {err.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              {result.can_commit ? (
                <p className="text-portal-caption text-portal-muted">
                  Можно выполнить импорт.
                </p>
              ) : (
                <p className="text-portal-caption text-portal-danger">
                  Исправьте ошибки перед импортом.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-portal-2 border-t border-portal-border px-portal-6 py-portal-4">
          <Button
            type="button"
            size="compact"
            variant="secondary"
            disabled={pending || !file}
            onClick={() => run(true)}
          >
            Проверить
          </Button>
          <Button
            type="button"
            size="compact"
            variant="primary"
            disabled={
              pending || !file || !result?.can_commit || result.dry_run === false
            }
            onClick={() => run(false)}
          >
            <Upload className="size-4" aria-hidden="true" />
            Импортировать
          </Button>
          <Button
            type="button"
            size="compact"
            variant="ghost"
            disabled={pending}
            onClick={handleClose}
          >
            Закрыть
          </Button>
        </div>
      </div>
    </CreateDrawer>
  );
}
