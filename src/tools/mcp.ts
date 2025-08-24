import { MCPClient } from "@mastra/mcp";
import path from "node:path";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import crypto from "node:crypto";
let seedDbLoggedOnce = false;

export type McpConfig = {
    n8nApiUrl: string;
    n8nApiKey: string;
    // Optional: absolute path to local n8n-mcp project dir or to dist/mcp/index.js
    mcpPath?: string;
    // Optional: absolute path to nodes.db
    dbPath?: string;
};

// Factory: create MCP client per-request with dynamic credentials
export function createMcpClient(cfg: McpConfig): MCPClient {
    // Prefer explicit cfg.mcpPath or env override; fallback to package binary
    const envLocalPath = process.env.N8N_MCP_LOCAL_PATH;
    const forceLocal = process.env.N8N_MCP_FORCE_LOCAL === "true";
    const basePath = cfg.mcpPath || envLocalPath; // can be dir or file

    let command: string;
    let args: string[];

    if (basePath) {
        // If a directory is provided, use its dist entrypoint; if file, use as-is
        const isFile = basePath.endsWith(".js");
        const entry = isFile ? basePath : path.join(basePath, "dist", "mcp", "index.js");
        command = "node";
        args = [entry];
    } else {
        if (forceLocal) {
            throw new Error("N8N_MCP_FORCE_LOCAL=true, но mcpPath/N8N_MCP_LOCAL_PATH не задан: укажите путь к локальному n8n-mcp");
        }
        command = "pnpm";
        args = ["exec", "n8n-mcp"];
    }

    const env: Record<string, string> = {
        MCP_MODE: "stdio",
        LOG_LEVEL: "error",
        DISABLE_CONSOLE_OUTPUT: "true",
        N8N_MODE: "true",
        N8N_API_URL: cfg.n8nApiUrl,
        N8N_API_KEY: cfg.n8nApiKey,
        N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE: "true",
    };

    // If dbPath provided or basePath known, set NODE_DB_PATH for reliability
    const dbPath = cfg.dbPath || (basePath ? path.join(basePath, "data", "nodes.db") : undefined);
    if (dbPath) env["NODE_DB_PATH"] = dbPath;

    return new MCPClient({
        servers: {
            agent: {
                command,
                args,
                env,
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

const MCP_TTL_MS = Number(process.env.MCP_IDLE_TTL_MS || 2 * 60 * 1000);
const MAX_POOL = Number(process.env.MCP_POOL_MAX || 200);
const pool = new Map<string, PoolEntry>();

function poolKey(cfg: McpConfig): string {
    const keyParts = [cfg.n8nApiUrl, cfg.n8nApiKey, cfg.mcpPath || process.env.N8N_MCP_LOCAL_PATH || "", cfg.dbPath || ""];
    return keyParts.join("|");
}

export async function acquireMcp(cfg: McpConfig): Promise<{ client: MCPClient; release: () => Promise<void> }>{
    // Ensure DB exists for stdio mode if a local path is used
    const effectiveDbPath = getEffectiveDbPath(cfg);
    if (effectiveDbPath) {
        await seedDbIfNeeded(effectiveDbPath);
    }

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

function getEffectiveDbPath(cfg: McpConfig): string | undefined {
    const envLocalPath = process.env.N8N_MCP_LOCAL_PATH;
    const basePath = cfg.mcpPath || envLocalPath;
    if (cfg.dbPath) return cfg.dbPath;
    if (basePath) return path.join(basePath, "data", "nodes.db");
    return undefined;
}

async function seedDbIfNeeded(dbPath: string): Promise<void> {
    try {
        // If file exists and has non-zero size, skip
        try {
            const st = await fsp.stat(dbPath);
            if (st.size > 0) return;
        } catch {}

        const seedUrl = process.env.N8N_DB_SEED_URL;
        const seedSha = process.env.N8N_DB_SEED_SHA256;
        if (!seedUrl) return; // nothing to do

        const dir = path.dirname(dbPath);
        await fsp.mkdir(dir, { recursive: true });

        // Download whole file into memory (DB is expected to be ~10-200 MB)
        const res = await fetch(seedUrl);
        if (!res.ok) throw new Error(`Seed download failed: ${res.status} ${res.statusText}`);
        const ab = await res.arrayBuffer();
        const buf = Buffer.from(ab);

        if (seedSha) {
            const hash = crypto.createHash("sha256").update(buf).digest("hex");
            if (hash !== seedSha) throw new Error(`Seed SHA256 mismatch: got ${hash}`);
        }

        await fsp.writeFile(dbPath, buf);
    } catch (err) {
        // Do not crash the request path; log once
        if (!seedDbLoggedOnce) {
            seedDbLoggedOnce = true;
            console.error("[mcp] DB seed failed:", err);
        }
    }
}