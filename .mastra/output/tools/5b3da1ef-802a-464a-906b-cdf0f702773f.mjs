import { MCPClient } from '@mastra/mcp';

function createMcpClient(cfg) {
  return new MCPClient({
    servers: {
      agent: {
        command: "pnpm",
        args: ["exec", "n8n-mcp"],
        env: {
          MCP_MODE: "stdio",
          LOG_LEVEL: "error",
          DISABLE_CONSOLE_OUTPUT: "true",
          N8N_API_URL: cfg.n8nApiUrl,
          N8N_API_KEY: cfg.n8nApiKey,
          N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE: "true"
        }
      }
    }
  });
}
const MCP_TTL_MS = 2 * 60 * 1e3;
const MAX_POOL = 200;
const pool = /* @__PURE__ */ new Map();
function poolKey(cfg) {
  return `${cfg.n8nApiUrl}|${cfg.n8nApiKey}`;
}
async function acquireMcp(cfg) {
  const key = poolKey(cfg);
  let entry = pool.get(key);
  if (!entry) {
    if (pool.size >= MAX_POOL) {
      const firstKey = pool.keys().next().value;
      if (firstKey) {
        const old = pool.get(firstKey);
        pool.delete(firstKey);
        try {
          await old?.client.disconnect();
        } catch {
        }
      }
    }
    entry = { client: createMcpClient(cfg), refs: 0 };
    pool.set(key, entry);
  }
  if (entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = void 0;
  }
  entry.refs += 1;
  const release = async () => {
    const current = pool.get(key);
    if (!current) return;
    current.refs = Math.max(0, current.refs - 1);
    if (current.refs === 0 && !current.timer) {
      current.timer = setTimeout(async () => {
        const again = pool.get(key);
        if (!again) return;
        if (again.refs === 0) {
          pool.delete(key);
          try {
            await again.client.disconnect();
          } catch {
          }
        }
      }, MCP_TTL_MS);
    }
  };
  return { client: entry.client, release };
}

export { acquireMcp, createMcpClient };
