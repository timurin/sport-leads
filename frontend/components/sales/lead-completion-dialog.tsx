"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import type { Lead } from "@/types/sales";

export type RejectionReasonOption = {
  id: string;
  name: string;
  category: string;
  requiresComment: boolean;
};

export type LeadOrderDraft = {
  title: string;
  description: string;
  productCategory: string;
  sport: string;
  quantity: number;
  amount: number;
  desiredDate: string;
};

type Props = {
  lead: Lead | null;
  reasons: RejectionReasonOption[];
  onClose: () => void;
  onConvert: (leadId: string, draft: LeadOrderDraft) => void;
  onReject: (leadId: string, reason: RejectionReasonOption, comment: string) => void;
};

type Mode = "details" | "choice" | "convert" | "reject";

const fieldClass = "mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400";
const textareaClass = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400";

export function LeadCompletionDialog({
  lead,
  reasons,
  onClose,
  onConvert,
  onReject,
}: Props) {
  const [mode, setMode] = useState<Mode>("details");
  const [reasonId, setReasonId] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const reason = useMemo(
    () => reasons.find((item) => item.id === reasonId),
    [reasonId, reasons],
  );

  useEffect(() => {
    if (!lead) {
      return;
    }

    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [lead, onClose]);

  if (!lead) {
    return null;
  }

  const completed = lead.status === "completed";

  function submitConversion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    onConvert(lead!.id, {
      title: String(data.get("title")),
      description: String(data.get("description")),
      productCategory: String(data.get("productCategory")),
      sport: String(data.get("sport")),
      quantity: Number(data.get("quantity")),
      amount: Number(data.get("amount")),
      desiredDate: String(data.get("desiredDate")),
    });
  }

  function submitRejection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!reason) {
      setError("Выберите причину отказа.");
      return;
    }

    if (reason.requiresComment && !comment.trim()) {
      setError("Для выбранной причины обязателен комментарий.");
      return;
    }

    onReject(lead!.id, reason, comment.trim());
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/40 p-4"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 text-slate-900 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
              Лид {lead.id}
            </p>
            <h2 id="lead-dialog-title" className="mt-1 text-xl font-semibold text-slate-950">
              {lead.clientName}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {lead.contact} · {lead.city} · {lead.sport}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {completed ? (
          <div
            className={`mt-6 rounded-xl border p-4 text-slate-900 ${
              lead.result === "converted"
                ? "border-emerald-200 bg-emerald-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <p className="font-semibold text-slate-950">
              {lead.result === "converted" ? "Успешно конвертирован" : "Завершён отказом"}
            </p>
            {lead.convertedOrderNumber ? (
              <p className="mt-2 text-sm text-slate-900">Создан заказ {lead.convertedOrderNumber}</p>
            ) : null}
            {lead.rejectionReason ? (
              <p className="mt-2 text-sm text-slate-900">Причина: {lead.rejectionReason}</p>
            ) : null}
            {lead.rejectionComment ? (
              <p className="mt-1 text-sm text-slate-600">Комментарий: {lead.rejectionComment}</p>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">
              {lead.completedAt} · {lead.completedBy?.name}
            </p>
            {lead.convertedOrderId ? (
              <Link
                href={`/sales/orders?order=${lead.convertedOrderId}`}
                className="mt-4 inline-flex h-10 items-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white"
              >
                Открыть заказ
              </Link>
            ) : null}
          </div>
        ) : mode === "convert" ? (
          <form className="mt-6 grid gap-4 text-slate-900 sm:grid-cols-2" onSubmit={submitConversion}>
            <label className="text-sm text-slate-900 sm:col-span-2">
              Название заказа
              <input
                name="title"
                required
                defaultValue={`Заказ для ${lead.clientName}`}
                className={fieldClass}
              />
            </label>
            <label className="text-sm text-slate-900 sm:col-span-2">
              Описание
              <textarea
                name="description"
                defaultValue={lead.needDescription ?? `Потребность клиента: ${lead.sport}`}
                rows={3}
                className={textareaClass}
              />
            </label>
            <label className="text-sm text-slate-900">
              Категория
              <input
                name="productCategory"
                defaultValue={lead.productCategory ?? "Спортивная форма"}
                className={fieldClass}
              />
            </label>
            <label className="text-sm text-slate-900">
              Вид спорта
              <input name="sport" defaultValue={lead.sport} className={fieldClass} />
            </label>
            <label className="text-sm text-slate-900">
              Количество
              <input
                name="quantity"
                type="number"
                min="1"
                required
                defaultValue={lead.quantity ?? 25}
                className={fieldClass}
              />
            </label>
            <label className="text-sm text-slate-900">
              Сумма, ₽
              <input
                name="amount"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={lead.estimatedAmount}
                className={fieldClass}
              />
            </label>
            <label className="text-sm text-slate-900">
              Желаемая дата
              <input
                name="desiredDate"
                type="date"
                defaultValue={lead.desiredDate ?? "2026-08-31"}
                className={fieldClass}
              />
            </label>
            <div className="flex items-end justify-end gap-2 sm:col-span-2">
              <Button type="button" onClick={() => setMode("choice")}>Назад</Button>
              <Button type="submit" variant="primary">Создать заказ</Button>
            </div>
          </form>
        ) : mode === "reject" ? (
          <form className="mt-6 space-y-4 text-slate-900" onSubmit={submitRejection}>
            <label className="block text-sm text-slate-900">
              Причина
              <select
                value={reasonId}
                onChange={(event) => {
                  setReasonId(event.target.value);
                  setError("");
                }}
                className={fieldClass}
                required
              >
                <option value="">Выберите причину</option>
                {reasons.map((item) => (
                  <option key={item.id} value={item.id}>{item.category} — {item.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-slate-900">
              Комментарий{" "}
              {reason?.requiresComment
                ? <span className="text-red-600">обязателен</span>
                : <span className="text-slate-500">необязателен</span>}
              <textarea
                value={comment}
                onChange={(event) => {
                  setComment(event.target.value);
                  setError("");
                }}
                rows={4}
                className={textareaClass}
              />
            </label>
            {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => setMode("choice")}>Назад</Button>
              <Button type="submit" className="border-red-200 text-red-700">Подтвердить отказ</Button>
            </div>
          </form>
        ) : (
          <div className="mt-6 text-slate-900">
            <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Источник</dt>
                <dd className="font-medium text-slate-900">{lead.source}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Ответственный</dt>
                <dd className="font-medium text-slate-900">{lead.responsible.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Оценка</dt>
                <dd className="font-medium text-slate-900">
                  {new Intl.NumberFormat("ru-RU").format(lead.estimatedAmount)} ₽
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Следующий контакт</dt>
                <dd className="font-medium text-slate-900">{lead.nextContact}</dd>
              </div>
            </dl>

            {mode === "choice" ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMode("convert")}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left"
                >
                  <strong className="text-emerald-800">Успешно</strong>
                  <span className="mt-1 block text-sm text-slate-600">Создать заказ покупателя</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("reject")}
                  className="rounded-xl border border-red-200 bg-red-50 p-4 text-left"
                >
                  <strong className="text-red-800">Отказ</strong>
                  <span className="mt-1 block text-sm text-slate-600">Указать причину</span>
                </button>
              </div>
            ) : (
              <div className="mt-5 flex justify-end">
                <Button variant="primary" onClick={() => setMode("choice")}>Завершить лид</Button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
