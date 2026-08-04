/**
 * Platform system settings (Stage 18.1.2).
 */

export type PlatformSystemSettings = {
  id: number;
  organization_display_name: string;
  default_timezone: string;
  support_email: string | null;
  ui_locale: string;
  notes: string | null;
  logo_url: string | null;
  logo_filename: string | null;
  created_at: string;
  updated_at: string;
};

export type PlatformSystemSettingsDraft = {
  organization_display_name: string;
  default_timezone: string;
  support_email: string;
  ui_locale: string;
  notes: string;
};

export type PlatformBrand = {
  organization_display_name: string;
  logo_url: string | null;
};

export const DEFAULT_PLATFORM_BRAND: PlatformBrand = {
  organization_display_name: "SPORT-LEAD",
  logo_url: null,
};

export const PLATFORM_TIMEZONE_OPTIONS = [
  "Europe/Moscow",
  "Europe/Samara",
  "Asia/Yekaterinburg",
  "Asia/Novosibirsk",
  "Asia/Vladivostok",
  "UTC",
] as const;

export const PLATFORM_LOCALE_OPTIONS = [
  { value: "ru-RU", label: "Русский (ru-RU)" },
  { value: "en-US", label: "English (en-US)" },
] as const;

export function platformMediaUrl(contentUrl: string | null | undefined): string | null {
  if (!contentUrl) return null;
  if (
    contentUrl.startsWith("http://") ||
    contentUrl.startsWith("https://") ||
    contentUrl.startsWith("blob:")
  ) {
    return contentUrl;
  }
  const base = (
    process.env.NEXT_PUBLIC_SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
  return `${base}${contentUrl.startsWith("/") ? contentUrl : `/${contentUrl}`}`;
}

export function brandInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "SL";
  if (parts.length === 1) {
    const token = parts[0].replace(/[^A-Za-zА-Яа-я0-9]/gu, "");
    return (token.slice(0, 2) || "SL").toUpperCase();
  }
  const a = parts[0][0] ?? "";
  const b = parts[1][0] ?? "";
  return `${a}${b}`.toUpperCase() || "SL";
}

export function toPlatformSystemSettingsDraft(
  settings: PlatformSystemSettings,
): PlatformSystemSettingsDraft {
  return {
    organization_display_name: settings.organization_display_name,
    default_timezone: settings.default_timezone,
    support_email: settings.support_email ?? "",
    ui_locale: settings.ui_locale,
    notes: settings.notes ?? "",
  };
}

export function isPlatformSystemSettingsDirty(
  settings: PlatformSystemSettings,
  draft: PlatformSystemSettingsDraft,
): boolean {
  return (
    settings.organization_display_name !== draft.organization_display_name.trim() ||
    settings.default_timezone !== draft.default_timezone.trim() ||
    (settings.support_email ?? "") !== draft.support_email.trim() ||
    settings.ui_locale !== draft.ui_locale.trim() ||
    (settings.notes ?? "") !== draft.notes.trim()
  );
}

export function validatePlatformSystemSettingsDraft(
  draft: PlatformSystemSettingsDraft,
): string | null {
  if (!draft.organization_display_name.trim()) {
    return "Укажите отображаемое название организации";
  }
  if (draft.organization_display_name.trim().length > 255) {
    return "Название организации не длиннее 255 символов";
  }
  if (!draft.default_timezone.trim()) {
    return "Укажите часовой пояс";
  }
  if (!draft.ui_locale.trim()) {
    return "Укажите локаль интерфейса";
  }
  const email = draft.support_email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Укажите корректный email поддержки";
  }
  return null;
}
