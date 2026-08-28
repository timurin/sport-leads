"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  createClientRecord,
  findClientDuplicates,
} from "@/app/(workspace)/sales/clients/client-segment-actions";
import { ClientDuplicateWarning } from "@/components/sales/client-segments-section";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  duplicateMatchLabel,
  mergeSegmentTags,
  validateSegmentName,
  type ClientDuplicateCandidate,
} from "@/lib/sales/client-segments";
import { validateInn } from "@/lib/sales/client-requisites";

type Props = {
  open: boolean;
  onClose: () => void;
  initialContactName?: string;
  onCreated?: (client: { id: number; label: string }) => void;
};

export function ClientCreateDrawer({
  open,
  onClose,
  initialContactName = "",
  onCreated,
}: Props) {
  const router = useRouter();
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [inn, setInn] = useState("");
  const [segmentDraft, setSegmentDraft] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ClientDuplicateCandidate[]>([]);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setContactName(initialContactName.trim());
    setCompanyName("");
    setPhone("");
    setInn("");
    setSegmentDraft("");
    setTags([]);
    setError(null);
    setCandidates([]);
  };

  useEffect(() => {
    if (open) {
      setContactName(initialContactName.trim());
      setError(null);
    }
  }, [open, initialContactName]);

  const refreshDuplicates = () => {
    startTransition(async () => {
      const result = await findClientDuplicates({
        name: companyName || contactName,
        phone,
        inn,
      });
      if (result.ok) setCandidates(result.candidates);
    });
  };

  return (
    <CreateDrawer
      open={open}
      title="Добавить клиента"
      description="Дубли по имени, телефону или ИНН показываются предупреждением — запись всё равно можно создать."
      onClose={() => {
        reset();
        onClose();
      }}
      variant="overlay"
    >
      <form
        className="flex h-full min-h-0 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          if (!contactName.trim()) {
            setError("Укажите контактное лицо");
            return;
          }
          const innError = validateInn(inn);
          if (innError) {
            setError(innError);
            return;
          }
          startTransition(async () => {
            setError(null);
            const result = await createClientRecord({
              contactName,
              companyName,
              phone,
              inn,
              tags,
            });
            if (!result.ok) {
              setError(result.message);
              return;
            }
            reset();
            onClose();
            if (onCreated) {
              onCreated({
                id: result.id,
                label: result.label,
              });
              return;
            }
            router.push(`/sales/clients/${result.id}`);
            router.refresh();
          });
        }}
      >
        <div className="min-h-0 flex-1 space-y-portal-3 overflow-y-auto px-portal-6 py-portal-5">
          {error ? (
            <InlineAlert tone="danger" size="compact">
              {error}
            </InlineAlert>
          ) : null}
          <ClientDuplicateWarning
            candidates={candidates}
            labels={duplicateMatchLabel}
          />
          <Field label="Контактное лицо" htmlFor="new-client-contact" required>
            <Input
              id="new-client-contact"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              onBlur={refreshDuplicates}
            />
          </Field>
          <Field label="Компания" htmlFor="new-client-company">
            <Input
              id="new-client-company"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              onBlur={refreshDuplicates}
            />
          </Field>
          <Field label="Телефон" htmlFor="new-client-phone">
            <Input
              id="new-client-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              onBlur={refreshDuplicates}
            />
          </Field>
          <Field label="ИНН" htmlFor="new-client-inn">
            <Input
              id="new-client-inn"
              value={inn}
              onChange={(event) => setInn(event.target.value)}
              onBlur={refreshDuplicates}
            />
          </Field>
          <Field label="Сегмент" htmlFor="new-client-segment">
            <div className="flex flex-wrap gap-portal-2">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="rounded-portal-md border border-portal-border px-portal-3 py-1 text-portal-caption hover:bg-portal-state-hover"
                  onClick={() => setTags(tags.filter((item) => item !== tag))}
                >
                  {tag} ×
                </button>
              ))}
            </div>
            <div className="mt-portal-2 flex gap-portal-2">
              <Input
                id="new-client-segment"
                value={segmentDraft}
                onChange={(event) => setSegmentDraft(event.target.value)}
              />
              <Button
                type="button"
                size="compact"
                variant="secondary"
                onClick={() => {
                  const message = validateSegmentName(segmentDraft);
                  if (message) {
                    setError(message);
                    return;
                  }
                  setTags(mergeSegmentTags(tags, segmentDraft));
                  setSegmentDraft("");
                }}
              >
                +
              </Button>
            </div>
          </Field>
        </div>
        <div className="flex shrink-0 justify-end gap-portal-2 border-t border-portal-border px-portal-6 py-portal-4">
          <Button
            type="button"
            variant="ghost"
            size="compact"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Отмена
          </Button>
          <Button type="submit" size="compact" disabled={pending}>
            Создать
          </Button>
        </div>
      </form>
    </CreateDrawer>
  );
}
