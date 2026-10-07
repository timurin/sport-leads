import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  acceptCreatedAssignment, assignmentRange, assignmentsFor, calendarAssignmentInput, calendarBoardPath, calendarCreateInput,
  calendarErrorMessage, calendarRequest, calendarSourceLabel, enqueueAssignment, readCreatedAssignment,
  shiftWeek, sourceSearchState, stageStickerTone, stickerLabel, weekDays, weekStickers, CALENDAR_TOOLBAR,
} from "./calendar.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceCard = { id: 6, number: "TC-6", order_number: "ORDER-2", nomenclature_name: "Форма", quantity: "12.000" };

test("calendar week uses local Monday through Sunday across year boundary", () => {
  assert.deepEqual(weekDays("2027-01-01"), ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"]);
  assert.equal(shiftWeek("2026-12-28", 1), "2027-01-04");
  assert.equal(shiftWeek("2027-01-04", -1), "2026-12-28");
});

test("queue cell filters stage/date and sorts position with stable ties", () => {
  const rows = [
    { id: 3, position: 2, production_stage_id: 1, planned_date: "2026-10-05" },
    { id: 2, position: 0, production_stage_id: 1, planned_date: "2026-10-05" },
    { id: 1, position: 0, production_stage_id: 2, planned_date: "2026-10-05" },
    { id: 4, position: 0, production_stage_id: 1, planned_date: "2026-10-06" },
  ];
  assert.deepEqual(assignmentsFor(rows, 1, "2026-10-05").map((row) => row.id), [2, 3]);
  assert.deepEqual(assignmentsFor(rows, 1, "2026-10-07"), []);
});

test("queue entry searches one card, keeps the choice, and posts only card, date and note", () => {
  assert.equal(sourceSearchState({ query: "  ", loading: false, error: "", count: 0 }), "idle");
  assert.equal(sourceSearchState({ query: "TC", loading: true, error: "", count: 0 }), "searching");
  assert.equal(sourceSearchState({ query: "TC", loading: false, error: "Нет связи", count: 0 }), "error");
  assert.equal(sourceSearchState({ query: "TC", loading: false, error: "", count: 0 }), "empty");
  assert.equal(sourceSearchState({ query: "TC", loading: false, error: "", count: 2 }), "results");
  assert.equal(calendarSourceLabel(sourceCard), "TC-6 · ORDER-2 · Форма · 12.000 шт.");
  assert.equal(calendarSourceLabel({ ...sourceCard, nomenclature_name: null }), "TC-6 · ORDER-2 · Изделие · 12.000 шт.");
  const payload = calendarCreateInput(sourceCard.id, "2026-10-12", "  срочно  ");
  assert.deepEqual(payload, { technical_card_id: 6, planned_date: "2026-10-12", note: "срочно" });
  assert.deepEqual(Object.keys(payload).sort(), ["note", "planned_date", "technical_card_id"]);
  assert.equal(calendarCreateInput(sourceCard.id, "2026-10-12", " ").note, null);
  const board = readFileSync(join(root, "components/production/calendar-weekly-board.tsx"), "utf8");
  const entry = board.slice(board.indexOf("function QueueEntryForm"), board.indexOf("function StageRow"));
  assert.equal(entry.includes("Участок"), false);
  assert.equal(entry.includes("Позиция"), false);
  assert.equal(entry.includes("<select"), false);
  assert.ok(entry.includes("Техническая карта / заказ"));
  assert.ok(entry.includes("Начните вводить номер ТК или заказа"));
  assert.ok(entry.includes("Ищем…"));
  assert.ok(entry.includes("ТК не найдена"));
  assert.ok(entry.includes("Выбрано:"));
  assert.ok(entry.includes('href="/production/tech-cards"'));
  assert.ok(entry.includes('role="combobox"'));
  assert.ok(entry.includes("Дата постановки в очередь"));
  assert.ok(board.includes("enqueueAssignment"));
  assert.ok(board.includes("acceptCreatedAssignment"));
  assert.ok(board.includes("saved.production_stage_name"));
  assert.ok(board.includes("calendarErrorMessage"));
  assert.ok(board.includes("Добавить в очередь"));
  assert.ok(board.includes("Перенести назначение"));
  assert.ok(board.includes("Позиция в очереди"));
});

test("live create keeps the server stage and position and survives reload", async () => {
  const original = globalThis.fetch;
  const stage = { id: 9, name: "Подготовка к запуску", code: "launch_preparation" };
  let store = { assignments: [], stages: [stage] };
  globalThis.fetch = async (url, init = {}) => {
    if (init.method === "POST") {
      const body = JSON.parse(init.body);
      assert.equal(String(url).endsWith("/api/production-calendar/assignments"), true);
      assert.deepEqual(Object.keys(body).sort(), ["note", "planned_date", "technical_card_id"]);
      for (const forbidden of ["production_stage_id", "stage", "section", "position", "quantity"]) {
        assert.equal(Object.hasOwn(body, forbidden), false);
      }
      const created = {
        id: 101, technical_card_id: body.technical_card_id, technical_card_number: "TC-42",
        order_number: "ORDER-42", nomenclature_name: "Форма", quantity: "100.000",
        production_stage_id: stage.id, production_stage_name: stage.name,
        planned_date: body.planned_date, position: 3, note: body.note,
      };
      store = { ...store, assignments: [...store.assignments, created] };
      return Response.json(created);
    }
    if (init.method === "PUT") {
      const body = JSON.parse(init.body);
      assert.deepEqual(Object.keys(body).sort(), ["note", "planned_date", "position", "production_stage_id"]);
      return Response.json({ ...store.assignments[0], ...body, production_stage_name: "Печать" });
    }
    return Response.json(store);
  };
  try {
    const input = calendarCreateInput(42, "2026-10-12", "Материал ожидается");
    const created = await enqueueAssignment(calendarRequest, input);
    assert.equal(created.production_stage_name, "Подготовка к запуску");
    assert.equal(created.position, 3);
    const shown = acceptCreatedAssignment({ assignments: [], stages: [stage] }, created);
    assert.deepEqual(assignmentsFor(shown.assignments, created.production_stage_id, created.planned_date), [created]);
    const reloaded = await calendarRequest(calendarBoardPath(created.planned_date));
    assert.equal(reloaded.assignments[0].id, 101);
    assert.equal(reloaded.assignments[0].position, 3);
    assert.equal(reloaded.assignments[0].production_stage_name, "Подготовка к запуску");
    const moved = calendarAssignmentInput(created);
    moved.production_stage_id = 2;
    moved.position = 8;
    const saved = await calendarRequest("/assignments/101", { method: "PUT", body: JSON.stringify(moved) });
    assert.equal(saved.position, 8);
    assert.equal(saved.production_stage_name, "Печать");
  } finally { globalThis.fetch = original; }
});

test("create errors stay visible and do not become a queue row", async () => {
  const original = globalThis.fetch;
  const cases = [
    [() => Response.json({ detail: [{ msg: "Input should be a valid date" }] }, { status: 422 }), /valid date/],
    [() => Response.json({ detail: "Выберите существующую standalone ТК" }, { status: 422 }), /standalone ТК/],
    [() => Response.json({ detail: "Назначение не найдено" }, { status: 404 }), /не найдено/],
    [() => new Response("down", { status: 500 }), /Ошибка календаря \(500\)/],
  ];
  try {
    for (const [respond, pattern] of cases) {
      globalThis.fetch = async () => respond();
      await assert.rejects(enqueueAssignment(calendarRequest, calendarCreateInput(42, "2026-10-12", "")), pattern);
    }
    assert.equal(calendarErrorMessage(new Error("Ошибка календаря (422)"), "Не удалось сохранить"), "Данные очереди не прошли проверку (422)");
    assert.equal(calendarErrorMessage(new Error("Ошибка календаря (404)"), "Не удалось сохранить"), "Техническая карта или назначение не найдены (404)");
    assert.equal(calendarErrorMessage(new Error("Ошибка календаря (500)"), "Не удалось сохранить"), "Сервис очереди недоступен (500)");
    assert.equal(calendarErrorMessage(new Error("Выберите существующую standalone ТК"), "Не удалось сохранить"), "Выберите существующую standalone ТК");
    assert.equal(calendarErrorMessage(new TypeError("Failed to fetch"), "Не удалось сохранить"), "Не удалось связаться с календарём");
    assert.throws(() => readCreatedAssignment({ id: 1, production_stage_id: 9, production_stage_name: "Подготовка к запуску", planned_date: "2026-10-12" }), /позицию/);
  } finally { globalThis.fetch = original; }
});

test("weekly stickers span a range once and clip at the week boundary", () => {
  const days = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"];
  const row = (overrides) => ({
    id: 1, technical_card_id: 7, technical_card_number: "1", order_number: "1760",
    nomenclature_name: "Форма", quantity: "10", production_stage_id: 4, production_stage_name: "Печать",
    planned_date: "2026-10-07", position: 0, note: null, ...overrides,
  });
  assert.equal(stickerLabel(row({})), "1760/1");
  const single = weekStickers([row({})], 4, days);
  assert.equal(single.length, 1);
  assert.equal(single[0].startIndex, 2);
  assert.equal(single[0].endIndex, 2);
  const span = weekStickers([row({ planned_start_date: "2026-10-05", planned_end_date: "2026-10-08" })], 4, days);
  assert.deepEqual([span[0].startIndex, span[0].endIndex, span[0].continuesBefore, span[0].continuesAfter], [0, 3, false, false]);
  const clipped = weekStickers([row({ id: 8, planned_start_date: "2026-10-01", planned_end_date: "2026-10-13" })], 4, days);
  assert.equal(clipped.length, 1);
  assert.equal(clipped[0].continuesBefore, true);
  assert.equal(clipped[0].continuesAfter, true);
  assert.equal(clipped[0].startIndex, 0);
  assert.equal(clipped[0].endIndex, 6);
  const pair = weekStickers([
    row({ id: 2, planned_date: "2026-10-06" }),
    row({ id: 3, planned_date: "2026-10-06", position: 1 }),
    row({ id: 4, production_stage_id: 9, planned_date: "2026-10-06" }),
  ], 4, days);
  assert.deepEqual(pair.map((item) => item.assignment.id), [2, 3]);
  assert.deepEqual(pair.map((item) => item.lane), [0, 1]);
  assert.deepEqual(assignmentRange(row({ planned_start_date: "2026-10-03", planned_end_date: "2026-10-02" })), { start: "2026-10-03", end: "2026-10-03" });
  assert.equal(weekStickers([row({ planned_start_date: "2026-09-01", planned_end_date: "2026-09-02" })], 4, days).length, 0);
  assert.deepEqual(assignmentRange(row({ planned_date: "2026-10-07" })), { start: "2026-10-07", end: "2026-10-07" });
  assert.equal(stageStickerTone({ code: "print", name: "Печать" }), "print");
  assert.equal(stageStickerTone({ code: "launch_preparation", name: "Подготовка к запуску" }), "launch");
  assert.equal(stageStickerTone({ code: "sewing", name: "Пошив" }), "sewing");
  assert.equal(stageStickerTone({ code: "packaging", name: "ВТО и упаковка" }), "packaging");
  assert.deepEqual(CALENDAR_TOOLBAR.map((item) => item.title), ["Календарь", "Ручное планирование", "Мощности", "Дашборд", "Центр отклонений"]);
  const view = readFileSync(join(root, "components/production/calendar-weekly-board.tsx"), "utf8");
  const load = readFileSync(join(root, "components/production/calendar-queue-load.tsx"), "utf8");
  const toolbar = readFileSync(join(root, "components/production/calendar-toolbar.tsx"), "utf8");
  assert.ok(view.includes("data-sticker"));
  assert.ok(view.includes("Открыть техкарту"));
  assert.ok(view.includes('aria-label="Закрыть"'));
  assert.equal(view.includes("function CalendarCell"), false);
  assert.ok(toolbar.includes('aria-current={active ? "page" : undefined}'));
  assert.equal(load.includes("По ресурсам"), false);
  assert.equal(load.includes(">Недостаточно данных"), false);
  assert.equal(load.includes(">Есть резерв"), false);
  for (const tone of ["#eef0f6", "#e8f1ff", "#fff6e8", "#e7f4ec", "#f8eef6", "#eef3f6"]) {
    assert.ok(view.includes(tone));
  }
  assert.equal(view.includes("#d92d20"), false);
});

test("calendar client handles reads, mutations, empty delete and visible API errors", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (init.method === "DELETE") return new Response(null, { status: 204 });
    if (url.endsWith("/forbidden")) return Response.json({ detail: "Нет прав" }, { status: 403 });
    return Response.json({ assignments: [], stages: [] });
  };
  try {
    assert.deepEqual(await calendarRequest("/board?from=2026-10-05&to=2026-10-11"), { assignments: [], stages: [] });
    await calendarRequest("/assignments", { method: "POST", body: '{"technical_card_id":1}' });
    await calendarRequest("/assignments/1", { method: "PUT", body: '{"planned_date":"2026-10-12"}' });
    assert.equal(await calendarRequest("/assignments/1", { method: "DELETE" }), undefined);
    await assert.rejects(calendarRequest("/forbidden"), /Нет прав/);
    assert.equal(calls[0].init.credentials, "include");
    assert.equal(calls[0].init.cache, "no-store");
    assert.equal(calls[1].init.method, "POST");
    assert.equal(calls[2].init.method, "PUT");
  } finally { globalThis.fetch = original; }
});

