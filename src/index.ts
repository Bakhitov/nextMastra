import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { storage } from './storage';
import { n8nAgent } from './agents/n8n-agent';
// Note: runtimeContext type varies by DI; use safe casting at access time

export const mastra = new Mastra({
  agents: { n8nAgent },
  storage,
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  // Middleware: прокидываем пользовательские заголовки в runtimeContext
  server: {
    middleware: [
      // Enforce internal secret (if configured) to restrict access to Mastra server
      async (c, next) => {
        try {
          const secret = process.env.MASTRA_INTERNAL_SECRET;
          if (secret) {
            const provided = c.req.header('x-internal-secret');
            if (provided !== secret) {
              return c.json({ error: 'Forbidden' }, 403);
            }
          }
        } catch {}
        await next();
      },
      async (c, next) => {
        try {
          const rc = c.get('runtimeContext');
          const headers = c.req.header.bind(c.req);
          const get = (name) => headers(name) || '';
          const decodeMaybe = (val) => {
            try {
              let v = String(val || '').trim();
              if (!v) return v;
              // base64 format: b64:...
              if (/^b64:/i.test(v)) {
                try { v = Buffer.from(v.slice(4), 'base64').toString('utf8'); } catch {}
              }
              // url-encoded
              if (/%[0-9A-Fa-f]{2}/.test(v)) {
                try { v = decodeURIComponent(v); } catch {}
              }
              // explicit dot placeholders
              v = v.replace(/%2E/ig, '.').replace(/__DOT__/g, '.');
              return v;
            } catch { return String(val || ''); }
          };
          const map = {
            provider_llm: headers('x-provider-llm') || '',
            api_key_llm: headers('x-api-key-llm') || '',
            model_llm: headers('x-model-llm') || '',
            role: headers('x-role') || '',
            url_by_type: decodeMaybe(get('x-n8n-url')) || '',
            api_key_by_type: decodeMaybe(get('x-n8n-key') || get('x-n8n-key-encoded')) || '',
            debug_tools: headers('x-debug-tools') || '',
          };
          for (const [k, v] of Object.entries(map)) {
            if (v && rc && typeof rc.set === 'function') rc.set(k, v);
          }
        } catch {}
        await next();
      },
    ],
  },
});


