(function () {
  const demo = window.SPORT_LEADS_DEMO;
  if (!demo) return;

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function money(n) {
    return new Intl.NumberFormat("ru-RU").format(n) + " ₽";
  }

  function setText(sel, value) {
    document.querySelectorAll(sel).forEach((el) => {
      el.textContent = value == null || value === "" ? "—" : String(value);
    });
  }

  function setValue(sel, value) {
    document.querySelectorAll(sel).forEach((el) => {
      el.value = value == null ? "" : String(value);
    });
  }

  function renderStages(container, stages) {
    if (!container) return;
    container.innerHTML = stages
      .map((s, i) => {
        const cls = s.state === "done" ? "is-done" : s.state === "current" ? "is-current" : "";
        return `<div class="stage ${cls}"><span class="n">${i + 1}</span>${s.label}</div>`;
      })
      .join("");
  }

  function renderTimeline(container, items) {
    if (!container) return;
    container.innerHTML = items
      .map(
        (e) =>
          `<div class="event"><span class="dot" aria-hidden="true"></span><div><b>${e.title}</b><div class="small">${e.who} · ${e.when}</div></div></div>`,
      )
      .join("");
  }

  function renderMessages(container, items) {
    if (!container) return;
    container.innerHTML = items
      .map(
        (m) =>
          `<div class="msg-item"><div class="who">${m.who}</div><div class="small">${m.when}</div><div>${m.text}</div></div>`,
      )
      .join("");
  }

  function bindTabs() {
    const tabs = document.querySelectorAll("[data-tab]");
    const panels = document.querySelectorAll("[data-panel]");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.getAttribute("data-tab");
        tabs.forEach((t) => {
          const on = t === tab;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        panels.forEach((p) => {
          p.classList.toggle("is-hidden", p.getAttribute("data-panel") !== id);
        });
      });
    });
  }

  function bindViewModes() {
    const buttons = document.querySelectorAll("[data-view-mode]");
    if (!buttons.length) return;
    const sections = document.querySelectorAll(".main [data-section], main [data-section]");
    /* Right aside (finance + client + chat) is permanent — never in this map */
    const map = {
      all: ["info", "items", "history", "tasks", "comments", "techCards"],
      info: ["info", "comments", "tasks"],
      items: ["items", "techCards"],
      communication: [],
      documents: ["documents"],
      techCards: ["techCards"],
    };
    function apply(mode) {
      const visible = new Set(map[mode] || map.all);
      buttons.forEach((b) => {
        const on = b.getAttribute("data-view-mode") === mode;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      sections.forEach((s) => {
        const key = s.getAttribute("data-section");
        /* empty mode (communication): hide all left sections, keep right aside */
        s.classList.toggle("is-hidden", !visible.has(key));
      });
    }
    buttons.forEach((b) => b.addEventListener("click", () => apply(b.getAttribute("data-view-mode"))));
    apply("all");
  }

  function fillLead() {
    const id = qs("id") || "1042";
    const lead = demo.leads[id];
    if (!lead) {
      setText("[data-bind='lead.title']", `Лид #${id} не найден`);
      return;
    }

    document.title = `SPORT-LEAD — Лид #${lead.id}`;
    setText("[data-bind='lead.id']", lead.id);
    setText("[data-bind='lead.title']", lead.title);
    setText("[data-bind='lead.stage']", lead.stageLabel);
    setText("[data-bind='lead.responsible']", lead.responsible.name);
    setText("[data-bind='lead.source']", lead.source);
    setText("[data-bind='lead.lastActivity']", lead.lastActivityLabel);
    setText("[data-bind='lead.amount']", money(lead.estimatedAmount));
    setText("[data-bind='lead.probability']", `${lead.probability}%`);
    setText("[data-bind='lead.priority']", lead.priorityLabel);
    setText("[data-bind='customer.organizationName']", lead.customer.organizationName);
    setText("[data-bind='customer.preferredChannelLabel']", lead.customer.preferredChannelLabel);

    const c = lead.customer;
    setValue("[data-bind-input='customer.typeLabel']", c.typeLabel);
    setValue("[data-bind-input='customer.organizationName']", c.organizationName);
    setValue("[data-bind-input='customer.city']", c.city);
    setValue("[data-bind-input='customer.region']", c.region);
    setValue("[data-bind-input='customer.address']", c.address);
    setValue("[data-bind-input='customer.taxId']", c.taxId);
    setValue("[data-bind-input='customer.website']", c.website);
    setValue("[data-bind-input='customer.contactName']", c.contactName);
    setValue("[data-bind-input='customer.position']", c.position);
    setValue("[data-bind-input='customer.phone']", c.phone);
    setValue("[data-bind-input='customer.email']", c.email);
    setValue("[data-bind-input='customer.preferredChannelLabel']", c.preferredChannelLabel);
    setValue("[data-bind-input='customer.comment']", c.comment);

    const m = lead.commercial;
    setValue("[data-bind-input='commercial.direction']", m.direction);
    setValue("[data-bind-input='commercial.sport']", m.sport);
    setValue("[data-bind-input='commercial.productCategory']", m.productCategory);
    setValue("[data-bind-input='commercial.needDescription']", m.needDescription);
    setValue("[data-bind-input='commercial.estimatedQuantity']", m.estimatedQuantity);
    setValue("[data-bind-input='commercial.preliminaryBudget']", m.preliminaryBudget);
    setValue("[data-bind-input='commercial.discountPercent']", m.discountPercent);
    setValue("[data-bind-input='commercial.plannedOrderDate']", m.plannedOrderDate);
    setValue("[data-bind-input='commercial.deliveryCity']", m.deliveryCity);
    setValue("[data-bind-input='commercial.deliveryAddress']", m.deliveryAddress);
    setValue("[data-bind-input='commercial.deliveryMethod']", m.deliveryMethod);
    setValue("[data-bind-input='commercial.deliveryComment']", m.deliveryComment);
    setValue("[data-bind-input='commercial.campaign']", m.campaign);
    setValue("[data-bind-input='lead.source']", lead.source);

    renderStages(document.querySelector("[data-stage-rail]"), lead.stages);
    renderTimeline(document.querySelector("[data-timeline]"), lead.activities);
    renderMessages(document.querySelector("[data-messages]"), lead.messages);
    renderMessages(document.querySelector("[data-collab]"), lead.collab);

    const tasksEl = document.querySelector("[data-tasks]");
    if (tasksEl) {
      tasksEl.innerHTML = lead.tasks
        .map((t) => `<tr><td>${t.title}</td><td>${t.due}</td><td><span class="chip">${t.status}</span></td></tr>`)
        .join("");
    }

    document.querySelectorAll("[data-order-link]").forEach((a) => {
      a.href = `order-card-reference-v1.html?id=${encodeURIComponent(lead.orderId)}`;
    });
    setText("[data-bind='order.number']", lead.orderNumber);
    bindTabs();
  }

  function fillOrder() {
    const id = qs("id") || "8801";
    const order = demo.orders[id];
    if (!order) {
      setText("[data-bind='order.number']", `Заказ #${id} не найден`);
      return;
    }

    document.title = `SPORT-LEAD — Заказ ${order.number}`;
    setText("[data-bind='order.id']", order.id);
    setText("[data-bind='order.number']", order.number);
    setText("[data-bind='order.title']", order.title);
    setText("[data-bind='order.status']", order.statusLabel);
    setText("[data-bind='order.client']", order.clientName);
    setText("[data-bind='order.organization']", order.organizationName);
    setText("[data-bind='order.responsible']", order.responsibleName);
    setText("[data-bind='order.amount']", order.amount);
    setText("[data-bind='order.amountNet']", order.amountNet);
    setText("[data-bind='order.vatAmount']", order.vatAmount);
    setText("[data-bind='order.itemsSubtotal']", order.itemsSubtotal);
    setText("[data-bind='order.discount']", order.discount);
    setText("[data-bind='order.currency']", order.currencyCode);
    setText("[data-bind='order.source']", order.source);
    setText("[data-bind='order.category']", order.category);
    setText("[data-bind='order.sport']", order.sport);
    setText("[data-bind='order.description']", order.description);
    setText("[data-bind='order.lastActivity']", order.lastActivityLabel);
    setText("[data-bind='order.plannedShip']", order.plannedShipDate);
    setText("[data-bind='order.techCompleteness']", order.techSummary.completeness);
    setText(
      "[data-bind='order.techShort']",
      `${order.techSummary.open} из ${order.techSummary.total}`,
    );
    setText("[data-bind='order.techSub']", "manufacturable");
    setText("[data-bind='contact.name']", order.contact.name);
    setText("[data-bind='contact.channel']", order.contact.preferredChannelLabel);
    setText("[data-bind='lead.id']", order.leadId);

    renderStages(document.querySelector("[data-stage-rail]"), order.stages);
    renderTimeline(document.querySelector("[data-timeline]"), order.history);
    renderMessages(document.querySelector("[data-collab]"), order.collab);

    const itemsEl = document.querySelector("[data-order-items]");
    if (itemsEl) {
      itemsEl.innerHTML = order.items
        .map((row) => {
          const tc =
            row.techCardId == null
              ? `<span class="small">${row.techCardStatus}</span>`
              : `<span class="chip">${row.techCardId} · ${row.techCardStatus}</span>`;
          return `<tr>
            <td><b>${row.name}</b><div class="small">${row.article} · ${row.variant}</div></td>
            <td>${row.model}<div class="small">${row.assembly}</div></td>
            <td>${row.qty}</td>
            <td>${row.price}</td>
            <td>${row.vat}</td>
            <td><b>${row.sum}</b></td>
            <td>${tc}</td>
          </tr>`;
        })
        .join("");
    }

    document.querySelectorAll("[data-lead-link]").forEach((a) => {
      a.href = `lead-card-reference-v1.html?id=${encodeURIComponent(order.leadId)}`;
    });
    bindViewModes();
  }

  const page = document.body.getAttribute("data-preview-page");
  if (page === "lead") fillLead();
  if (page === "order") fillOrder();
})();
