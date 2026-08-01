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
  TECH_CARD_IMAGE_ACCEPT,
  TECH_CARD_MEDIA_MAX,
} from "@/lib/production/tech-cards";
import {
  technicalCardMediaContentUrl,
  type ApiTechnicalCardMedia,
} from "@/lib/sales/order-tech-cards-api";

const PHOTO_WIDTH_PX = 300;
const PHOTO_WIDTH_SHOP_PX = 520;

const overlayIconClass =
  "border-0 bg-white/95 text-portal-text shadow-portal-sm hover:bg-white";

type TechCardMediaCarouselProps = {
  items: ApiTechnicalCardMedia[];
  busy?: boolean;
  /** Shop floors (except Design): view-only mockup. */
  readOnly?: boolean;
  /** Larger preview for цех workspaces. */
  size?: "default" | "shop";
  onExpand: (src: string) => void;
  onSetPrimary: (item: ApiTechnicalCardMedia) => void;
  onDelete: (item: ApiTechnicalCardMedia) => void;
  onReplace: (item: ApiTechnicalCardMedia, file: File) => void;
  onAdd: (files: File[]) => void;
};

export function TechCardMediaCarousel({
  items,
  busy = false,
  readOnly = false,
  size = "default",
  onExpand,
  onSetPrimary,
  onDelete,
  onReplace,
  onAdd,
}: TechCardMediaCarouselProps) {
  const isShopSize = size === "shop";
  const photoWidth = isShopSize ? PHOTO_WIDTH_SHOP_PX : PHOTO_WIDTH_PX;
  const frameMaxClass = isShopSize ? "max-w-[520px]" : "max-w-[300px]";
  const emptyHeightClass = isShopSize ? "h-56" : "h-36";
  const [index, setIndex] = useState(0);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const safeIndex =
    items.length === 0 ? 0 : Math.min(index, items.length - 1);
  const canAdd = items.length < TECH_CARD_MEDIA_MAX;

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
      disabled={busy || !canAdd}
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
        accept={TECH_CARD_IMAGE_ACCEPT}
        multiple
        className="hidden"
        disabled={busy || !canAdd}
        onChange={onAddPick}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept={TECH_CARD_IMAGE_ACCEPT}
        className="hidden"
        disabled={busy}
        onChange={onReplacePick}
      />
    </>
  );

  if (items.length === 0) {
    return (
      <div className="flex w-full min-w-0 flex-col items-center gap-portal-2">
        <div
          className={[
            "group relative flex w-full items-center justify-center overflow-hidden rounded-portal-md border border-dashed border-portal-border bg-portal-surface-secondary",
            emptyHeightClass,
            frameMaxClass,
          ].join(" ")}
        >
          <p className="text-portal-caption text-portal-muted">Нет изображений</p>
          {readOnly ? null : (
            <div
              className={[
                "absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/40 to-transparent px-2 pb-2 pt-8",
                "opacity-0 transition-opacity duration-150",
                "group-hover:opacity-100 group-focus-within:opacity-100",
              ].join(" ")}
            >
              {addButton}
            </div>
          )}
          {readOnly ? null : hiddenInputs}
        </div>
      </div>
    );
  }

  const item = items[safeIndex] ?? items[0];
  const src = technicalCardMediaContentUrl(item.content_url);
  if (!src) {
    return null;
  }

  const canNavigate = items.length > 1;

  const goPrev = () => {
    setIndex((current) => (current - 1 + items.length) % items.length);
  };

  const goNext = () => {
    setIndex((current) => (current + 1) % items.length);
  };

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-portal-2">
      <div
        className={[
          "group relative w-full overflow-hidden rounded-portal-md border border-portal-border bg-portal-surface-secondary",
          frameMaxClass,
        ].join(" ")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={item.filename}
          width={photoWidth}
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
          {readOnly ? null : (
            <>
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
            </>
          )}
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

        {readOnly ? null : hiddenInputs}

        {canNavigate ? (
          <>
            <button
              type="button"
              aria-label="Предыдущее фото"
              disabled={busy}
              onClick={goPrev}
              className="absolute left-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-portal-text opacity-0 shadow-portal-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 disabled:pointer-events-none"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Следующее фото"
              disabled={busy}
              onClick={goNext}
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
          aria-label="Фото макета"
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
