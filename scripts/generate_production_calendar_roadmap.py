"""Render the Production Calendar roadmap from the Markdown sources.

Run from the repository root:
    python scripts/generate_production_calendar_roadmap.py
    python scripts/generate_production_calendar_roadmap.py --check

The generated HTML has no editable status storage. Change roadmap-v1.1.md first,
sync its canonical ERP HTML twin, then run this script again.
"""

from __future__ import annotations

import argparse
import html
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ROADMAP = ROOT / "docs/roadmap/roadmap-v1.1.md"
DETAIL = ROOT / "docs/roadmap/production-calendar-v0.1.md"
UI_TASK = ROOT / "docs/tasks/integrate-production-calendar-v0.1-roadmap.md"
VALIDATION = ROOT / "docs/tasks/production-calendar-pc-02-1-validation.md"
OUTPUT = ROOT / "docs/roadmap/production-calendar-v0.1.html"
TWIN = ROOT / "docs/erp/status/roadmap-v1.1.html"

STATUS_LINE = re.compile(r"^- \[([ x])\] (PC-(?:UI-\d{2}|\d{2}(?:\.(?:[123]|1[AB]|0[ACD]|3[AC]|4[ADFGIMOQSTU]|5A|6A|7[AB]))?(?:-B\d+|-A)?)) — (.+)$", re.M)
DETAIL_LINE = re.compile(r"^\*\*(PC-\d{2}(?:\.(?:[123]|1[AB]|0[ACD]|3[AC]|4[ADFGIMOQSTU]|5A|6A|7[AB]))?(?:-B\d+|-A)?) — ([^*]+)\*\*\s*(.*)$", re.M)
UI_LINE = re.compile(r"^\*\*(PC-UI-\d{2}) — ([^*]+)\*\*\s*(.*)$", re.M)

DEPENDENCIES = {
    "PC-01": "Старт",
    "PC-02": "PC-01",
    "PC-02.1": "PC-02",
    "PC-02.1-B1": "Обнаружен в PC-02.1; отдельное исправление",
    "PC-03.1": "PC-03 · owner-selected lightweight queue slice",
    "PC-03.2": "PC-03.1 · owner-selected navigation integration",
    "PC-03.3": "PC-03.2 · owner-selected CalendarAssignment manual scheduling",
    "PC-03.4A": "PC-03.3 · backend-only capacity contract; frontend PC-03.4B separate",
    "PC-03.4D": "PC-03.4A · PC-03.4C live adapter per owner task context",
    "PC-03.7B": "PC-03.7A - M:N resource contract; integration remains open",
    "PC-03.7B-B1": "PC-03.7A - explicit owner modal task within PC-03.7B",
    "PC-03.7A": "PC-03.6A - owner-approved shared resources; frontend PC-03.7B separate",
    "PC-03.6A": "PC-03.5A - backend range contract; frontend PC-03.6B separate",
    "PC-03.5A": "PC-03.4D · owner-selected automatic queue entry; PC-03.5B frontend separate",
    "PC-03": "PC-02.1 · DESIGN-APPROVED · устранение P1 B1 и обязательные проверки",
    "PC-04.4U": "PC-04.4T; owner-selected source-to-snapshot persistence/cache audit",
    "PC-04.4T": "PC-04.4S real data blockers; owner-requested route/assembly input population",
    "PC-04.4S": "PC-04.4Q/R; authorized local stress replacement; manual data readiness blockers",
    "PC-04.4Q": "PC-04.4O/P; owner-selected end-to-end persistence fix",
    "PC-04.4O": "PC-04.4M diagnostics; owner-selected explicit admin demand rule; frontend separate",
    "PC-04.4M": "PC-04.4G/I/L; owner-selected unified readiness diagnostics; frontend separate",
    "PC-04.4I": "PC-04.4G snapshot runtime; owner-selected backend ONE OF; UI PC-04.4J remains separate",
    "PC-04.4G": "PC-04.4F audit; snapshot is the runtime source; editor is PC-04.4H",
    "PC-04.4G-A": "PC-04.4G first bounded iteration under AGENTS.md",
    "PC-04.4F": "PC-04.4D-A and owner-observed contract confusion; audit only",
    "PC-04.4D": "PC-04.4A and VIS-STRESS dataset; backend done, UI remains",
    "PC-04.4D-A": "PC-04.4D explicit Codex part A; audit before changes",
    "PC-04.4A": "PC-04.3A/B/C; explicit backend queue command",
    "PC-04.3C": "PC-04.3A engine and existing PC-04.3B UI; validation only",
    "PC-04.3A": "Owner-selected after PC-04.0/1/2B/2C/2F prerequisites; single-card only",
    "PC-04.2": "PC-04.1 stated complete in owner task; specification only, no stage transition",
    "PC-04": "PC-02.1 · DESIGN-APPROVED",
    "PC-05.2": "PC-05.1B; owner-selected targeted invariant audit only",
    "PC-05.1B": "PC-05.0D/1A; owner-selected calendar lifecycle and start invariant",
    "PC-05.1A": "PC-05.1 frontend; owner-selected existing settings persistence",
    "PC-05.0D": "PC-05.0C; owner-selected calendar fact/plan provenance",
    "PC-05.0C": "PC-05.0A/B; owner-selected read-only production diagnostic foundation",
    "PC-05.0A": "Owner-selected documentation only; no stage transition",
    "PC-05": "PC-03 · PC-04",
    "PC-06": "PC-05",
    "PC-07": "PC-06",
    "PC-08": "PC-06 · PC-07",
    "PC-09": "PC-06 · PC-07",
    "PC-10": "PC-08 · PC-09",
}


def plain(value: str) -> str:
    value = re.sub(r"\[([^]]+)\]\([^)]+\)", r"\1", value)
    value = re.sub(r"[`*]", "", value)
    return html.escape(value.strip())


def read_items() -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    roadmap = ROADMAP.read_text(encoding="utf-8")
    detail = DETAIL.read_text(encoding="utf-8")
    ui_task = UI_TASK.read_text(encoding="utf-8")
    statuses = {code: (mark, title) for mark, code, title in STATUS_LINE.findall(roadmap)}
    expected = {f"PC-{i:02}" for i in range(1, 11)} | {"PC-02.1", "PC-02.1-B1", "PC-03.1", "PC-03.2", "PC-03.3", "PC-03.4A", "PC-03.4D", "PC-03.5A", "PC-03.6A", "PC-03.7A", "PC-03.7B", "PC-03.7B-B1", "PC-04.2", "PC-04.3A", "PC-04.3C", "PC-04.4A", "PC-04.4D", "PC-04.4D-A", "PC-04.4F", "PC-04.4G", "PC-04.4G-A", "PC-04.4I", "PC-04.4M", "PC-04.4O", "PC-04.4Q", "PC-04.4S", "PC-04.4T", "PC-04.4U", "PC-05.0A", "PC-05.0C", "PC-05.0D", "PC-05.1A", "PC-05.1B", "PC-05.2"} | {
        f"PC-UI-{i:02}" for i in range(1, 13)
    }
    if set(statuses) != expected:
        raise ValueError(f"Roadmap codes mismatch: missing={expected-set(statuses)}, extra={set(statuses)-expected}")
    details = {code: (title, body) for code, title, body in DETAIL_LINE.findall(detail)}
    ui_details = {code: (title, body) for code, title, body in UI_LINE.findall(ui_task)}
    if set(details) != {f"PC-{i:02}" for i in range(1, 11)} | {"PC-02.1", "PC-02.1-B1", "PC-03.1", "PC-03.2", "PC-03.3", "PC-03.4A", "PC-03.4D", "PC-03.5A", "PC-03.6A", "PC-03.7A", "PC-03.7B", "PC-03.7B-B1", "PC-04.2", "PC-04.3A", "PC-04.3C", "PC-04.4A", "PC-04.4D", "PC-04.4D-A", "PC-04.4F", "PC-04.4G", "PC-04.4G-A", "PC-04.4I", "PC-04.4M", "PC-04.4O", "PC-04.4Q", "PC-04.4S", "PC-04.4T", "PC-04.4U", "PC-05.0A", "PC-05.0C", "PC-05.0D", "PC-05.1A", "PC-05.1B", "PC-05.2"}:
        raise ValueError("Detailed roadmap must contain PC-01…PC-10, PC-02.1 and B1")
    if set(ui_details) != {f"PC-UI-{i:02}" for i in range(1, 13)}:
        raise ValueError("UI task must contain PC-UI-01…PC-UI-12")
    items = []
    for code in sorted(expected, key=lambda value: (value.startswith("PC-UI"), int(re.search(r"\d+", value).group()), value)):
        mark, status_title = statuses[code]
        title, body = (ui_details if code.startswith("PC-UI") else details)[code]
        status = "done" if mark == "x" else "blocked" if re.search(r"\bblocked\b|\bblocker\b", status_title + body, re.I) else "work" if re.search(r"\bin progress\b|\bв работе\b|READY FOR OWNER REVIEW", status_title, re.I) else "planned"
        acceptance = body.split("**Приёмка:**", 1)[-1] if "**Приёмка:**" in body else body
        task = body.split("**Приёмка:**", 1)[0].split("**Артефакт", 1)[0]
        items.append({"code": code, "title": title.strip(" ."), "task": task.strip(), "acceptance": acceptance.strip(), "status": status, "source": status_title, "dependency": DEPENDENCIES.get(code, "PC-UI-03" if code >= "PC-UI-04" else "Отдельная дизайн-фаза")})
    return [item for item in items if not item["code"].startswith("PC-UI")], [item for item in items if item["code"].startswith("PC-UI")]


def check_erp_twin(items: list[dict[str, str]]) -> None:
    twin = TWIN.read_text(encoding="utf-8")
    for item in items:
        expected = "true" if item["status"] == "done" else "false"
        pattern = rf'"code": "{re.escape(item["code"])}",\s*"done": {expected}\b'
        if re.search(pattern, twin) is None:
            raise ValueError(f'ERP HTML twin mismatch for {item["code"]}')


def card(item: dict[str, str]) -> str:
    code = item["code"]
    status = item["status"]
    label = "Готово к просмотру" if code in {"PC-UI-10", "PC-UI-11"} and status == "work" else {"done": "Завершено", "work": "В работе", "planned": "Запланировано", "blocked": "Заблокировано"}[status]
    source = "../tasks/integrate-production-calendar-v0.1-roadmap.md" if code.startswith("PC-UI") else "production-calendar-v0.1.md"
    if code == "PC-05.2":
        source = "../tasks/pc-05-2-platform-invariant-coverage-audit-codex.md"
    elif code == "PC-05.1B":
        source = "../tasks/pc-05-1b-calendar-plan-lifecycle-audit-and-start-invariant-codex.md"
    elif code == "PC-05.1A":
        source = "../tasks/pc-05-1a-persist-platform-debug-mode-codex.md"
    elif code == "PC-05.0D":
        source = "../tasks/pc-05-0d-calendar-integrity-diagnostic-provenance-codex.md"
    elif code == "PC-05.0C":
        source = "../tasks/pc-05-0c-platform-diagnostics-foundation-codex.md"
    elif code == "PC-05.0A":
        source = "../tasks/pc-05-0a-sl-data-flow-v1-codex.md"
    elif code == "PC-04.4U":
        source = "../tasks/pc-04-4u-route-norms-to-techcard-persistence-cache-audit-codex.md"
    elif code == "PC-04.4T":
        source = "../tasks/pc-04-4t-restore-route-and-assembly-operation-demand-codex.md"
    elif code == "PC-04.4S":
        source = "../tasks/pc-04-4s-rebuild-30-tk-stress-dataset-and-calendar-check-codex.md"
    elif code == "PC-04.4Q":
        source = "../tasks/pc-04-4q-end-to-end-readiness-persistence-fix-codex.md"
    elif code == "PC-04.4O":
        source = "../tasks/pc-04-4o-explicit-demand-rule-codex.md"
    elif code == "PC-04.4M":
        source = "../tasks/pc-04-4m-unified-production-readiness-diagnostics-codex.md"
    elif code == "PC-04.4I":
        source = "../tasks/pc-04-4i-variant-routing-one-of-scheduler-codex.md"
    elif code == "PC-04.4G-A":
        source = "../tasks/pc-04-4g-a-routing-graph-contract-projections.md"
    elif code == "PC-04.4G":
        source = "../tasks/pc-04-4g-unified-routing-graph-kanban-calendar-codex.md"
    elif code == "PC-04.4F":
        source = "../tasks/pc-04-4f-demand-capacity-contract-audit-codex.md"
    elif code in {"PC-04.4D", "PC-04.4D-A"}:
        source = "../tasks/pc-04-4d-work-centers-as-capacity-source.md"
    elif code == "PC-04.4A":
        source = "../tasks/pc-04-4a-production-queue-mass-scheduler-backend-codex.md"
    elif code == "PC-04.3C":
        source = "../tasks/pc-04-3c-scheduler-scenario-validation-codex.md"
    elif code == "PC-04.3A":
        source = "../tasks/pc-04-3a-scheduler-engine-core-codex.md"
    elif code == "PC-04.2":
        source = "../tasks/pc-04-2-demand-calculation-contract.md"
    elif code == "PC-03.7B-B1":
        source = "../tasks/pc-03-7b-b1-tech-operation-edit-modal.md"
    elif code == "PC-03.7B":
        source = "../tasks/pc-03-7b-unified-tech-operation-capacity-ui-cursor.md"
    elif code == "PC-03.7A":
        source = "../tasks/pc-03-7a-tech-operations-capacity-source-codex.md"
    elif code == "PC-03.6A":
        source = "../tasks/pc-03-6a-operation-date-range-codex.md"
    elif code == "PC-03.5A":
        source = "../tasks/pc-03-5a-auto-entry-stage-codex.md"
    elif code == "PC-03.4D":
        source = "../tasks/pc-03-4d-queue-load-indicators-cursor.md"
    elif code == "PC-03.4A":
        source = "../tasks/pc-03-4a-capacity-backend-contract-codex.md"
    elif code == "PC-03.3":
        source = "../tasks/pc-03-3-manual-scheduling-calendar-assignment.md"
    elif code == "PC-03.2":
        source = "../tasks/pc-03-2-production-queue-navigation.md"
    elif code == "PC-03.1":
        source = "../tasks/pc-03-1-lightweight-production-queue-mvp.md"
    elif code == "PC-02.1-B1":
        source = "../tasks/production-calendar-pc-02-1-b1-refresh-model-material-loss.md"
    elif code == "PC-02.1":
        source = "../tasks/production-calendar-pc-02-1-validation.md"
    elif code == "PC-02":
        source = "../architecture/production-calendar-pc-02.md"
    elif code == "PC-01":
        source = "../tasks/production-calendar-pc-01-audit.md"
    return f'''<details class="card" data-status="{status}" id="{html.escape(code)}">
      <summary><span class="code">{html.escape(code)}</span><span class="card-title">{plain(item["title"])}</span><span class="badge {status}">{label}</span><span class="chevron" aria-hidden="true">⌄</span></summary>
      <div class="card-body"><div class="fact"><span>Задача</span><p>{plain(item["task"])}</p></div>
      <div class="fact"><span>Зависимость</span><p>{plain(item["dependency"])}</p></div>
      <div class="fact"><span>Критерий готовности</span><p>{plain(item["acceptance"])}</p></div>
      <div class="check"><span aria-hidden="true">{"☑" if status == "done" else "☐"}</span><span>Статус из Markdown: {label.lower()}</span></div>
      <a href="{source}">Исходный документ ↗</a></div>
    </details>'''


def render() -> str:
    stages, ui = read_items()
    all_items = stages + ui
    check_erp_twin(all_items)
    design_approved = all(item["status"] == "done" for item in ui)
    done = sum(item["status"] == "done" for item in all_items)
    total = len(all_items)
    blocked = sum(item["status"] == "blocked" for item in all_items)
    stage_cards = "\n".join(card(item) for item in stages)
    ui_cards = "\n".join(card(item) for item in ui)
    risk_doc = VALIDATION.read_text(encoding="utf-8")
    risk_section = risk_doc.split("### Риски для HTML roadmap\n", 1)
    if len(risk_section) != 2:
        raise ValueError("PC-02.1 validation must contain HTML risk section")
    risk_lines = re.findall(r"^- \*\*([^*]+)\*\* (.+)$", risk_section[1].split("\n## ", 1)[0], re.M)
    if len(risk_lines) != 5:
        raise ValueError("PC-02.1 validation must contain five roadmap risks")
    risks_html = "".join(f"<li><strong>{plain(label)}</strong> {plain(body)}</li>" for label, body in risk_lines)
    return f'''<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>Production Calendar v0.1 — roadmap</title>
<style>
:root{{--page:#f6f8fc;--surface:#fff;--soft:#f8fafc;--text:#101828;--muted:#667085;--border:#dfe5ef;--blue:#1f5eff;--green:#059669;--amber:#b54708;--red:#d92d20;--radius:12px}}
*{{box-sizing:border-box}}html{{scroll-behavior:smooth}}body{{margin:0;background:var(--page);color:var(--text);font:14px/1.5 Inter,"Segoe UI",Arial,sans-serif}}button{{font:inherit}}a{{color:var(--blue);text-decoration:none}}a:hover{{text-decoration:underline}}a:focus-visible,button:focus-visible,summary:focus-visible{{outline:3px solid #9ab6ff;outline-offset:2px}}.wrap{{max-width:1240px;margin:auto;padding:28px 32px 64px}}.top{{display:flex;justify-content:space-between;gap:20px;align-items:center}}.brand{{font-weight:800;letter-spacing:.12em;color:var(--blue);font-size:12px}}.topnav{{display:flex;gap:16px;flex-wrap:wrap}}h1{{font-size:clamp(27px,3vw,40px);line-height:1.15;letter-spacing:-.03em;margin:24px 0 8px}}h2{{font-size:20px;letter-spacing:-.02em;margin:0 0 6px}}h3{{font-size:15px;margin:0 0 8px}}p{{margin:0}}.intro{{max-width:820px;color:var(--muted);font-size:15px}}.hero{{display:grid;grid-template-columns:1fr 270px;gap:24px;align-items:end;padding:24px 0 28px}}.progressbox,.panel{{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius)}}.progressbox{{padding:18px}}.progressrow{{display:flex;justify-content:space-between;align-items:baseline}}.progressrow strong{{font-size:27px;line-height:1}}.progressrow span{{color:var(--muted)}}progress{{width:100%;height:8px;margin:14px 0 2px;accent-color:var(--blue)}}.progressbox small{{color:var(--muted)}}.metrics{{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px}}.metric{{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:13px 15px}}.metric strong{{display:block;font-size:22px}}.metric span{{color:var(--muted);font-size:12px}}.toolbar{{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 22px}}.filters{{display:flex;gap:7px;flex-wrap:wrap}}.filter{{padding:7px 12px;border:1px solid var(--border);background:var(--surface);color:var(--muted);border-radius:8px;cursor:pointer}}.filter[aria-pressed="true"]{{background:#eaf0ff;border-color:#aabfff;color:#1849a9;font-weight:700}}.count{{color:var(--muted)}}.section{{margin:28px 0}}.section-head{{margin-bottom:14px}}.section-head p{{color:var(--muted)}}.grid{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}}.card{{min-width:0;background:var(--surface);border:1px solid var(--border);border-radius:10px;align-self:start}}.card[hidden]{{display:none}}.card summary{{list-style:none;display:flex;align-items:center;gap:10px;cursor:pointer;padding:14px 15px;min-height:60px}}.card summary::-webkit-details-marker{{display:none}}.code{{font-size:12px;color:var(--blue);font-weight:800;white-space:nowrap}}.card-title{{font-weight:650;flex:1;min-width:0}}.badge{{font-size:11px;font-weight:700;border-radius:6px;padding:3px 7px;white-space:nowrap}}.badge.done{{color:#027a48;background:#ecfdf3}}.badge.work{{color:#1849a9;background:#eff4ff}}.badge.planned{{color:#475467;background:#f2f4f7}}.badge.blocked{{color:#b42318;background:#fef3f2}}.chevron{{color:var(--muted);font-size:20px;line-height:1;transition:transform .15s}}details[open] .chevron{{transform:rotate(180deg)}}.card-body{{border-top:1px solid var(--border);padding:14px 16px 17px;display:grid;gap:11px}}.fact>span{{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}}.fact p{{overflow-wrap:anywhere}}.check{{display:flex;gap:8px;color:var(--muted);font-size:12px}}.check>span:first-child{{font-size:17px;color:var(--blue);line-height:1}}.panel{{padding:20px;margin-top:16px}}.panel p,.panel li{{color:#475467}}.panel ul{{margin:8px 0 0;padding-left:20px}}.panel li+li{{margin-top:6px}}.gate{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}.gate>div{{background:var(--soft);border:1px solid var(--border);border-radius:9px;padding:14px}}.gate span{{display:block;color:var(--muted);font-size:12px}}.gate strong{{display:block;margin:4px 0}}.sources{{display:flex;gap:10px 18px;flex-wrap:wrap;margin-top:12px}}.sources a{{white-space:nowrap}}.foot{{color:var(--muted);font-size:12px;margin-top:28px;border-top:1px solid var(--border);padding-top:16px}}.empty{{color:var(--muted);padding:12px 0}}
@media(max-width:1023px){{.wrap{{padding:22px 24px 48px}}.hero{{grid-template-columns:1fr 240px}}}}@media(max-width:767px){{.wrap{{padding:18px 16px 40px}}.top,.toolbar{{align-items:flex-start;flex-direction:column}}.hero{{grid-template-columns:1fr;gap:18px}}.metrics{{grid-template-columns:repeat(2,1fr)}}.grid,.gate{{grid-template-columns:1fr}}.card summary{{min-height:56px}}.topnav{{gap:8px 14px}}}}@media(max-width:380px){{.card summary{{flex-wrap:wrap}}.card-title{{flex-basis:calc(100% - 75px)}}.badge{{margin-left:auto}}}}
</style></head><body><main class="wrap">
<header class="top"><div class="brand">SPORT UNIFORM / SL-UI-BASE-v1</div><nav class="topnav" aria-label="Разделы"><a href="#stages">Этапы</a><a href="#ui">PC-UI</a><a href="#questions">Вопросы и риски</a></nav></header>
<div class="hero"><div><h1>Production Calendar <span style="color:var(--blue)">v0.1</span></h1><p class="intro">Автономный производственный календарь · ручное планирование. Статусы этапов и дизайна ниже синхронизированы с Markdown; PC-03.1 — рабочая очередь; PC-03.2 — навигация; PC-03.3 — ручное планирование; PC-03.4A — backend мощностей; PC-03.4D — индикация очереди; PC-03.5A — автоматический вход; остальные этапы открыты.</p></div><div class="progressbox" aria-label="Общий прогресс"><div class="progressrow"><strong>{done}/{total}</strong><span>выполнено</span></div><progress value="{done}" max="{total}"></progress><small>{round(done/total*100)}% микротасков · данные из roadmap-v1.1.md</small></div></div>
<div class="metrics"><div class="metric"><strong>10</strong><span>этапов PC-01–PC-10</span></div><div class="metric"><strong>12</strong><span>микротасков PC-UI</span></div><div class="metric"><strong>20</strong><span>PC-02.1, P1 B1, PC-03.1…3, PC-03.4A/D, PC-03.5A/6A/7A, PC-03.7B-B1, PC-04.2 spec, PC-04.3A/C, PC-04.4A, PC-04.4D/A, PC-04.4F audit, PC-04.4G/A</span></div><div class="metric"><strong>{blocked}</strong><span>заблокировано</span></div></div>
<div class="toolbar"><div class="filters" role="group" aria-label="Фильтр по статусу"><button class="filter" data-filter="all" aria-pressed="true">Все</button><button class="filter" data-filter="done" aria-pressed="false">Завершено</button><button class="filter" data-filter="work" aria-pressed="false">В работе</button><button class="filter" data-filter="planned" aria-pressed="false">Запланировано</button><button class="filter" data-filter="blocked" aria-pressed="false">Заблокировано</button></div><span class="count" id="visible-count" aria-live="polite">Показано {total} из {total}</span></div>
<section class="section" id="stages"><div class="section-head"><h2>Этапы продукта</h2><p>Разверните карточку, чтобы увидеть задачу, зависимость и критерий готовности.</p></div><div class="grid">{stage_cards}</div><p class="empty" hidden>В этом разделе задач с выбранным статусом нет.</p></section>
<section class="section" id="ui"><div class="section-head"><h2>Проектирование интерфейсов · PC-UI</h2><p>Отдельная дизайн-фаза: спецификации восьми экранов UI-A…UI-H. Реализация приложения не начата.</p></div><div class="grid">{ui_cards}</div><p class="empty" hidden>В этом разделе задач с выбранным статусом нет.</p></section>
<section class="panel" aria-labelledby="gate-title"><h2 id="gate-title">Контрольные точки дизайна</h2><div class="gate"><div><span>PC-UI-04…11</span><strong>Утверждение каждого экрана</strong><p>Концепт → спецификация → просмотр владельцем → правки → утверждение. Состояние каждого экрана показано выше по Markdown.</p></div><div><span>PC-UI-12 · DESIGN-APPROVED</span><strong>{"Утверждено владельцем" if design_approved else "Не утверждено"}</strong><p>{"UI-A–UI-H OWNER-APPROVED; DESIGN-APPROVED = true. Документационный freeze не подтверждает реализацию или исправление P1." if design_approved else "Требуется явное решение владельца по всем экранам и состояниям до реализации."}</p></div></div></section>
<section class="panel" id="questions"><h2>Открытые вопросы и риски</h2><ul>{risks_html}</ul><div class="sources"><a href="../tasks/production-calendar-pc-02-1-validation.md">Проверка PC-02.1 ↗</a><a href="../tasks/production-calendar-pc-02-1-b1-refresh-model-material-loss.md">P1 B1 ↗</a><a href="../architecture/production-calendar-pc-02.md">Архитектура PC-02 ↗</a></div></section>
<section class="panel"><h2>Источники и повторная генерация</h2><p>Статусы берутся из Markdown, изменения в этой странице не сохраняются. После правки Markdown синхронизируйте ERP HTML-близнец и запустите <code>python scripts/generate_production_calendar_roadmap.py</code>; для сверки используйте <code>--check</code>.</p><div class="sources"><a href="production-calendar-v0.1.md">Детальный roadmap ↗</a><a href="roadmap-v1.1.md">Статусы этапов ↗</a><a href="../tasks/integrate-production-calendar-v0.1-roadmap.md">PC-UI задачи ↗</a><a href="../tasks/production-calendar-pc-01-audit.md">Аудит PC-01 ↗</a><a href="../architecture/production-calendar-pc-02.md">PC-02 ↗</a></div></section>
<footer class="foot">Статический локальный документ · Источник истины: Markdown · Генерация: scripts/generate_production_calendar_roadmap.py</footer></main>
<script>
const buttons=[...document.querySelectorAll('.filter')];const cards=[...document.querySelectorAll('.card')];
function applyFilter(status){{let visible=0;for(const card of cards){{card.hidden=status!=='all'&&card.dataset.status!==status;if(!card.hidden)visible++}}for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.filter===status));document.getElementById('visible-count').textContent=`Показано ${{visible}} из {total}`;for(const section of document.querySelectorAll('.section'))section.querySelector('.empty').hidden=[...section.querySelectorAll('.card')].some(card=>!card.hidden)}}
for(const button of buttons)button.addEventListener('click',()=>applyFilter(button.dataset.filter));
</script></body></html>
'''


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if HTML differs from Markdown generation")
    args = parser.parse_args()
    generated = render()
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != generated:
            raise SystemExit("HTML roadmap differs from Markdown; rerun generator")
        for target in re.findall(r'href="([^"]+)"', generated):
            if target.startswith("#"):
                if f'id="{target[1:]}"' not in generated:
                    raise SystemExit(f"Missing local anchor: {target}")
            elif not (OUTPUT.parent / target).resolve().is_file():
                raise SystemExit(f"Missing linked document: {target}")
        items, ui_items = read_items()
        expected_cards = len(items) + len(ui_items)
        if generated.count('<details class="card"') != expected_cards:
            raise SystemExit(f"Expected {expected_cards} roadmap cards")
        print(f"OK: {OUTPUT.relative_to(ROOT)} matches Markdown")
    else:
        OUTPUT.write_text(generated, encoding="utf-8", newline="\n")
        print(f"Generated {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
