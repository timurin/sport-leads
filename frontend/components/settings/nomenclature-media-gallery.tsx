"use client";

import Uppy from "@uppy/core";
import { useUppyState } from "@uppy/react";
import ThumbnailGenerator from "@uppy/thumbnail-generator";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { deleteNomenclatureMedia, updateNomenclatureMedia, uploadNomenclatureMedia } from "@/app/(workspace)/settings/catalogs/nomenclature/characteristics-actions";
import type { NomenclatureMedia } from "@/lib/nomenclature";
import { controlClassName } from "@/lib/design-system/control-styles";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function mediaUrl(contentUrl: string): string { return contentUrl.startsWith("blob:") ? contentUrl : `${(process.env.NEXT_PUBLIC_SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "")}${contentUrl}`; }

export function NomenclatureMediaGallery({ itemId, media, editing }: { itemId: number; media: NomenclatureMedia[]; editing: boolean }) {
  const [items, setItems] = useState(media);
  const [altText, setAltText] = useState("");
  const [primary, setPrimary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const uppy = useMemo(() => { const instance = new Uppy({ autoProceed: false, restrictions: { maxFileSize: MAX_FILE_SIZE, allowedFileTypes: ["image/jpeg", "image/png", "image/webp"] } }); instance.use(ThumbnailGenerator, { thumbnailWidth: 240 }); return instance; }, []);
  useEffect(() => () => { uppy.cancelAll(); }, [uppy]);
  const queued = useUppyState(uppy, (state) => Object.values(state.files));

  const chooseFiles = (event: FormEvent<HTMLInputElement>) => {
    const selected = Array.from(event.currentTarget.files ?? []);
    setError("");
    for (const file of selected) {
      if (!ACCEPTED_TYPES.includes(file.type)) { setError("Поддерживаются только JPG, PNG и WEBP"); continue; }
      if (file.size > MAX_FILE_SIZE) { setError("Размер изображения не должен превышать 10 МБ"); continue; }
      try { uppy.addFile({ name: file.name, type: file.type, data: file }); } catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось добавить файл"); }
    }
    event.currentTarget.value = "";
  };

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!queued.length) { setError("Добавьте хотя бы одно изображение"); return; }
    setBusy(true); setError("");
    try {
      const created: NomenclatureMedia[] = [];
      for (const [index, queuedFile] of queued.entries()) {
        if (!(queuedFile.data instanceof File)) continue;
        const data = new FormData(); data.append("nomenclature_id", String(itemId)); data.append("file", queuedFile.data); data.append("alt_text", index === 0 ? altText : ""); data.append("is_primary", String(primary && index === 0)); data.append("sort_order", String(items.length + index));
        created.push(await uploadNomenclatureMedia(data));
      }
      setItems((current) => [...current.map((item) => primary ? { ...item, is_primary: false } : item), ...created.map((image, index) => ({ ...image, content_url: image.content_url || queued[index]?.preview || "" }))]);
      uppy.cancelAll(); setAltText(""); setPrimary(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось загрузить изображения"); } finally { setBusy(false); }
  };

  const update = async (image: NomenclatureMedia, values: { altText: string; sortOrder: number; primary: boolean }) => {
    setBusy(true); setError("");
    try { const data = new FormData(); data.append("nomenclature_id", String(itemId)); data.append("media_id", String(image.id)); data.append("alt_text", values.altText); data.append("sort_order", String(values.sortOrder)); data.append("is_primary", String(values.primary)); await updateNomenclatureMedia(data); setItems((current) => current.map((item) => values.primary ? { ...item, is_primary: item.id === image.id } : item.id === image.id ? { ...item, alt_text: values.altText || null, sort_order: values.sortOrder } : item)); } catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось сохранить изображение"); } finally { setBusy(false); }
  };
  const remove = async (image: NomenclatureMedia) => { setBusy(true); setError(""); try { const data = new FormData(); data.append("nomenclature_id", String(itemId)); data.append("media_id", String(image.id)); await deleteNomenclatureMedia(data); setItems((current) => current.filter((item) => item.id !== image.id)); } catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось удалить изображение"); } finally { setBusy(false); } };
  const sorted = items.slice().sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

  return <section className="rounded-[14px] border border-[#dfe5ef] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,.05),0_4px_14px_rgba(16,24,40,.04)]"><div className="mb-3.5 flex items-center justify-between gap-3"><h2 className="text-[17px] font-semibold">Изображения и файлы</h2>{busy && <span className="text-xs text-[#667085]">Сохранение…</span>}</div>{editing && <form onSubmit={upload} className="mb-4 grid gap-2 rounded-lg border border-dashed border-[#cfd7e6] p-3 sm:grid-cols-[auto_1fr_auto]"><label className="flex cursor-pointer items-center justify-center rounded-lg border border-[#1f5eff] bg-[#1f5eff] px-3.5 py-2 text-sm font-bold text-white">Загрузить<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={chooseFiles}/></label><input value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="Alt-текст для первого изображения" className={controlClassName()}/><button disabled={!queued.length || busy} className="rounded-lg border border-[#dfe5ef] px-3.5 py-2 text-sm font-bold disabled:opacity-50">Загрузить</button>{queued.length > 0 && <div className="grid gap-2 sm:col-span-3"><div className="flex flex-wrap gap-2">{queued.map((file) => <div key={file.id} className="flex items-center gap-2 rounded border border-[#dfe5ef] px-2 py-1 text-xs">{file.preview && <img src={file.preview} alt="" className="h-8 w-8 rounded object-cover"/>}<span className="max-w-40 truncate">{file.name}</span><button type="button" onClick={() => uppy.removeFile(file.id)} aria-label={`Удалить ${file.name}`} className="text-red-700">×</button></div>)}</div><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={primary} onChange={(event) => setPrimary(event.target.checked)}/> Первое изображение — главное</label></div>}</form>}{error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}{sorted.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">{sorted.map((image) => <MediaTile key={image.id} item={image} editing={editing} busy={busy} onUpdate={update} onDelete={remove}/>) }{editing && <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#dfe5ef] bg-white text-sm font-bold text-[#475467]">＋<span>Добавить</span><input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={chooseFiles}/></label>}</div> : <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#dfe5ef] bg-white p-8 text-center text-sm text-[#667085]">{editing ? <><span className="mb-2 text-3xl">＋</span><span className="font-bold text-[#475467]">Добавить изображения</span><span>Перетащите файлы сюда или выберите их</span></> : "Изображения ещё не загружены."}<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={chooseFiles}/></label>}<p className="mt-3 text-xs text-[#667085]">JPG, PNG, WEBP · до 10 МБ.</p></section>;
}

function MediaTile({ item, editing, busy, onUpdate, onDelete }: { item: NomenclatureMedia; editing: boolean; busy: boolean; onUpdate: (item: NomenclatureMedia, values: { altText: string; sortOrder: number; primary: boolean }) => Promise<void>; onDelete: (item: NomenclatureMedia) => Promise<void> }) {
  const [altText, setAltText] = useState(item.alt_text ?? "");
  const [sortOrder, setSortOrder] = useState(item.sort_order);
  const save = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); await onUpdate(item, { altText, sortOrder, primary: item.is_primary }); };
  return <div className="overflow-hidden rounded-lg border border-[#dfe5ef] bg-white"><div className="relative aspect-square bg-[#eef2f7]"><img src={mediaUrl(item.content_url)} alt={item.alt_text ?? item.filename} className="h-full w-full object-cover"/><span className="absolute bottom-1 left-1 max-w-[90%] truncate rounded bg-[#1f5eff] px-1.5 py-0.5 text-[10px] font-bold text-white">{item.is_primary ? "Главное" : item.filename}</span></div>{editing && <form onSubmit={save} className="grid gap-1.5 p-2"><input value={altText} onChange={(event) => setAltText(event.target.value)} aria-label={`Alt-текст ${item.filename}`} placeholder="Alt-текст" className={controlClassName({ size: "compact", className: "text-portal-caption" })}/><div className="flex items-center gap-1"><input type="number" min="0" value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} aria-label={`Порядок ${item.filename}`} className={controlClassName({ size: "compact", className: "w-16 text-portal-caption" })}/><button disabled={busy} className="flex-1 rounded border border-[#dfe5ef] px-2 py-1 text-xs font-semibold">Сохранить</button></div><div className="flex gap-1"><button type="button" disabled={busy || item.is_primary} onClick={() => onUpdate(item, { altText, sortOrder, primary: true })} className="flex-1 rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 disabled:opacity-50">Сделать главным</button><button type="button" disabled={busy} onClick={() => onDelete(item)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-700">Удалить</button></div></form>}</div>;
}
