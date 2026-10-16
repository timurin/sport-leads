/** Admin presentation of the TechOperation explicit-hours demand rule. Seconds stay the stored unit. */

export type DemandRule = "fixed_per_order" | "per_item";
export type DemandDurationUnit = "min" | "sec";

export const FIXED_DEMAND_EXAMPLE = "60 мин. → 1 чел.-ч на техкарту";
export const PER_ITEM_DEMAND_EXAMPLE = "2 мин. × 100 шт. → 3 ч 20 мин.";
export const DEMAND_RULE_LABEL: Record<DemandRule, string> = {
  fixed_per_order: "Фиксированное время на техкарту",
  per_item: "Время на одно изделие",
};

const MAX_SECONDS = 2147483647;
const SAMPLE_QUANTITY = 100;

export function isDemandRule(value: unknown): value is DemandRule {
  return value === "fixed_per_order" || value === "per_item";
}

export function demandDurationField(seconds: number | null | undefined): { value: string; unit: DemandDurationUnit } {
  if (seconds == null || !Number.isInteger(seconds) || seconds <= 0) return { value: "", unit: "min" };
  const minutes = exactDecimal(seconds, 60);
  if (minutes != null) return { value: minutes, unit: "min" };
  return { value: String(seconds), unit: "sec" };
}

export function parseDemandDuration(value: string, unit: DemandDurationUnit = "min"): { seconds: number | null; error: string | null } {
  const text = value.trim().replace(",", ".");
  if (!text) return { seconds: null, error: null };
  if (!/^\d+(\.\d+)?$/.test(text)) return { seconds: null, error: "Укажите норму времени" };
  const seconds = unit === "sec" ? integerSeconds(text) : minuteTextToSeconds(text);
  if (seconds == null) return { seconds: null, error: "Норма времени должна переводиться в целые секунды" };
  if (seconds <= 0) return { seconds: null, error: "Укажите норму времени больше нуля" };
  if (seconds > MAX_SECONDS) return { seconds: null, error: "Норма времени слишком большая" };
  return { seconds, error: null };
}

export function demandRuleHint(rule: DemandRule | null, seconds: number | null): string {
  if (rule === "per_item") return seconds == null ? PER_ITEM_DEMAND_EXAMPLE : perItemHint(seconds);
  if (rule === "fixed_per_order") return seconds == null ? FIXED_DEMAND_EXAMPLE : fixedHint(seconds);
  return `${FIXED_DEMAND_EXAMPLE}. ${PER_ITEM_DEMAND_EXAMPLE}`;
}

export function demandWriteFields(draft: {
  demand_rule?: DemandRule | null;
  demand_duration_minutes?: string;
  demand_duration_unit?: DemandDurationUnit;
}): { include: false } | { include: true; demand_rule: DemandRule | null; demand_duration_seconds: number | null } | { error: string } {
  const hasRule = Object.prototype.hasOwnProperty.call(draft, "demand_rule");
  const hasDuration = Object.prototype.hasOwnProperty.call(draft, "demand_duration_minutes");
  if (!hasRule && !hasDuration) return { include: false };
  const parsed = parseDemandDuration(draft.demand_duration_minutes ?? "", draft.demand_duration_unit ?? "min");
  if (parsed.error) return { error: parsed.error };
  return {
    include: true,
    demand_rule: isDemandRule(draft.demand_rule) ? draft.demand_rule : null,
    demand_duration_seconds: parsed.seconds,
  };
}

function minuteTextToSeconds(text: string): number | null {
  const [whole, frac = ""] = text.split(".");
  const sixty = BigInt(60);
  const scale = BigInt(10) ** BigInt(frac.length);
  const product = BigInt(whole) * sixty * scale + BigInt(frac || "0") * sixty;
  if (product % scale !== BigInt(0)) return null;
  const seconds = product / scale;
  return seconds > BigInt(Number.MAX_SAFE_INTEGER) ? null : Number(seconds);
}

function integerSeconds(text: string): number | null {
  if (text.includes(".")) return null;
  const seconds = BigInt(text);
  return seconds > BigInt(Number.MAX_SAFE_INTEGER) ? null : Number(seconds);
}

function fixedHint(seconds: number): string {
  return `${formatMinutesLabel(seconds)} → ${formatLaborHours(seconds)} на техкарту`;
}

function perItemHint(seconds: number): string {
  return `${formatMinutesLabel(seconds)} × ${SAMPLE_QUANTITY} шт. → ${formatClock(seconds * SAMPLE_QUANTITY)}`;
}

function formatMinutesLabel(seconds: number): string {
  const minutes = exactDecimal(seconds, 60);
  if (minutes != null) return `${minutes.replace(".", ",")} мин.`;
  return `${seconds} сек.`;
}

function formatLaborHours(seconds: number): string {
  const hours = exactDecimal(seconds, 3600);
  if (hours != null) return `${hours.replace(".", ",")} чел.-ч`;
  return formatClock(seconds);
}

function formatClock(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0 && minutes > 0 && rest === 0) return `${hours} ч ${minutes} мин.`;
  if (hours > 0 && minutes === 0 && rest === 0) return `${hours} ч`;
  if (hours === 0 && rest === 0) return `${minutes} мин.`;
  return `${hours} ч ${minutes} мин. ${rest} сек.`;
}

function exactDecimal(numerator: number, denominator: number): string | null {
  if (!Number.isInteger(numerator) || numerator < 0 || denominator <= 0) return null;
  const whole = Math.floor(numerator / denominator);
  let remainder = numerator % denominator;
  if (remainder === 0) return String(whole);
  let digits = "";
  const seen = new Set<number>();
  while (remainder !== 0 && digits.length < 8) {
    if (seen.has(remainder)) return null;
    seen.add(remainder);
    remainder *= 10;
    digits += String(Math.floor(remainder / denominator));
    remainder %= denominator;
  }
  if (remainder !== 0) return null;
  return `${whole}.${digits.replace(/0+$/, "")}`;
}
