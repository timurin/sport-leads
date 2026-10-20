# PC-06.3J-R — Recovery: finish only same-origin proxy fix

## Исполнитель
Cursor

Текущая задача зависла на большом dirty tree. Не анализируй и не классифицируй все незакоммиченные файлы.

## Цель
Завершить только fix production fetch для Manual Planning.

## Ограничение
Не трогать и не коммитить существующий dirty tree PC-06.0E–0H, PC-06.2A, docs/tasks и чужие test changes.

## Действия

1. Проверь только эти пути:
   - `frontend/app/api/technical-cards/route.ts`
   - файл Manual Planning/client helper, который раньше делал browser fetch на `127.0.0.1:8000`
   - targeted test для этого fetch, только если он реально изменён этой задачей.

2. Не запускай повторно общий анализ `git status` в цикле.
   Один раз используй:
   - `git diff -- frontend/app/api/technical-cards/route.ts`
   - `git diff -- <точный manual-planning файл>`
   - `git diff -- <точный targeted test>`

3. Убедись, что browser request теперь идёт через same-origin `/api/technical-cards...`, а не через `NEXT_PUBLIC_SPORT_LEADS_API_URL` / `127.0.0.1:8000`.

4. Запусти только необходимые проверки:
   - targeted test
   - `npx tsc --noEmit`
   - `git diff --check`

5. Stage только точные файлы 3J командой `git add <file1> <file2> ...`.
   Не использовать `git add .` и `git add -A`.

6. Перед commit:
   - `git diff --cached --name-only`
   В staged должны быть только файлы 3J.

7. Commit:
   `fix: use same-origin api for manual planning orders`

8. Push:
   `git push origin main`

9. Дождись deploy и read-only проверь:
   - `/production/calendar/planning` открывается без `Failed to fetch`;
   - список и имена заказов загружаются;
   - в browser network нет запросов к `127.0.0.1:8000`.

10. Не исправляй никакие другие незакоммиченные файлы.

## Если обнаружится, что fix требует изменения чужого modified файла
Не зависай и не расширяй scope. Остановись и напиши:
`PC-06.3J BLOCKED BY DIRTY FILE: <path>`
с кратким объяснением, какой именно минимальный diff нужен.

Финальная строка:
`PC-06.3J PRODUCTION MANUAL PLANNING FETCH FIX DEPLOYED`
