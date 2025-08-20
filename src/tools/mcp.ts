import { MCPClient } from "@mastra/mcp";

export type McpConfig = {
    n8nApiUrl: string;
    n8nApiKey: string;
};

// Factory: create MCP client per-request with dynamic credentials
export function createMcpClient(cfg: McpConfig): MCPClient {
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
                },
            },
        },
    });
}

// Lightweight MCP pool (stdio-only): LRU with TTL
type PoolEntry = {
    client: MCPClient;
    refs: number;
    timer?: NodeJS.Timeout;
};

const MCP_TTL_MS = 2 * 60 * 1000; // 2 minutes idle TTL
const MAX_POOL = 200; // hard cap
const pool = new Map<string, PoolEntry>();

function poolKey(cfg: McpConfig): string {
    return `${cfg.n8nApiUrl}|${cfg.n8nApiKey}`;
}

export async function acquireMcp(cfg: McpConfig): Promise<{ client: MCPClient; release: () => Promise<void> }>{
    const key = poolKey(cfg);
    let entry = pool.get(key);
    if (!entry) {
        // simple LRU evict if over cap
        if (pool.size >= MAX_POOL) {
            const firstKey = pool.keys().next().value as string | undefined;
            if (firstKey) {
                const old = pool.get(firstKey);
                pool.delete(firstKey);
                try { await old?.client.disconnect(); } catch {}
            }
        }
        entry = { client: createMcpClient(cfg), refs: 0 };
        pool.set(key, entry);
    }
    // cancel pending idle timer
    if (entry.timer) {
        clearTimeout(entry.timer);
        entry.timer = undefined;
    }
    entry.refs += 1;
    const release = async () => {
        const current = pool.get(key);
        if (!current) return;
        current.refs = Math.max(0, current.refs - 1);
        if (current.refs === 0 && !current.timer) {
            current.timer = setTimeout(async () => {
                // double-check refs
                const again = pool.get(key);
                if (!again) return;
                if (again.refs === 0) {
                    pool.delete(key);
                    try { await again.client.disconnect(); } catch {}
                }
            }, MCP_TTL_MS);
        }
    };
    return { client: entry.client, release };
}