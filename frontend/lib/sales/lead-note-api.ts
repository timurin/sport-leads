import type { LeadActivity, UserSummary } from "@/types/sales";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export type ApiLeadNote = {
  id: number;
  lead_id: number;
  body: string;
  author_id: number | null;
  author_name: string | null;
  is_pinned: boolean;
  mentioned_user_ids: number[];
  created_at: string;
  updated_at: string;
};

function authorSummary(note: ApiLeadNote): UserSummary | undefined {
  if (note.author_id === null) {
    return undefined;
  }
  const name = note.author_name ?? `Сотрудник #${note.author_id}`;
  return {
    id: String(note.author_id),
    name,
    initials: initialsFromName(name),
  };
}

export function fromApiLeadNote(note: ApiLeadNote): LeadActivity {
  const author = authorSummary(note);
  return {
    id: `note-${note.id}`,
    type: "comment_added",
    occurredAt: note.created_at,
    updatedAt: note.updated_at !== note.created_at ? note.updated_at : undefined,
    author,
    title: "Добавлена внутренняя заметка",
    description: note.body,
    channel: "internal",
    isPinned: note.is_pinned,
    mentionedUserIds: note.mentioned_user_ids.map(String),
  };
}

export function parsePersistedNoteId(activityId: string): string | null {
  const match = /^note-(\d+)$/.exec(activityId);
  return match ? match[1] : null;
}
