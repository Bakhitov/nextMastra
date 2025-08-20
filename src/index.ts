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
      async (c, next) => {
        try {
          const rc = c.get('runtimeContext') as any;
          const headers = c.req.header.bind(c.req);
          const map: Record<string, string> = {
            provider_llm: headers('x-provider-llm') || '',
            api_key_llm: headers('x-api-key-llm') || '',
            model_llm: headers('x-model-llm') || '',
            role: headers('x-role') || '',
            url_by_type: headers('x-n8n-url') || '',
            api_key_by_type: headers('x-n8n-key') || '',
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


