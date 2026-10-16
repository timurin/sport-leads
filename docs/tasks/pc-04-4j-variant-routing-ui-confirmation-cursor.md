# PC-04.4J — Variant Routing UI + Preliminary/Confirmed Selection

## Исполнитель
Cursor

## Зависимость
Начинать после завершения:
`PC-04.4I — Variant Routing ONE OF`

Не создавать frontend shadow semantics до готового backend contract.

## Контекст
Routing Editor уже визуальный:
- parent blocks = Workshops
- child blocks = TechOperation
- DnD
- sequential
- explicit parallel
- snapshot warning

Backend после PC-04.4I поддерживает ONE OF Variant Groups.

Пример:
Цех `Раскрой`
`Способ раскроя`
- Ручной раскрой
- Раскрой настилом [по умолчанию]
- Раскрой лазером

Для конкретной ТК выбирается один вариант:
- сначала preliminary
- затем confirmed

Scheduler использует preliminary choice для предварительной очереди и ETA.

## 1. Routing Editor — новый блок Variant Group
Добавить действие в Workshop:
`+ Группа вариантов`

или через `+ Операция`:
- Добавить операцию
- Добавить группу вариантов

## 2. Визуальный вид
Variant Group должна визуально отличаться от parallel branch.

Пример:

Способ раскроя
Выполняется один вариант

○ Ручной раскрой
● Раскрой настилом  По умолчанию
○ Раскрой лазером

Не использовать графику parallel branch для ONE OF.

## 3. Создание группы
Modal:
`Новая группа вариантов`

Поля:
- Название *
- Код optional
- Цех = текущий
- Варианты

Добавить member:
- выбрать существующую TechOperation
- создать новую TechOperation через existing quick-create

Один member:
`По умолчанию`

Если backend допускает отсутствие default:
UI должен предупредить, что Scheduler не сможет предварительно спланировать ТК.

Для MVP предпочтительно требовать default в UI.

## 4. Редактирование группы
Действия:
- переименовать
- добавить вариант
- удалить вариант
- изменить default
- удалить группу

Удаление group не удаляет TechOperation из справочника.

## 5. DnD
Variant Group = один logical block в sequence.

Можно:
- менять положение группы в Workshop
- переносить группу в другой Workshop, только если backend позволяет
- reorder members внутри group

Не позволять member случайно вытащить из group обычным drag.
Использовать явное действие:
`Убрать из группы`.

## 6. Parallel vs Variant
Явно различать:

### Параллельная ветка
`Выполняются все операции`

### Группа вариантов
`Выполняется одна операция`

Добавить tooltip/help.

## 7. Routing previews
Kanban preview:
без изменений, только Workshops.

Calendar preview:
Variant Group показывать:
`Раскрой: один из вариантов`
- Ручной
- Настил [default]
- Лазер

Не показывать три операции как одновременно планируемые.

## 8. TechnicalCard UI
На standalone TechnicalCard добавить блок:

`Варианты маршрута`

Пример:

### Способ раскроя
`Раскрой настилом`

Badge:
`Предварительно`

Actions:
- Изменить
- Подтвердить

## 9. Selection modal
`Изменить способ раскроя`

Radio list:
- Ручной раскрой
- Раскрой настилом
- Раскрой лазером

Для каждого, если API отдаёт:
- readiness
- resource
- work center
- estimated impact

Не вычислять ETA во frontend.

## 10. Preliminary state
Badge:
`Предварительно`

Helper:
`Этот вариант используется для предварительного производственного плана и расчёта даты готовности.`

## 11. Confirmed state
Badge:
`Подтверждено`

Helper:
`Вариант подтверждён производством.`

Если confirmed option меняют:
показывать stronger confirmation.

## 12. Change impact
После смены backend может вернуть:
- requires_replan
- deadline impact

UI:
1. сохраняет selection
2. если нужен replan — показывает `Пересчитать план`
3. после schedule обновляет ETA, Calendar и deadline state.

Не имитировать пересчёт локально.

## 13. Explicit replan
Если текущий Scheduler UX использует explicit button `Пересчитать план`,
сохранить этот принцип.

После change:
`Вариант изменён. Для обновления календаря пересчитайте план.`

## 14. Fact protection
Если backend запрещает change из-за:
- in_progress
- completed
- locked fact

показать:
`Способ раскроя нельзя изменить: операция уже запущена в производство.`

Не показывать raw HTTP error.

## 15. Calendar UI
Assignment, построенный по preliminary variant, можно маркировать компактно:
`Предв.`

Предпочтительно tooltip/small badge.
Не менять всю цветовую систему weekly board.

Confirmed:
обычный вид или tooltip `Подтверждено`.

## 16. Queue semantics
Не создавать отдельную очередь для preliminary.
Preliminary assignment находится в обычной очереди и резервирует мощность.

## 17. Readiness
Member может иметь:
- Готово
- Требует настройки
- Без расчёта мощности

Group readiness:
- `Готово`, если default member планируем
- `Требует настройки`, если default отсутствует или default member блокирован

Не строить сложный frontend агрегатор без backend support.

## 18. Quick-create example
В `Раскрой`:

`+ Группа вариантов`

Название:
`Способ раскроя`

Members:
- Ручной раскрой
- Раскрой настилом
- Раскрой лазером

Default:
`Раскрой настилом`

Save.

## 19. Не делать
- AI auto-selection
- выбор самого свободного resource
- earliest ETA autoselection
- conditional Design/no Design
- backend semantics changes
- Scheduler changes
- Capacity changes
- удаление VIS-STRESS

## 20. Tests

### Routing Editor
- create Variant Group
- add existing member
- quick-create member
- default selection
- reorder
- delete member/group
- save/reload

### Semantics
- Variant визуально отличается от parallel
- ONE OF help
- Calendar preview

### TechnicalCard
- preliminary badge
- change selection
- confirm selection
- backend conflict
- replan CTA

### Calendar
- preliminary marker/tooltip if implemented
- no duplicate alternative assignments

### Regression
- normal sequential route
- explicit parallel
- DnD
- quick-create TechOperation
- route save
- snapshot warning

Full:
- frontend tests
- eslint
- tsc
- production build
- project check
- git diff --check

## 21. Acceptance
Готово, если:
1. в Routing Editor можно создать ONE OF group
2. пользователь понимает разницу ONE OF и parallel
3. можно назначить default
4. можно использовать существующие и новые TechOperation
5. TechnicalCard показывает preliminary choice
6. оператор может изменить выбор
7. оператор может подтвердить выбор
8. после change есть понятный replan flow
9. Calendar сохраняет предварительное планирование
10. alternatives не выглядят одновременно запланированными
11. backend runtime не дублируется frontend-логикой

Финальная строка:
`PC-04.4J VARIANT ROUTING UI READY FOR OWNER REVIEW`
