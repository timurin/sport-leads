"""Generate the offline SL-DATA-FLOW-v1 HTML twin from its canonical Markdown."""
from __future__ import annotations

import argparse
import hashlib
import html
import os
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/architecture/SL-DATA-FLOW-v1.md"
OUTPUT = ROOT / "docs/erp/status/SL-DATA-FLOW-v1.html"
EXPECTED = {
    "DF-TK-CLIENT",
    "DF-MODEL-ROUTE", "DF-MODEL-ASSEMBLY", "DF-ROUTE-SNAPSHOT",
    "DF-TK-OPERATION-VOLUME", "DF-ONE-OF", "DF-SEWING-DEMAND",
    "DF-PRINT-DEMAND", "DF-CUTTING-DEMAND", "DF-DEMAND-CAPACITY",
    "DF-WORKCENTER", "DF-SCHEDULER-CALENDAR", "DF-KANBAN-FACT", "DF-DIAGNOSTICS",
}


def inline(value: str) -> str:
    # Tokenize code and links before escaping; Markdown is trusted repo content,
    # but raw text/attributes are always escaped in the generated document.
    pattern = r"(`[^`]+`|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)"
    result = []
    for token in re.split(pattern, value):
        if token.startswith("`"):
            result.append("<code>" + html.escape(token[1:-1]) + "</code>")
        elif token.startswith("[") and (match := re.fullmatch(r"\[([^]]+)\]\(([^)]+)\)", token)):
            label, target = match.groups()
            if not target.startswith("#"):
                resolved = (SOURCE.parent / target).resolve()
                resolved.relative_to(ROOT)
                if not resolved.exists() and resolved != OUTPUT:
                    raise ValueError(f"Missing source link: {target}")
                # Both documents are two directories below root. Architecture
                # relative paths must still resolve when opened from status/.
                target = Path(os.path.relpath(resolved, OUTPUT.parent)).as_posix()
            result.append(f'<a href="{html.escape(target, quote=True)}">{html.escape(label)}</a>')
        elif token.startswith("**"):
            result.append("<strong>" + html.escape(token[2:-2]) + "</strong>")
        else:
            result.append(html.escape(token))
    return "".join(result)


def render(markdown: str) -> str:
    ids = re.findall(r"^## (DF-[A-Z-]+)$", markdown, re.M)
    if set(ids) != EXPECTED or len(ids) != len(EXPECTED):
        raise ValueError(f"Expected exactly the {len(EXPECTED)} canonical flow sections")
    navigation = ''.join(f'<a href="#{key.lower()}">{key}</a>' for key in ids)
    blocks = []
    chain_open = False
    table_open = False
    table_header = False
    for line in markdown.splitlines():
        if not line.startswith("|") and table_open:
            blocks.append("</tbody></table></div>")
            table_open = False
        if line.startswith("## "):
            if chain_open:
                blocks.append("</div></details>")
                chain_open = False
            title = line[3:]
            if title in EXPECTED:
                blocks.append(f'<details class="chain" id="{title.lower()}" open><summary>{title}</summary><div class="content">')
                chain_open = True
            else:
                blocks.append(f'<h2>{html.escape(title)}</h2>')
        elif line.startswith("# "):
            blocks.append('<h1>' + inline(line[2:]) + '</h1>')
        elif line.startswith("|"):
            cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
            if all(re.fullmatch(r":?-+:?", cell) for cell in cells):
                continue
            if not table_open:
                blocks.append('<div class="table-wrap"><table><tbody>')
                table_open = True
                table_header = True
            tag = "th" if table_header else "td"
            blocks.append('<tr>' + ''.join(f'<{tag}>{inline(cell)}</{tag}>' for cell in cells) + '</tr>')
            table_header = False
        elif line.startswith("**Flow:** "):
            steps = line.removeprefix("**Flow:** ").split(" → ")
            blocks.append('<div class="flow" aria-label="Поток данных">' + '<span class="arrow" aria-hidden="true">→</span>'.join(
                f'<div class="node">{inline(step)}</div>' for step in steps) + '</div>')
        elif line.strip():
            blocks.append('<p>' + inline(line) + '</p>')
    if table_open:
        blocks.append("</tbody></table></div>")
    if chain_open:
        blocks.append("</div></details>")
    digest = hashlib.sha256(markdown.encode()).hexdigest()
    return TEMPLATE.replace("{{HASH}}", digest).replace("{{NAV}}", navigation).replace("{{CONTENT}}", '\n'.join(blocks))


TEMPLATE = '''<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="source-sha256" content="{{HASH}}"><title>SL-DATA-FLOW-v1 — карта данных</title>
<style>
:root{font:16px/1.6 system-ui,sans-serif;color:#18283b;background:#f3f6fa}*{box-sizing:border-box}body{margin:0}
header{padding:20px 24px;background:#142f4c;color:white}header p{margin:0}a{color:#185bb3}header a{color:#c2e0ff}
.layout{display:grid;grid-template-columns:270px minmax(0,1fr);max-width:1600px;margin:auto}aside{padding:20px;position:sticky;top:0;align-self:start;max-height:100vh;overflow:auto}
nav a{display:block;padding:6px 8px;font-size:13px;overflow-wrap:anywhere;border-radius:6px}nav a:hover{background:#dde8f6}
label{display:block;font-weight:650}input{width:100%;padding:10px;border:1px solid #9aaec5;border-radius:6px;margin:8px 0}button{padding:7px 10px;border:1px solid #9aaec5;background:white;border-radius:6px;cursor:pointer;margin:3px 0}
main{padding:20px 26px;min-width:0;background:white}h1{font-size:30px}h2{margin-top:30px}p{overflow-wrap:anywhere}code{background:#edf1f6;border-radius:4px;padding:1px 4px;font-size:.9em}
.chain{margin:18px 0;border:1px solid #c1d0e1;border-radius:10px;scroll-margin-top:15px}.chain summary{padding:14px 18px;background:#e8f0fa;font-weight:750;cursor:pointer;border-radius:10px}.content{padding:2px 18px 14px}
.flow{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin:18px 0}.node{flex:1;min-width:150px;padding:14px;background:#e0f1ef;border-left:4px solid #1b847d;border-radius:7px}.node:nth-of-type(2n){background:#eee8fb;border-color:#7659b5}.arrow{font-size:22px;color:#54728f}
.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;vertical-align:top;border:1px solid #ced9e6;padding:9px}th{background:#e8f0fa}tr:nth-child(even){background:#f8fafc}[hidden]{display:none!important}.status{font-size:13px;color:#476078}
@media(max-width:850px){.layout{grid-template-columns:1fr}aside{position:static;max-height:none}nav{display:flex;flex-wrap:wrap;gap:5px}main{padding:12px}header{padding:16px}}
@media print{aside,header{display:none}.layout{display:block}main{padding:0}.chain{break-inside:avoid}a{color:inherit}}
</style></head><body><header><strong>Sport-Lead · Canonical Data Flow</strong><p>Источник: <a href="../../architecture/SL-DATA-FLOW-v1.md">SL-DATA-FLOW-v1.md</a> · Offline HTML twin · PC-05.0A</p></header>
<div class="layout"><aside><label for="search">Поиск по ID / сущности</label><input id="search" type="search" placeholder="volume, WorkCenter, DF-ONE-OF…"><p id="count" class="status" aria-live="polite"></p><button id="expand">Раскрыть все</button> <button id="collapse">Свернуть все</button><nav aria-label="Индекс цепочек">{{NAV}}</nav></aside><main>{{CONTENT}}</main></div>
<script>
const sections=[...document.querySelectorAll('.chain')];const search=document.querySelector('#search');const count=document.querySelector('#count');
function filter(){const q=search.value.trim().toLocaleLowerCase('ru');let visible=0;for(const s of sections){s.hidden=!s.textContent.toLocaleLowerCase('ru').includes(q);if(!s.hidden){visible++;if(q)s.open=true;}document.querySelector('nav a[href="#'+s.id+'"]').hidden=s.hidden;}count.textContent=visible+' / '+sections.length+' цепочек';}
search.addEventListener('input',filter);document.querySelector('#expand').onclick=()=>sections.forEach(s=>{if(!s.hidden)s.open=true});document.querySelector('#collapse').onclick=()=>sections.forEach(s=>s.open=false);
function navigate(){const s=document.getElementById(location.hash.slice(1));if(s?.classList.contains('chain')){search.value='';filter();s.open=true;s.scrollIntoView();}}
window.addEventListener('hashchange',navigate);filter();navigate();
</script></body></html>
'''


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    generated = render(SOURCE.read_text(encoding="utf-8"))
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != generated:
            raise SystemExit("HTML twin differs from canonical Markdown; regenerate")
        print(f"HTML twin synced: {len(EXPECTED)} flows, validated local source links")
    else:
        OUTPUT.write_text(generated, encoding="utf-8")
        print(f"Generated {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
