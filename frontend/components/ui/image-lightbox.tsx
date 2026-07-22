"use client";

type ImageLightboxProps = {
  src: string;
  alt: string;
  onClose: () => void;
};

/** Simple full-screen image preview (nomenclature card pattern). */
export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  return (
    <div
      className="fixed inset-0 z-portal-modal-1 flex items-center justify-center bg-slate-950/80 p-portal-4"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw] rounded-portal-lg bg-portal-surface p-portal-2 shadow-portal-overlay"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть изображение"
          className="absolute right-2 top-2 z-10 rounded-portal-full bg-slate-950/75 px-portal-3 py-1 text-lg font-bold text-white"
        >
          ×
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="max-h-[86vh] max-w-[86vw] object-contain"
        />
      </div>
    </div>
  );
}
