## 2025-08-20

- chore(mastra): добавлены Dockerfile и .dockerignore для деплоя на Railway/контейнерные платформы.
  - В Dockerfile устанавливаются devDependencies, чтобы `mastra build` отработал корректно.
  - Экспонируется порт 4111; старт через `pnpm start`.
