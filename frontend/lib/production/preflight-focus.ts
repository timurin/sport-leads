/** Where a preflight action should land. This module does not decide whether a field is required. */

import { planActionResolves, type PreflightItem } from "./tech-card-preflight.ts";

export type PreflightOpen =
  | "dates"
  | "model"
  | "assembly"
  | "norms"
  | "route"
  | "variant"
  | "quantity"
  | "personalization"
  | "plan"
  | "section";

export type PreflightFocusTarget = {
  open: PreflightOpen;
  sectionId: string | null;
  tab: "assembly" | "operations" | null;
  field: string;
  fallbackField: string | null;
  operationName: string | null;
};

export type PreflightFocusRequest = PreflightFocusTarget & { token: number };

const HIGHLIGHT_MS = 6000;

export function preflightFocusTarget(item: PreflightItem): PreflightFocusTarget {
  const tab: PreflightFocusTarget["tab"] = item.tab === "assembly" || item.tab === "operations" ? item.tab : null;
  const operationName = item.focusOperation;
  const base = {
    sectionId: item.sectionId,
    tab,
    fallbackField: item.sectionId ? `#${item.sectionId}` : null,
    operationName,
  };

  if (item.code === "planning_dates_required") {
    return {
      ...base,
      open: "dates",
      field: "[data-preflight-field='shipping-date']",
      fallbackField: "#tech-card-route",
      operationName: null,
    };
  }
  if (item.code === "model_required") {
    return { ...base, open: "model", field: "#tech-card-product-model", operationName: null };
  }
  if (item.code === "assembly_required" || item.code === "assembly_sewing") {
    return { ...base, open: "assembly", field: "[data-tech-card-assembly-select]", operationName: null };
  }
  if (item.kind === "norms" || item.code === "operation_norms") {
    const single = Boolean(operationName) && item.operations.length <= 1;
    return {
      ...base,
      open: "norms",
      tab: "operations",
      field: single && operationName ? operationNormSelector(operationName) : "#product-model-route-norms",
      fallbackField: "#product-model-route-norms",
      operationName: single ? operationName : null,
    };
  }
  if (item.code === "route_required") {
    return {
      ...base,
      open: "route",
      field: "#tech-card-route [data-tech-card-routing-select]",
      operationName: null,
    };
  }
  if (item.code === "variant_not_selected") {
    return {
      ...base,
      open: "variant",
      field: operationName ? routeVariantSelector(operationName) : "[data-route-variant] input[type='radio']",
      fallbackField: "[data-route-variant] input[type='radio']",
      operationName,
    };
  }
  if (item.code === "invalid_quantity") {
    return {
      ...base,
      open: "section",
      sectionId: "tech-card-order-data",
      field: "#tech-card-order-data",
      fallbackField: null,
      operationName: null,
    };
  }
  if (item.code === "personalization_quantity_mismatch") {
    return {
      ...base,
      open: "personalization",
      tab: "assembly",
      field: "[data-preflight-field='unit-quantity']",
      operationName: null,
    };
  }
  if (item.code === "plan_review") {
    if (planActionResolves(item)) {
      return {
        ...base,
        open: "plan",
        sectionId: "tech-card-route",
        field: "[data-tech-card-schedule-cta]",
        fallbackField: "#tech-card-route",
        operationName: null,
      };
    }
    if (item.sourceCodes.includes("quantity_planning_start_shipping_required")) {
      return {
        ...base,
        open: "dates",
        field: "[data-preflight-field='shipping-date']",
        fallbackField: "#tech-card-route",
        operationName: null,
      };
    }
    return {
      ...base,
      open: "section",
      sectionId: "tech-card-route",
      field: "#tech-card-route",
      fallbackField: null,
      operationName: null,
    };
  }
  if (item.code.startsWith("calendar_allocation_") || item.diagnosticField?.startsWith("production_plan.assignment.")) {
    return {
      ...base,
      open: "section",
      sectionId: "tech-card-route",
      field: "#tech-card-route",
      fallbackField: null,
      operationName: null,
    };
  }
  if (item.sectionId === "tech-card-planning") {
    return {
      ...base,
      open: "section",
      sectionId: "tech-card-route",
      field: "#tech-card-route",
      fallbackField: null,
      operationName: null,
    };
  }
  return {
    ...base,
    open: "section",
    field: item.sectionId ? `#${item.sectionId}` : "#tech-card-readiness",
    operationName: null,
  };
}

export function operationNormSelector(operationName: string): string {
  return attrSelector("data-preflight-operation", operationName);
}

export function routeVariantSelector(operationName: string): string {
  return `${attrSelector("data-route-variant", operationName)} input[type='radio']`;
}

export function revealPreflightTarget(target: PreflightFocusTarget, isAlive: () => boolean = () => true): Promise<boolean> {
  if (target.open === "norms" && target.operationName) return revealNamedNorm(target, isAlive);
  const timeout = target.open === "norms" ? 8000 : 1600;
  return waitFor(() => resolveField(target), isAlive, timeout).then((node) => {
    if (!isAlive()) return false;
    if (node) return focusField(node);
    if (target.fallbackField && target.fallbackField !== target.field) {
      const fallback = query(target.fallbackField);
      if (fallback && isAlive()) return focusField(fallback);
    }
    if (target.sectionId) {
      const section = document.getElementById(target.sectionId);
      if (section && isAlive()) return focusField(section);
    }
    return false;
  });
}

export function cancelPreflightHighlight(): void {
  stopHighlight?.();
  stopHighlight = null;
}

function revealNamedNorm(target: PreflightFocusTarget, isAlive: () => boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const started = performance.now();
    let sectionSeenAt: number | null = null;
    const tick = () => {
      if (!isAlive()) {
        resolve(false);
        return;
      }
      const field = query(target.field);
      if (field) {
        resolve(focusField(field));
        return;
      }
      const section = document.getElementById("product-model-route-norms");
      if (section && sectionSeenAt == null) sectionSeenAt = performance.now();
      const sectionSettled = sectionSeenAt != null && performance.now() - sectionSeenAt > 700;
      if (section && sectionSettled) {
        resolve(focusField(section));
        return;
      }
      if (performance.now() - started > 8000) {
        resolve(false);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function resolveField(target: PreflightFocusTarget): HTMLElement | null {
  if (target.open === "dates") return firstEmptyDate();
  return query(target.field);
}

function firstEmptyDate(): HTMLElement | null {
  const start = document.querySelector("[data-preflight-field='planning-start']");
  const ship = document.querySelector("[data-preflight-field='shipping-date']");
  if (start instanceof HTMLInputElement && start.value.trim() === "") return start;
  if (ship instanceof HTMLElement) return ship;
  return start instanceof HTMLElement ? start : null;
}

function query(selector: string): HTMLElement | null {
  const node = document.querySelector(selector);
  return node instanceof HTMLElement ? node : null;
}

function focusField(node: HTMLElement): boolean {
  const target = focusable(node);
  target.scrollIntoView({ block: "center", inline: "nearest" });
  holdHighlight(target);
  target.focus({ preventScroll: true });
  return document.activeElement === target || target.contains(document.activeElement);
}

function focusable(node: HTMLElement): HTMLElement {
  if (!isDisabled(node)) {
    if (!isNaturallyFocusable(node) && node.tabIndex < 0) node.tabIndex = -1;
    return node;
  }
  const section = node.closest("section");
  if (section instanceof HTMLElement) {
    if (section.tabIndex < 0) section.tabIndex = -1;
    return section;
  }
  return node;
}

function isDisabled(node: HTMLElement): boolean {
  return "disabled" in node && Boolean((node as HTMLButtonElement).disabled);
}

function isNaturallyFocusable(node: HTMLElement): boolean {
  return node instanceof HTMLButtonElement
    || node instanceof HTMLInputElement
    || node instanceof HTMLSelectElement
    || node instanceof HTMLTextAreaElement
    || node instanceof HTMLAnchorElement;
}

let stopHighlight: (() => void) | null = null;

function holdHighlight(node: HTMLElement): void {
  stopHighlight?.();
  ensureHighlightStyle();
  const selector = highlightSelector(node);
  let alive = true;
  let current = node;
  const until = performance.now() + HIGHLIGHT_MS;
  const tick = () => {
    if (!alive) return;
    if (selector) {
      const live = document.querySelector(selector);
      if (live instanceof HTMLElement) current = live;
    }
    if (performance.now() > until || !current.isConnected) {
      current.removeAttribute("data-preflight-highlight");
      alive = false;
      if (stopHighlight === cancel) stopHighlight = null;
      return;
    }
    if (current.getAttribute("data-preflight-highlight") !== "true") current.setAttribute("data-preflight-highlight", "true");
    requestAnimationFrame(tick);
  };
  const cancel = () => {
    alive = false;
    current.removeAttribute("data-preflight-highlight");
  };
  stopHighlight = cancel;
  requestAnimationFrame(tick);
}

function highlightSelector(node: HTMLElement): string | null {
  if (node.id) return `#${cssEscape(node.id)}`;
  const field = node.getAttribute("data-preflight-field");
  if (field) return attrSelector("data-preflight-field", field);
  if (node.hasAttribute("data-tech-card-schedule-cta")) return "[data-tech-card-schedule-cta]";
  if (node.hasAttribute("data-tech-card-assembly-select")) return "[data-tech-card-assembly-select]";
  if (node.hasAttribute("data-tech-card-routing-select")) return "#tech-card-route [data-tech-card-routing-select]";
  const operation = node.getAttribute("data-preflight-operation");
  if (operation) return attrSelector("data-preflight-operation", operation);
  return null;
}

function cssEscape(value: string): string {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(value)
    : value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const HIGHLIGHT_CSS = "[data-preflight-highlight='true']{outline:2px solid #d92d20 !important;outline-color:#d92d20 !important;outline-offset:3px;box-shadow:0 0 0 3px #d92d20 !important;scroll-margin:96px}";

function ensureHighlightStyle(): void {
  const existing = document.getElementById("preflight-focus-style");
  if (existing) {
    if (existing.textContent !== HIGHLIGHT_CSS) existing.textContent = HIGHLIGHT_CSS;
    return;
  }
  const style = document.createElement("style");
  style.id = "preflight-focus-style";
  style.textContent = HIGHLIGHT_CSS;
  document.head.appendChild(style);
}

function waitFor(read: () => HTMLElement | null, isAlive: () => boolean, timeoutMs: number): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const started = performance.now();
    const tick = () => {
      if (!isAlive()) {
        resolve(null);
        return;
      }
      const node = read();
      if (node) {
        resolve(node);
        return;
      }
      if (performance.now() - started > timeoutMs) {
        resolve(null);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function attrSelector(attribute: string, value: string): string {
  const escaped = typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(value)
    : value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `[${attribute}="${escaped}"]`;
}
