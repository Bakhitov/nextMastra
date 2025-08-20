## 2025-08-20

- chore(postinstall): добавлен скрипт `scripts/patch-n8n-db.mjs`, который после установки пакетов копирует `mastra/data/nodes.db` в `mastra/node_modules/n8n-mcp/data/nodes.db`.
  - Обновлён `package.json`: добавлен скрипт `postinstall`.
  - Если исходного файла нет, установка не падает — просто предупреждение.

- chore(Dockerfile): установка зависимостей с `--ignore-scripts`, копирование `scripts/` и ручной запуск `patch-n8n-db.mjs` на стадии сборки образа.

## 2025-08-20

- chore(mastra): добавлены Dockerfile и .dockerignore для деплоя на Railway/контейнерные платформы.
  - В Dockerfile устанавливаются devDependencies, чтобы `mastra build` отработал корректно.
  - Экспонируется порт 4111; старт через `pnpm start`.
  
- fix(storage): настройка SSL для Postgres при использовании `DATABASE_URL`
  - Файл: `nextMastra_mastra_repo/src/storage.ts`
  - Теперь `DATABASE_URL` разбирается в объект конфигурации с `ssl: { rejectUnauthorized: ... }`.
  - По умолчанию включает TLS; можно управлять строгой проверкой через `sslmode=no-verify` в URL или `PG_SSL_REJECT_UNAUTHORIZED=false`.