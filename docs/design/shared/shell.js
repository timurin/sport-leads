/**
 * Soft UI shell chrome for Design preview (Stage 22).
 * Not live DS-SHELL — structure mirrors frontend/lib/navigation.ts sections.
 */
(function () {
  const SECTIONS = [
    { id: "dashboard", title: "Главная", short: "Г", href: "dashboard/home-reference-v1.html" },
    { id: "sales", title: "Продажи", short: "П", href: "sales/lead-card-reference-v1.html?id=1042" },
    { id: "production", title: "Производство", short: "ПР", href: "production/orders-workspace-reference-v1.html" },
    { id: "warehouse", title: "Склад", short: "С", href: "warehouse/stock-workspace-reference-v1.html" },
    { id: "purchases", title: "Закупки", short: "З", href: "purchases/hub-reference-v1.html" },
    { id: "settings", title: "Настройки", short: "Н", href: "settings/hub-reference-v1.html" },
  ];

  const TOP_NAV = {
    dashboard: [
      { id: "overview", title: "Обзор", href: "dashboard/home-reference-v1.html" },
      { id: "activity", title: "Активность", href: "dashboard/home-reference-v1.html#activity" },
      { id: "analytics", title: "Аналитика", href: "dashboard/home-reference-v1.html#analytics" },
    ],
    sales: [
      { id: "leads", title: "Лиды", href: "sales/leads-board-reference-v1.html" },
      { id: "orders", title: "Заказы", href: "sales/leads-board-reference-v1.html#orders" },
      { id: "clients", title: "Клиенты", href: "index.html#sales" },
      { id: "tasks", title: "Задачи", href: "index.html#sales" },
    ],
    production: [
      { id: "dashboard", title: "Дашборд", href: "production/orders-workspace-reference-v1.html" },
      { id: "orders", title: "Заказы", href: "production/orders-workspace-reference-v1.html" },
      { id: "kanban", title: "Канбан цехов", href: "production/orders-workspace-reference-v1.html#kanban" },
      { id: "tech-cards", title: "Техкарты", href: "production/orders-workspace-reference-v1.html#tech" },
    ],
    warehouse: [
      { id: "dashboard", title: "Дашборд", href: "warehouse/stock-workspace-reference-v1.html" },
      { id: "stock", title: "Номенклатура", href: "warehouse/stock-workspace-reference-v1.html" },
      { id: "movements", title: "Движения", href: "warehouse/stock-workspace-reference-v1.html#movements" },
      { id: "inventory", title: "Инвентаризация", href: "warehouse/stock-workspace-reference-v1.html#inventory" },
    ],
    purchases: [
      { id: "dashboard", title: "Дашборд", href: "purchases/hub-reference-v1.html" },
      { id: "orders", title: "Заказы поставщикам", href: "purchases/hub-reference-v1.html#orders" },
      { id: "suppliers", title: "Поставщики", href: "purchases/hub-reference-v1.html#suppliers" },
    ],
    settings: [
      { id: "hub", title: "Обзор", href: "settings/hub-reference-v1.html" },
      { id: "catalogs", title: "Справочники", href: "settings/hub-reference-v1.html#catalogs" },
      { id: "users", title: "Пользователи", href: "settings/hub-reference-v1.html#users" },
      { id: "org", title: "Организации", href: "settings/hub-reference-v1.html#org" },
    ],
    design: [
      { id: "index", title: "Оглавление", href: "index.html" },
      { id: "lead", title: "Лид", href: "sales/lead-card-reference-v1.html?id=1042" },
      { id: "order", title: "Заказ", href: "sales/order-card-reference-v1.html?id=8801" },
      { id: "shell", title: "Shell", href: "shared/shell-reference-v1.html" },
    ],
  };

  function join(base, path) {
    if (!path) return base || "#";
    if (/^https?:|^\//.test(path)) return path;
    const b = base || "";
    return b + path;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function mount() {
    const body = document.body;
    const base = body.getAttribute("data-base") || "";
    const section = body.getAttribute("data-shell-section") || "design";
    const topActive = body.getAttribute("data-top-nav") || "";
    const pageTitle = body.getAttribute("data-page-title") || "Sport-Lead";
    const createLabel = body.getAttribute("data-create-label") || "Создать";
    const createHref = body.getAttribute("data-create-href") || join(base, "index.html");

    const rail = document.querySelector("[data-shell-rail]");
    if (rail) {
      const links = SECTIONS.map((s) => {
        const active = s.id === section ? " is-active" : "";
        return `<a class="rail-link${active}" href="${esc(join(base, s.href))}" title="${esc(s.title)}"><span class="ico" aria-hidden="true">${esc(s.short)}</span><span>${esc(s.title)}</span></a>`;
      }).join("");

      rail.innerHTML = `
        <div class="rail-inner">
          <a class="rail-brand" href="${esc(join(base, "index.html"))}">
            <span class="brand-mark">SL</span>
            <span>Sport-Lead</span>
          </a>
          <div class="rail-label">Разделы</div>
          ${links}
          <div class="rail-foot">
            <a class="rail-link" href="${esc(join(base, "index.html"))}"><span class="ico">⌂</span><span>Design index</span></a>
            <span class="small">Preview Soft UI · Stage 22</span>
          </div>
        </div>
      `;
    }

    const topbar = document.querySelector("[data-shell-topbar]");
    if (topbar) {
      const navItems = TOP_NAV[section] || TOP_NAV.design;
      const navHtml = navItems
        .map((n) => {
          const on = n.id === topActive ? " is-active" : "";
          return `<a class="${on.trim()}" href="${esc(join(base, n.href))}">${esc(n.title)}</a>`;
        })
        .join("");

      topbar.innerHTML = `
        <div class="topbar-row">
          <label class="topbar-search" aria-label="Поиск">
            <span aria-hidden="true">⌕</span>
            <input type="search" placeholder="Поиск по платформе…" disabled>
          </label>
          <nav class="top-nav" aria-label="Раздел">${navHtml}</nav>
        </div>
        <div class="topbar-actions">
          <span class="topbar-meta" style="font-size:12px;color:var(--subtle)">${esc(pageTitle)}</span>
          <button type="button" class="icon-btn" title="Уведомления" aria-label="Уведомления">N</button>
          <a class="btn is-primary" href="${esc(createHref)}">${esc(createLabel)}</a>
          <span class="avatar-chip" title="Текущий пользователь">
            <span class="av">АК</span>
            <span>А. Козлов</span>
          </span>
        </div>
      `;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
