"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { saveClientSegments } from "@/app/(workspace)/sales/clients/client-segment-actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SectionCard } from "@/components/ui/section-card";
import {
  mergeSegmentTags,
  validateSegmentName,
} from "@/lib/sales/client-segments";

type Props = {
  clientId: number;
  segments: string[];
};

export function ClientSegmentsSection({ clientId, segments }: Props) {
  const [tags, setTags] = useState(segments);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const persist = (next: string[]) => {
    startTransition(async () => {
      setError(null);
      const result = await saveClientSegments(clientId, next);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setTags(result.tags);
      setDraft("");
    });
  };

  return (
    <SectionCard
      title="Сегменты"
      description="Свободные теги клиента (VIP, школа, опт). Не блокируют сохранение карточки."
      size="compact"
    >
      {error ? (
        <InlineAlert tone="danger" size="compact">
          {error}
        </InlineAlert>
      ) : null}
      <div className="flex flex-wrap gap-portal-2">
        {tags.length === 0 ? (
          <p className="text-portal-caption text-portal-muted">Сегменты не заданы</p>
        ) : (
          tags.map((tag) => (
            <button
              key={tag}
              type="button"
              disabled={pending}
              className="rounded-portal-md border border-portal-border bg-portal-surface px-portal-3 py-1 text-portal-caption text-portal-text hover:bg-portal-state-hover"
              onClick={() => persist(tags.filter((item) => item !== tag))}
            >
              {tag} ×
            </button>
          ))
        )}
      </div>
      <form
        className="mt-portal-3 flex flex-wrap items-end gap-portal-2"
        onSubmit={(event) => {
          event.preventDefault();
          const message = validateSegmentName(draft);
          if (message) {
            setError(message);
            return;
          }
          persist(mergeSegmentTags(tags, draft));
        }}
      >
        <Field label="Новый сегмент" htmlFor="client-segment-add" className="min-w-40 flex-1">
          <Input
            id="client-segment-add"
            value={draft}
            maxLength={64}
            onChange={(event) => setDraft(event.target.value)}
          />
        </Field>
        <Button type="submit" size="compact" disabled={pending}>
          Добавить
        </Button>
      </form>
    </SectionCard>
  );
}

type DuplicateWarningProps = {
  candidates: Array<{
    id: number;
    company_name: string | null;
    contact_name: string;
    matched_on: string[];
  }>;
  labels: (code: string) => string;
};

export function ClientDuplicateWarning({
  candidates,
  labels,
}: DuplicateWarningProps) {
  if (candidates.length === 0) return null;
  return (
    <InlineAlert tone="warning" size="compact">
      Похожие клиенты:{" "}
      {candidates.map((row, index) => (
        <span key={row.id}>
          {index > 0 ? ", " : null}
          <Link
            href={`/sales/clients/${row.id}`}
            className="font-medium text-portal-primary hover:underline"
          >
            {row.company_name?.trim() || row.contact_name}
          </Link>
          <span className="text-portal-muted">
            {" "}
            ({row.matched_on.map(labels).join(", ")})
          </span>
        </span>
      ))}
      . Сохранение не блокируется.
    </InlineAlert>
  );
}
