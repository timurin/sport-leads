"""Generate and verify the offline invariant-coverage twin from canonical Markdown."""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import html
from pathlib import Path
import re

from generate_data_flow import inline as shared_inline

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/architecture/SL-INVARIANT-COVERAGE-v1.md"
OUTPUT = ROOT / "docs/erp/status/SL-INVARIANT-COVERAGE-v1.html"
MODULES = {"DF-ROUTE-SNAPSHOT", "DF-TK-OPERATION-VOLUME", "DF-ONE-OF", "DF-SEWING-DEMAND",
           "DF-PRINT-DEMAND", "DF-CUTTING-DEMAND", "DF-DEMAND-CAPACITY", "DF-WORKCENTER",
           "DF-SCHEDULER-CALENDAR", "DF-DIAGNOSTICS"}
HEADERS = ["Invariant", "Current guard", "Diagnostic", "Can invalid state still be created?", "Risk", "Recommended guard"]


def inline(value: str) -> str:
    """Reuse the status renderer, adding file fragments and offline DF links."""
    output = []
    for token in re.split(r"(\[[^\]]+\]\([^)]+\))", value):
        match = re.fullmatch(r"\[([^]]+)\]\(([^)]+)\)", token)
        if match and "#" in match.group(2) and not match.group(2).startswith("#"):
            label, target = match.groups()
            path, fragment = target.split("#", 1)
            rendered = shared_inline(f"[{label}]({path})")
            if path == "SL-DATA-FLOW-v1.md":
                if fragment not in {module.lower() for module in MODULES}:
                    raise ValueError(f"Unknown selected DF anchor: {fragment}")
                rendered = re.sub(r'href="[^"]+"', 'href="SL-DATA-FLOW-v1.html"', rendered, count=1)
            rendered = re.sub(r'href="([^"]+)"', lambda m: f'href="{m.group(1)}#{html.escape(fragment, quote=True)}"', rendered, count=1)
            output.append(rendered)
        else:
            output.append(shared_inline(token))
    return ''.join(output)


def render(markdown: str) -> tuple[str, int]:
    sections = re.findall(r"^## (DF-[A-Z-]+)$", markdown, re.M)
    if len(sections) != len(MODULES) or set(sections) != MODULES:
        raise ValueError("Expected exactly the ten selected DF sections")
    counts: Counter[str] = Counter()
    by_module: dict[str, Counter[str]] = defaultdict(Counter)
    identifiers = set()
    blocks = []
    module = ""
    table = False
    headers = []
    module_open = False
    for line in markdown.splitlines():
        if not line.startswith("|") and table:
            blocks.append("</tbody></table></div>")
            table = False
        if line.startswith("## "):
            if module_open:
                blocks.append("</section>")
                module_open = False
            title = line[3:]
            module = title if title in MODULES else ""
            if module:
                blocks.append(f'<section class="module" data-module="{module}" id="{module.lower()}">')
                module_open = True
            anchor = module.lower() if module else ("backlog" if title == "Приоритетный backlog" else "")
            blocks.append(f'<h2 id="{anchor + "-title"}">{html.escape(title)}</h2>')
        elif line.startswith("# "):
            blocks.append(f'<h1>{html.escape(line[2:])}</h1>')
        elif line.startswith("|"):
            cells = [part.strip() for part in line.strip().strip("|").split("|")]
            if all(re.fullmatch(r":?-+:?", cell) for cell in cells):
                continue
            if not table:
                headers = cells
                if module and headers != HEADERS:
                    raise ValueError(f"Invalid invariant matrix headers in {module}")
                blocks.append('<div class="table-wrap"><table class="coverage-table"><thead><tr>' +
                              ''.join(f'<th scope="col">{inline(cell)}</th>' for cell in headers) + '</tr></thead><tbody>')
                table = True
                continue
            if len(cells) != len(headers):
                raise ValueError(f"Wrong column count: {line}")
            attributes = ""
            if module:
                identifier = re.match(r"IC-[A-Z]+-\d{2}\b", cells[0])
                if identifier is None or identifier.group() in identifiers or cells[4] not in {"P0", "P1", "P2", "P3"}:
                    raise ValueError(f"Invalid/duplicate invariant ID or risk: {line}")
                if not re.match(r"\[(WRITE|PARTIAL|READ|OBSERVE)\]", cells[1]):
                    raise ValueError("Every current guard must identify its coverage layer")
                identifiers.add(identifier.group())
                counts[cells[4]] += 1
                by_module[module][cells[4]] += 1
                attributes = f' data-risk="{cells[4]}" data-invariant="{identifier.group()}"'
            blocks.append(f'<tr{attributes}>' + ''.join(
                f'<td data-label="{html.escape(label, quote=True)}"><span class="cell-value">{inline(cell)}</span></td>'
                for label, cell in zip(headers, cells)) + '</tr>')
        elif line.strip():
            blocks.append(f'<p>{inline(line)}</p>')
    if table:
        blocks.append("</tbody></table></div>")
    if module_open:
        blocks.append("</section>")
    if set(by_module) != MODULES:
        raise ValueError("Every selected DF module needs invariant rows")
    summary = ''.join(f'<button type="button" class="counter {risk}" data-priority="{risk}"><strong>{counts[risk]}</strong>{risk}</button>'
                      for risk in ("P0", "P1", "P2", "P3"))
    matrix = '<div class="table-wrap"><table id="module-matrix"><thead><tr><th>Модуль / DF</th><th>P0</th><th>P1</th><th>P2</th><th>P3</th><th>Всего</th></tr></thead><tbody>'
    for key in sections:
        counter = by_module[key]
        matrix += f'<tr><th><button type="button" data-module-filter="{key}">{key}</button></th>' + ''.join(
            f'<td>{counter[risk]}</td>' for risk in ("P0", "P1", "P2", "P3")) + f'<td>{counter.total()}</td></tr>'
    matrix += '</tbody></table></div>'
    options = ''.join(f'<option value="{key}">{key}</option>' for key in sections)
    document = TEMPLATE.replace("{{HASH}}", hashlib.sha256(markdown.encode()).hexdigest()).replace("{{TOTAL}}", str(len(identifiers)))
    document = document.replace("{{COUNTERS}}", summary).replace("{{MATRIX}}", matrix).replace("{{OPTIONS}}", options)
    return document.replace("{{CONTENT}}", '\n'.join(blocks)), len(identifiers)


TEMPLATE = '''<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="source-sha256" content="{{HASH}}"><title>SL-INVARIANT-COVERAGE-v1 — аудит инвариантов</title>
<style>
:root{font:15px/1.6 system-ui,sans-serif;color:#18283b;background:#f3f6fa}*{box-sizing:border-box}body{margin:0}a{color:#185bb3}
header{background:#142f4c;color:white;padding:22px max(18px,calc((100vw - 1500px)/2));overflow-wrap:anywhere}header a{color:#c2e0ff}header p{margin:5px 0}
main{max-width:1500px;margin:auto;padding:22px;background:white}h1{font-size:28px}h2{margin-top:32px;font-size:21px;overflow-wrap:anywhere}p,td,th{overflow-wrap:anywhere}
button,input,select{font:inherit}button{cursor:pointer;background:white;color:#18283b;border:1px solid #b9c9dc;border-radius:7px;padding:7px 12px}button:hover{background:#eef3fa}
button[aria-pressed=true]{outline:3px solid #376da9;outline-offset:2px}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #376da9}
.counters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0}.counter{text-align:left;display:flex;align-items:center;gap:12px;padding:16px}.counter strong{font-size:30px}.P0{background:#fff0f0;border-color:#c24747}.P1{background:#fff5e7;border-color:#c58325}.P2{background:#eaf3ff;border-color:#3978bc}.P3{background:#f2f4f7;border-color:#8897aa}
.controls{display:flex;flex-wrap:wrap;align-items:end;gap:14px;background:#f3f6fa;padding:16px;border:1px solid #d2deeb;border-radius:9px}label{font-weight:650}input,select{display:block;max-width:100%;border:1px solid #a9bed5;border-radius:6px;padding:9px;background:white}input{width:330px}select{width:300px}
.status{color:#486078}code{background:#edf1f6;padding:1px 4px;border-radius:4px;font-size:.9em}.table-wrap{overflow:auto;max-width:100%;margin:16px 0}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;vertical-align:top;border:1px solid #d0dbe7;padding:10px}thead{background:#e8f0fa}tbody tr:nth-child(even){background:#f8fafc}.coverage-table th:first-child{width:17%}.coverage-table td:nth-child(5){font-weight:750;white-space:nowrap}.module{border-top:2px solid #d7e3ef;margin-top:30px;scroll-margin-top:16px}[hidden]{display:none!important}
@media(max-width:760px){main{padding:14px}h1{font-size:23px}.counters{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.counter{padding:10px}.counter strong{font-size:25px}.controls{padding:12px;display:block}.controls label{display:block;margin-bottom:10px}input,select{width:100%}#module-matrix{min-width:560px}.coverage-table,.coverage-table tbody,.coverage-table tr,.coverage-table td{display:block}.coverage-table thead{display:none}.coverage-table tr{border:1px solid #c9d6e5;border-radius:8px;margin:14px 0;padding:8px}.coverage-table td{display:grid;grid-template-columns:105px minmax(0,1fr);gap:8px;border:0;padding:6px}.coverage-table td::before{content:attr(data-label);font-weight:700;color:#465d78}.coverage-table td:nth-child(5){white-space:normal}}
@media print{.controls,.counters{display:none}header{background:white;color:#18283b}header a{color:inherit}main{max-width:none;padding:0}table{font-size:10px}.module{break-before:auto}}
</style></head><body><header><strong>Sport-Lead · Platform Invariant Coverage Audit</strong><p>PC-05.2 · 2026-10-11 · READY FOR OWNER REVIEW</p><p>Источник: <a href="../../architecture/SL-INVARIANT-COVERAGE-v1.md">Markdown</a> · <a href="SL-DATA-FLOW-v1.html">Data Flow</a> · <a href="#backlog-title">Рекомендуемые следующие задачи</a></p></header>
<main><h1>Критичные инварианты: защита и разрывы</h1><p>{{TOTAL}} строк / 10 модулей. Счётчики — приоритеты строк матрицы, не количество живых diagnostics. P3 включает защищённые инварианты; P0/P1 findings не исправлены этим аудитом.</p>
<div class="counters" aria-label="Приоритеты">{{COUNTERS}}</div>
<div class="controls"><label>Поиск<input id="search" type="search" placeholder="IC-SC-04, norm, assignment…"></label><label>Модуль<select id="module"><option value="all">Все модули</option>{{OPTIONS}}</select></label><button id="reset" type="button">Все приоритеты / сброс</button></div><p id="visible-count" class="status" aria-live="polite"></p>
<h2>Матрица по модулям</h2>{{MATRIX}}
{{CONTENT}}</main><script>
const rows=[...document.querySelectorAll('tr[data-invariant]')];const sections=[...document.querySelectorAll('.module')];const search=document.querySelector('#search');const moduleSelect=document.querySelector('#module');const count=document.querySelector('#visible-count');let priority='all';
function filter(){const q=search.value.trim().toLocaleLowerCase('ru');let visible=0;for(const row of rows){const m=row.closest('.module').dataset.module;row.hidden=!((priority==='all'||row.dataset.risk===priority)&&(moduleSelect.value==='all'||moduleSelect.value===m)&&row.textContent.toLocaleLowerCase('ru').includes(q));if(!row.hidden)visible++;}for(const section of sections)section.hidden=![...section.querySelectorAll('tr[data-invariant]')].some(r=>!r.hidden);for(const button of document.querySelectorAll('[data-priority]'))button.setAttribute('aria-pressed',String(button.dataset.priority===priority));count.textContent='Показано '+visible+' / '+rows.length+' инвариантов'+(priority==='all'?'':' · '+priority);}
for(const button of document.querySelectorAll('[data-priority]'))button.addEventListener('click',()=>{priority=priority===button.dataset.priority?'all':button.dataset.priority;filter();});
for(const button of document.querySelectorAll('[data-module-filter]'))button.addEventListener('click',()=>{moduleSelect.value=button.dataset.moduleFilter;filter();});
search.addEventListener('input',filter);moduleSelect.addEventListener('change',filter);document.querySelector('#reset').addEventListener('click',()=>{priority='all';search.value='';moduleSelect.value='all';filter();});filter();
</script></body></html>
'''


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    document, count = render(SOURCE.read_text(encoding="utf-8"))
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != document:
            raise SystemExit("Invariant coverage HTML differs from canonical Markdown; regenerate")
        print(f"HTML twin synced: {count} invariants / 10 modules; source links validated")
    else:
        OUTPUT.write_text(document, encoding="utf-8")
        print(f"Generated {OUTPUT.relative_to(ROOT)}: {count} invariants")


if __name__ == "__main__":
    main()
