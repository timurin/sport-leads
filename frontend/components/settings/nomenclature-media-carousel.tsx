"use client";

import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Maximize2,
  Replace,
  Star,
  Trash2,
} from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";

import { IconButton } from "@/components/ui/button";
import {
  NOMENCLATURE_IMAGE_ACCEPT,
  nomenclatureMediaUrl,
  type NomenclatureMedia,
} from "@/lib/nomenclature";

const PHOTO_WIDTH_PX = 300;

const overlayIconClass =
  "border-0 bg-white/95 text-portal-text shadow-portal-sm hover:bg-white";

type NomenclatureMediaCarouselProps = {
  items: NomenclatureMedia[];
  busy?: boolean;
  onExpand: (src: string) => void;
  onSetPrimary: (item: NomenclatureMedia) => void;
  onDelete: (item: NomenclatureMedia) => void;
  onReplace: (item: NomenclatureMedia, file: File) => void;
  onAdd: (files: File[]) => void;
};

/** PT-08 media slot carousel for nomenclature (mirrors product-models). */
export function NomenclatureMediaCarousel({
  items,
  busy = false,
  onExpand,
  onSetPrimary,
  onDelete,
  onReplace,
  onAdd,
}: NomenclatureMediaCarouselProps) {
  const [index, setIndex] = useState(0);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const safeIndex =
    items.length === 0 ? 0 : Math.min(index, items.length - 1);

  const onAddPick = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    onAdd(files);
  };

  const onReplacePick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || items.length === 0) return;
    const item = items[safeIndex] ?? items[0];
    onReplace(item, file);
  };

  const addButton = (
    <IconButton
      label="Добавить фото"
      variant="secondary"
      disabled={busy}
      onClick={() => addInputRef.current?.click()}
      className={overlayIconClass}
    >
      <ImagePlus className="size-4" />
    </IconButton>
  );

  const hiddenInputs = (
    <>
      <input
        ref={addInputRef}
        type="file"
        accept={NOMENCLATURE_IMAGE_ACCEPT}
        multiple
        className="hidden"
        disabled={busy}
        onChange={onAddPick}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept={NOMENCLATURE_IMAGE_ACCEPT}
        className="hidden"
        disabled={busy}
        onChange={onReplacePick}
      />
    </>
  );

  if (items.length === 0) {
    return (
      <div className="flex w-full min-w-0 flex-col items-center gap-portal-2">
        <div className="group relative flex h-36 w-full max-w-[300px] items-center justify-center overflow-hidden rounded-portal-md border border-dashed border-portal-border bg-portal-surface-secondary">
          <p className="text-portal-caption text-portal-muted">Нет изображений</p>
          <div
            className={[
              "absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/40 to-transparent px-2 pb-2 pt-8",
              "opacity-0 transition-opacity duration-150",
              "group-hover:opacity-100 group-focus-within:opacity-100",
            ].join(" ")}
          >
            {addButton}
          </div>
          {hiddenInputs}
        </div>
      </div>
    );
  }

  const item = items[safeIndex] ?? items[0];
  const src = nomenclatureMediaUrl(item.content_url);
  const canNavigate = items.length > 1;

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-portal-2">
      <div className="group relative w-full max-w-[300px] overflow-hidden rounded-portal-md border border-portal-border bg-portal-surface-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={item.alt_text ?? item.filename}
          width={PHOTO_WIDTH_PX}
          className="h-auto w-full object-contain"
        />

        {item.is_primary ? (
          <span className="pointer-events-none absolute left-2 top-2 rounded-portal-sm bg-portal-primary px-1.5 py-0.5 text-[10px] font-semibold text-white opacity-90">
            Основное
          </span>
        ) : null}

        <div
          className={[
            "absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/55 to-transparent px-2 pb-2 pt-8",
            "opacity-0 transition-opacity duration-150",
            "group-hover:opacity-100 group-focus-within:opacity-100",
          ].join(" ")}
        >
          <IconButton
            label={item.is_primary ? "Уже основное" : "Основное"}
            variant="secondary"
            disabled={busy || item.is_primary}
            onClick={() => onSetPrimary(item)}
            className={overlayIconClass}
          >
            <Star className="size-4" fill={item.is_primary ? "currentColor" : "none"} />
          </IconButton>
          <IconButton
            label="Удалить"
            variant="secondary"
            disabled={busy}
            onClick={() => onDelete(item)}
            className="border-0 bg-white/95 text-portal-danger shadow-portal-sm hover:bg-white"
          >
            <Trash2 className="size-4" />
          </IconButton>
          <IconButton
            label="Заменить"
            variant="secondary"
            disabled={busy}
            onClick={() => replaceInputRef.current?.click()}
            className={overlayIconClass}
          >
            <Replace className="size-4" />
          </IconButton>
          {addButton}
          <IconButton
            label="Распахнуть"
            variant="secondary"
            disabled={busy}
            onClick={() => onExpand(src)}
            className={overlayIconClass}
          >
            <Maximize2 className="size-4" />
          </IconButton>
        </div>

        {hiddenInputs}

        {canNavigate ? (
          <>
            <button
              type="button"
              aria-label="Предыдущее фото"
              disabled={busy}
              onClick={() =>
                setIndex((current) => (current - 1 + items.length) % items.length)
              }
              className="absolute left-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-portal-text opacity-0 shadow-portal-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 disabled:pointer-events-none"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Следующее фото"
              disabled={busy}
              onClick={() => setIndex((current) => (current + 1) % items.length)}
              className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-portal-text opacity-0 shadow-portal-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 disabled:pointer-events-none"
            >
              <ChevronRight className="size-4" />
            </button>
          </>
        ) : null}
      </div>

      {canNavigate ? (
        <div
          className="flex w-full max-w-[300px] items-center justify-center gap-1.5"
          role="tablist"
          aria-label="Фото номенклатуры"
        >
          {items.map((row, rowIndex) => {
            const active = rowIndex === safeIndex;
            return (
              <button
                key={row.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`Фото ${rowIndex + 1}`}
                disabled={busy}
                onClick={() => setIndex(rowIndex)}
                className={[
                  "size-2 rounded-full transition",
                  active ? "bg-portal-primary" : "bg-portal-border hover:bg-portal-muted",
                ].join(" ")}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
