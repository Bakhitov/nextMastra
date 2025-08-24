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

## 2025-08-23

- feat(agent): обновлены инструкции агента `mastra/src/agents/n8n-agent.ts`
  - Добавлен раздел "Access Policy (Free vs PRO)" (переведён на английский) с матрицей доступных MCP-инструментов.
  - Для Free: только Core Tools (текст инструкций на английском).
  - Для PRO: включает всё из Free + кастомные HTTP-инструменты (`n8n_credentials_*`, `n8n_variables_*`, `n8n_tags_*`, `n8n_source_control_*`, `n8n_workflow_activate/deactivate`) при наличии `url_by_type`, `api_key_by_type`, `role=pro`.
  - Добавлена подсказка-апселл: при запросе PRO-функций без активной PRO-конфигурации агент просит оформить PRO и указать `url_by_type`/`api_key_by_type`.
- feat(agent): ограничена выдача MCP-инструментов для Free-ролей только Core-набором на уровне runtime фильтрации.
  - Для Free добавлено гибкое сопоставление id (regex) и debug-логи со списками доступных и отфильтрованных инструментов.
  - Добавлен флаг детального логирования инструментов: заголовок `x-debug-tools: 1` или env `MASTRA_DEBUG_TOOLS=1`.
  - Изменены правила сообщений о PRO: агент больше не спрашивает подтверждение подписки, а определяет доступ по `runtimeContext` и даёт действие/подсказку согласно роли/настройкам.
  - Уточнение: при `role=pro` и наличии `url_by_type`/`api_key_by_type` агент не упоминает подписку/конфигурацию, а сразу выполняет запрос и показывает результат.
- fix(n8n-pro tools): принудительно используем заголовок `X-N8N-API-KEY` для всех `n8nProTools` и нормализуем `url_by_type` (срезаем завершающий `/`). Это позволяет использовать внешний `api_key_by_type` как внутренний ключ для всех PRO-инструментов.
- feat(server): нормализация заголовков в `mastra/src/index.ts` — поддержка `x-n8n-key-encoded`, формата `b64:...`, URL-encoding (`%2E`) и плейсхолдеров `__DOT__` для безопасной передачи ключей/URL с точками. Значения на сервере восстанавливаются автоматически.
 
## 2025-08-23

- feat(tools): добавлен единый префикс `agent_` для всех PRO-инструментов n8n (`mastra/src/tools/n8n-pro.ts`), например: `agent_n8n_credentials_list`, `agent_n8n_workflow_activate`.
- feat(agent): обновлён whitelist Core MCP-инструментов под префикс `agent_` и инструкции агента (`mastra/src/agents/n8n-agent.ts`), включая примеры вызовов.
- impact: role=free видит только `agent_*` Core-инструменты; role=pro получает весь набор MCP + `agent_n8n_*` HTTP-инструменты.

- docs: добавлен файл `mastra/docs/credentials-curl.md` с примерами curl-запросов для `credentials` (`GET/POST/PATCH/DELETE`).
  - Добавлены однострочные примеры команд с подставленным URL и API key для быстрого копирования/вставки.

## 2025-08-23

- feat(n8n-pro tools): реализация дополнительных OpenAPI-возможностей в `mastra/src/tools/n8n-pro.ts`
  - Добавлено:
    - `agent_n8n_audit_generate` — POST `/api/v1/audit`
    - `agent_n8n_executions_list` — GET `/api/v1/executions` (фильтры, пагинация)
    - `agent_n8n_executions_get` — GET `/api/v1/executions/{id}` (опц. includeData)
    - `agent_n8n_executions_delete` — DELETE `/api/v1/executions/{id}`
    - `agent_n8n_credentials_get_type_schema` — GET `/api/v1/credentials/schema/{credentialTypeName}`
    - `agent_n8n_credentials_transfer` — PUT `/api/v1/credentials/{id}/transfer`
  - Оставлены по Workflow только:
    - `agent_n8n_workflow_activate` — POST `/api/v1/workflows/{id}/activate`
    - `agent_n8n_workflow_deactivate` — POST `/api/v1/workflows/{id}/deactivate`
  - Скрыто (закомментировано в файле):
    - Variables API инструменты
    - Tags API инструменты
    - Source Control API инструменты
    - Projects API инструменты
  - Экспорт `n8nProTools` обновлён под новый состав инструментов.

## 2025-08-23

- feat(n8n-pro tools): адаптация под OpenAPI v1 (частично, по требованию)
  - Файл: `mastra/src/tools/n8n-pro.ts`
  - Добавлены инструменты: `agent_n8n_audit_generate`, `agent_n8n_executions_list/get/delete`, `agent_n8n_credentials_get_type_schema`, `agent_n8n_credentials_transfer`, `agent_n8n_projects_list/create/update/delete/add_users/delete_user/change_user_role`.
  - Сохранены workflow-тулзы только для активации/деактивации: `agent_n8n_workflow_activate/deactivate`.
  - Скрыты (закомментированы) инструменты: Variables, Tags, Source Control — по требованию.
  - Поддержана сборка query-string через утилиту `buildQueryString` для листингов/фильтров.
  