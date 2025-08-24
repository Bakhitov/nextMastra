## n8n Credentials API — curl примеры

Перед началом:

```bash
export N8N_URL="https://n8n.srv945365.hstgr.cloud"
export N8N_API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDEwMDNhYS0yNWM1LTQ3YTYtOTNhYy01NjNkM2Y2NWE5M2UiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1OTQ4MzE4fQ.zUBn4948LYuCx8kyUKeux0zup_16K6H5dph0kuYa-u4"
```

### Список credential'ов

```bash
curl -sS -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_URL/api/v1/credentials"
```

Однострочный пример (готов к вставке):

```bash
curl -sS -H "X-N8N-API-KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDEwMDNhYS0yNWM1LTQ3YTYtOTNhYy01NjNkM2Y2NWE5M2UiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1OTQ4MzE4fQ.zUBn4948LYuCx8kyUKeux0zup_16K6H5dph0kuYa-u4" "https://n8n.srv945365.hstgr.cloud/api/v1/credentials"
```

Поддерживаются query-параметры (если включены в вашем инстансе), например `limit`, `offset`:

```bash
curl -sS -G -H "X-N8N-API-KEY: $N8N_API_KEY" \
  --data-urlencode "limit=50" \
  --data-urlencode "offset=0" \
  "$N8N_URL/api/v1/credentials"
```

Однострочный пример:

```bash
curl -sS -G -H "X-N8N-API-KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDEwMDNhYS0yNWM1LTQ3YTYtOTNhYy01NjNkM2Y2NWE5M2UiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1OTQ4MzE4fQ.zUBn4948LYuCx8kyUKeux0zup_16K6H5dph0kuYa-u4" --data-urlencode "limit=50" --data-urlencode "offset=0" "https://n8n.srv945365.hstgr.cloud/api/v1/credentials"
```

### Получить credential по ID

```bash
curl -sS -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_URL/api/v1/credentials/<CRED_ID>"
```

Однострочный пример:

```bash
curl -sS -H "X-N8N-API-KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDEwMDNhYS0yNWM1LTQ3YTYtOTNhYy01NjNkM2Y2NWE5M2UiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1OTQ4MzE4fQ.zUBn4948LYuCx8kyUKeux0zup_16K6H5dph0kuYa-u4" "https://n8n.srv945365.hstgr.cloud/api/v1/credentials/hiBHY5HgQD5p9eP6"
```

### Создать credential

Тело зависит от типа credential. Пример для Slack API:

```bash
curl -sS -X POST -H "Content-Type: application/json" -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -d '{
    "name": "My Slack",
    "type": "slackApi",
    "data": { "token": "xoxb-***" },
    "nodesAccess": [
      { "nodeType": "n8n-nodes-base.slack", "allowNodes": ["Slack"] }
    ]
  }' \
  "$N8N_URL/api/v1/credentials"
```

Тело зависит от типа credential. Пример для Telegram API:

```bash
curl -sS -X POST -H "Content-Type: application/json" -H "X-N8N-API-KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDEwMDNhYS0yNWM1LTQ3YTYtOTNhYy01NjNkM2Y2NWE5M2UiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1OTQ4MzE4fQ.zUBn4948LYuCx8kyUKeux0zup_16K6H5dph0kuYa-u4" \
  -d '{
    "name": "My telegram",
    "type": "telegramApi",
    "data": { "accessToken": "8483784663:AAGIzyYwHGXluvJGaMpWrB16utQ5L3DSlEg" },
    "nodesAccess": [
      { "nodeType": "n8n-nodes-base.telegram", "allowNodes": ["Telegram"] }
    ]
  }' \
  "https://n8n.srv945365.hstgr.cloud/api/v1/credentials"
```
Однострочный пример:

```bash
curl -sS -X POST -H "Content-Type: application/json" -H "X-N8N-API-KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDEwMDNhYS0yNWM1LTQ3YTYtOTNhYy01NjNkM2Y2NWE5M2UiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1OTQ4MzE4fQ.zUBn4948LYuCx8kyUKeux0zup_16K6H5dph0kuYa-u4" -d '{"name":"My Slack","type":"slackApi","data":{"token":"xoxb-***"},"nodesAccess":[{"nodeType":"n8n-nodes-base.slack","allowNodes":["Slack"]}]}' "https://n8n.srv945365.hstgr.cloud/api/v1/credentials"
```

### Частичное обновление credential

```bash
curl -sS -X PATCH -H "Content-Type: application/json" -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -d '{ "name": "My Slack (rotated)", "data": { "token": "xoxb-***new***" } }' \
  "$N8N_URL/api/v1/credentials/<CRED_ID>"
```

Однострочный пример:

```bash
curl -sS -X PATCH -H "Content-Type: application/json" -H "X-N8N-API-KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDEwMDNhYS0yNWM1LTQ3YTYtOTNhYy01NjNkM2Y2NWE5M2UiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1OTQ4MzE4fQ.zUBn4948LYuCx8kyUKeux0zup_16K6H5dph0kuYa-u4" -d '{"name":"My Slack (rotated)","data":{"token":"xoxb-***new***"}}' "https://n8n.srv945365.hstgr.cloud/api/v1/credentials/<CRED_ID>"
```

### Удалить credential

```bash
curl -sS -X DELETE -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_URL/api/v1/credentials/<CRED_ID>"
```

Однострочный пример:

```bash
curl -sS -X DELETE -H "X-N8N-API-KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDEwMDNhYS0yNWM1LTQ3YTYtOTNhYy01NjNkM2Y2NWE5M2UiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1OTQ4MzE4fQ.zUBn4948LYuCx8kyUKeux0zup_16K6H5dph0kuYa-u4" "https://n8n.srv945365.hstgr.cloud/api/v1/credentials/<CRED_ID>"
```

Примечания:
- Всегда передавайте заголовок `X-N8N-API-KEY`.
- База URL может быть как `https://host`, так и `https://host/api/v1` — внутренний клиент n8n-mcp нормализует путь, но для curl используйте явный `/api/v1`.
- Отдельные поля и форматы зависят от вида credential'а в вашем n8n (см. n8n docs).

