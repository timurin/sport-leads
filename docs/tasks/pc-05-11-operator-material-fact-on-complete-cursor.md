# PC-05.11 — Operator Material Fact on Complete

## Исполнитель
Cursor

## Источник
PC-05.10 E2E.

## Приоритет
P1

## Проблема
Операторский flow ломается на завершении участка `Печать`.

Сейчас:
`Ожидает -> Принять в работу -> В работе -> Завершить -> ERROR`

Backend `complete_stage` корректно блокирует завершение, если для материалов участка не заполнен `fact_qty`.

На ТК план материалов есть, но:
- факт расхода пустой;
- менеджеру поле read-only;
- в Kanban/операторском flow нет места, где оператор может ввести факт.

Поэтому материал gate нельзя убирать — нужно дать оператору понятный шаг ввода факта перед завершением.

## Цель
Сделать простой операторский flow:

`Завершить`
→ если backend требует material fact
→ modal `Фактический расход материалов`
→ плановые значения предзаполнены
→ оператор подтверждает/корректирует
→ `Сохранить и завершить`
→ backend сохраняет факт
→ stage complete
→ переход к следующему workshop

## Context
Использовать:
- `SL-PROJECT-MEMORY-v1`
- `SL-UI-CONTEXT-v1`
- targeted Kanban/TechnicalCard/material fact actions only

Без repo-wide scan.

## 1. Trigger
При нажатии `Завершить`:

### Case A
Если backend завершает этап сразу:
- сохранить существующее поведение.

### Case B
Если backend отвечает material-fact gate error:
- не показывать raw English error;
- открыть modal `Фактический расход материалов`.

Использовать существующий backend error/code/contract.

Не определять необходимость modal сложной frontend business-логикой, если backend уже сообщает gate condition.

## 2. Modal

Title:
`Фактический расход материалов`

Message:
`Проверьте фактический расход материалов перед завершением операции.`

Для каждого требуемого материала показать:
- материал;
- единицу;
- план;
- факт;
- input для факта.

Предзаполнение:
- если `fact_qty` уже есть — использовать его;
- иначе предзаполнить плановым количеством как convenience value;
- оператор должен иметь возможность изменить значение.

Не сохранять автоматически без подтверждения.

## 3. Actions

Buttons:
- `Отмена`
- `Сохранить`
- `Сохранить и завершить`

### Сохранить
Сохраняет fact_qty, stage остаётся in_progress.

### Сохранить и завершить
1. сохранить fact_qty;
2. дождаться успешного backend response;
3. повторно вызвать canonical complete;
4. после success обновить Kanban/Queue/TechnicalCard.

Никаких optimistic fact transitions.

## 4. Validation
Для каждого fact_qty:
- required;
- >= 0;
- decimal semantics по backend contract;
- unit read-only;
- no silent unit conversion.

Если backend возвращает validation error:
- показать manager-friendly текст рядом с полем.

## 5. Scope
Проверить минимум участки/операции, где material gate реально применяется:
- Печать;
- Раскрой;
- другие только если используют тот же canonical material fact contract.

Не придумывать новые gate rules.

## 6. Manager vs operator
Manager-facing TechnicalCard material plan остаётся read-only, если такова текущая модель прав.

Операторский fact input появляется только в рабочем flow завершения операции.

Использовать existing permission model.

## 7. Error mapping
Raw backend:
`MATERIAL fact_qty required ...`

не показывать пользователю как основной текст.

Manager-facing:
`Укажите фактический расход материалов перед завершением операции.`

Technical details/code остаются в Debug Mode.

## 8. After complete
После успешного `Сохранить и завершить` проверить:
- stage completed;
- `completed_at` записан;
- current_workshop продвинулся;
- Kanban переместился после server response;
- Queue текущего участка больше не содержит ТК;
- Queue следующего участка содержит ТК, если ready;
- Calendar plan не повреждён;
- personalization не изменилась.

## 9. E2E continuation
Использовать текущую:
`E2E-PROD-001-1`

На участке Печать:
1. открыть Kanban;
2. `Завершить`;
3. modal должен открыться;
4. проверить плановые значения;
5. сохранить fact_qty;
6. `Сохранить и завершить`;
7. подтвердить переход дальше.

Если после этого следующий участок тоже требует material fact — повторить тот же flow.

Не доводить всю ТК до конца в этой задаче, если появится отдельный новый blocker. Зафиксировать его.

## 10. Tests
Минимум:
- complete without material requirement -> direct success;
- gate error -> modal opens;
- planned values prefilled;
- edit fact_qty;
- save only;
- save + complete;
- invalid fact rejected;
- backend error handled;
- stage state changes only after success;
- permissions respected;
- raw English gate error hidden from user.

Full:
- frontend targeted tests;
- eslint;
- tsc;
- production build;
- project check;
- git diff --check.

## Не делать
- убирать backend material gate;
- менять Material/Demand semantics;
- Forecast fix;
- Calendar status fix;
- Kanban architecture refactor;
- commit/push.

## Acceptance
Готово, если оператор может завершить операцию с обязательным material fact без выхода из рабочего flow Kanban.

Финальная строка:
`PC-05.11 OPERATOR MATERIAL FACT COMPLETE FLOW READY`
