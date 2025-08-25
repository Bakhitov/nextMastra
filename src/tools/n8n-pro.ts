import { createTool } from "@mastra/core/tools";
import { z } from "zod";

type RuntimeKeys =
  | "url_by_type"
  | "api_key_by_type";

function resolveN8nConfig(runtimeContext?: { get: (k: RuntimeKeys | string) => unknown }) {
  const rcUrl = (runtimeContext?.get("url_by_type") as string) || process.env.N8N_API_URL || "";
  const rcKey = (runtimeContext?.get("api_key_by_type") as string) || process.env.N8N_API_KEY || "";
  if (!rcUrl || !rcKey) throw new Error("N8N API is not configured. Provide N8N_API_URL and N8N_API_KEY (or runtimeContext url_by_type/api_key_by_type).");
  const baseUrl = rcUrl.replace(/\/$/, "");
  const isJwt = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(rcKey);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-N8N-API-KEY": rcKey,
  };
  return { baseUrl, headers };
}

async function n8nFetch<T>(
  runtimeContext: any,
  path: string,
  init: RequestInit = {},
  abortSignal?: AbortSignal
): Promise<T> {
  const { baseUrl, headers } = resolveN8nConfig(runtimeContext);
  const res = await fetch(`${baseUrl}${path}`, {
    method: init.method || "GET",
    headers: { ...headers, ...(init.headers as any) },
    body: init.body as any,
    signal: abortSignal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Graceful fallback for method not allowed
    if (res.status === 405) {
      return {
        ok: false,
        status: 405,
        message: `Method Not Allowed for ${path}`,
        details: text,
        hint:
          "This endpoint may be disabled on your n8n instance or requires a different auth mode. If using Public API (JWT), only a subset of endpoints is allowed.",
      } as unknown as T;
    }
    throw new Error(`n8n API ${init.method || "GET"} ${path} failed: ${res.status} ${res.statusText} ${text}`);
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

// ------------- Credentials -------------
const credentialsCreateSchema = z.object({
  name: z.string().describe("Credential name"),
  type: z.string().describe("n8n credential type ID, e.g. 'slackApi'"),
  data: z.record(z.any()).optional().describe("Credential data object per n8n type schema (optional: will be validated against type schema if provided)"),
  nodesAccess: z.array(z.object({
    nodeType: z.string().optional(),
    allowNodes: z.array(z.string()).optional(),
  })).optional().describe("Optional nodes access control"),
});

const credentialsUpdateSchema = z.object({
  id: z.string().describe("Credential ID"),
  name: z.string().optional(),
  data: z.record(z.any()).optional(),
  nodesAccess: z.array(z.object({
    nodeType: z.string().optional(),
    allowNodes: z.array(z.string()).optional(),
  })).optional(),
});

/* HIDDEN BY REQUEST: Credentials list tool
export const n8n_credentials_list = createTool({
  id: "agent_n8n_credentials_list",
  description: "List credentials from n8n: GET /api/v1/credentials. Use to discover existing credentials before assigning them to nodes. Returns minimal metadata; sensitive fields are redacted by n8n.",
  inputSchema: z.object({}),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, "/api/v1/credentials", { method: "GET" }, options?.abortSignal);
  },
});
*/

export const n8n_credentials_get = createTool({
  id: "agent_n8n_credentials_get",
  description: "Get credential by ID: GET /api/v1/credentials/{id}. Use to inspect a specific credential configuration. Sensitive data may be redacted depending on n8n settings.",
  inputSchema: z.object({ id: z.string().describe("Credential ID") }),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, `/api/v1/credentials/${encodeURIComponent(args.context.id)}`, { method: "GET" }, options?.abortSignal);
  },
});

export const n8n_credentials_create = createTool({
  id: "agent_n8n_credentials_create",
  description: "Create credential: POST /api/v1/credentials. Automatically fetches credential type schema and validates required fields before sending. Provide 'name', 'type' and 'data' (e.g. slackApi).",
  inputSchema: credentialsCreateSchema,
  execute: async (args, options) => {
    const { type, data } = args.context as { type: string; data?: Record<string, unknown> };
    try {
      // fetch type schema
      const schema = await n8nFetch<any>(args.runtimeContext, `/api/v1/credentials/schema/${encodeURIComponent(type)}`, { method: "GET" }, options?.abortSignal);
      const required = Array.isArray(schema?.required) ? (schema.required as string[]) : [];
      const provided = data || {};
      const missing = required.filter((k) => !(k in provided) || (provided as any)[k] === undefined || (provided as any)[k] === null || (typeof (provided as any)[k] === 'string' && String((provided as any)[k]).trim() === ''));
      if (missing.length > 0) {
        return {
          ok: false,
          status: 400,
          message: `Credential data missing required fields for type '${type}'.`,
          required,
          missing,
          hint: "Сначала запросите схему типа через agent_n8n_credentials_get_type_schema и заполните обязательные поля в data.",
        } as any;
      }
    } catch (e) {
      // If schema fetch fails, continue but warn in response
      if (process.env.NODE_ENV !== 'production') {
        try { console.warn('[n8n_credentials_create] schema fetch failed, proceeding without pre-validation:', (e as Error)?.message); } catch {}
      }
    }
    return await n8nFetch(args.runtimeContext, "/api/v1/credentials", {
      method: "POST",
      body: JSON.stringify(args.context),
    }, options?.abortSignal);
  },
});

export const n8n_credentials_update = createTool({
  id: "agent_n8n_credentials_update",
  description: "Update credential (partial): PATCH /api/v1/credentials/{id}. Include only fields to change. Use to rotate secrets or rename credentials without recreating.",
  inputSchema: credentialsUpdateSchema,
  execute: async (args, options) => {
    const { id, ...body } = args.context;
    return await n8nFetch(args.runtimeContext, `/api/v1/credentials/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }, options?.abortSignal);
  },
});

export const n8n_credentials_delete = createTool({
  id: "agent_n8n_credentials_delete",
  description: "Delete credential: DELETE /api/v1/credentials/{id}. Irreversible. Ensure no active workflows depend on it before deletion.",
  inputSchema: z.object({ id: z.string().describe("Credential ID") }),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, `/api/v1/credentials/${encodeURIComponent(args.context.id)}`, { method: "DELETE" }, options?.abortSignal);
  },
});

// ------------- Variables -------------
/* HIDDEN BY REQUEST: Variables API tools
const variableCreateSchema = z.object({
  key: z.string().describe("Variable key"),
  value: z.string().describe("Variable value"),
});

const variableUpdateSchema = z.object({
  id: z.string().describe("Variable ID"),
  key: z.string().optional(),
  value: z.string().optional(),
});

export const n8n_variables_list = createTool({
  id: "agent_n8n_variables_list",
  description: "List variables: GET /api/v1/variables. Variables are global key/value pairs resolved in expressions. Use to audit available keys.",
  inputSchema: z.object({}),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, "/api/v1/variables", { method: "GET" }, options?.abortSignal);
  },
});

export const n8n_variables_create = createTool({
  id: "agent_n8n_variables_create",
  description: "Create variable: POST /api/v1/variables. Provide key and value. Use variables in expressions like {{$env.VAR}}/$json replacements depending on n8n version.",
  inputSchema: variableCreateSchema,
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, "/api/v1/variables", {
      method: "POST",
      body: JSON.stringify(args.context),
    }, options?.abortSignal);
  },
});

export const n8n_variables_update = createTool({
  id: "agent_n8n_variables_update",
  description: "Update variable (partial): PATCH /api/v1/variables/{id}. Change key and/or value. Consider workflow dependencies on variable names.",
  inputSchema: variableUpdateSchema,
  execute: async (args, options) => {
    const { id, ...body } = args.context;
    return await n8nFetch(args.runtimeContext, `/api/v1/variables/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }, options?.abortSignal);
  },
});

export const n8n_variables_delete = createTool({
  id: "agent_n8n_variables_delete",
  description: "Delete variable: DELETE /api/v1/variables/{id}. Removing variables may break expressions in existing workflows.",
  inputSchema: z.object({ id: z.string().describe("Variable ID") }),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, `/api/v1/variables/${encodeURIComponent(args.context.id)}`, { method: "DELETE" }, options?.abortSignal);
  },
});
*/

// ------------- Tags -------------
/* HIDDEN BY REQUEST: Tags API tools
const tagCreateSchema = z.object({
  name: z.string().describe("Tag name"),
});

const tagUpdateSchema = z.object({
  id: z.string().describe("Tag ID"),
  name: z.string().describe("New tag name"),
});

export const n8n_tags_list = createTool({
  id: "agent_n8n_tags_list",
  description: "List tags: GET /api/v1/tags. Tags are labels for workflows; use them for organization and filtering.",
  inputSchema: z.object({}),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, "/api/v1/tags", { method: "GET" }, options?.abortSignal);
  },
});

export const n8n_tags_create = createTool({
  id: "agent_n8n_tags_create",
  description: "Create tag: POST /api/v1/tags. Use to add organizational labels for workflows.",
  inputSchema: tagCreateSchema,
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, "/api/v1/tags", {
      method: "POST",
      body: JSON.stringify(args.context),
    }, options?.abortSignal);
  },
});

export const n8n_tags_update = createTool({
  id: "agent_n8n_tags_update",
  description: "Update tag: PATCH /api/v1/tags/{id}. Rename existing tags; workflows linked to the tag will reflect the new name.",
  inputSchema: tagUpdateSchema,
  execute: async (args, options) => {
    const { id, ...body } = args.context;
    return await n8nFetch(args.runtimeContext, `/api/v1/tags/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }, options?.abortSignal);
  },
});

export const n8n_tags_delete = createTool({
  id: "agent_n8n_tags_delete",
  description: "Delete tag: DELETE /api/v1/tags/{id}. Deleting a tag removes the label from associated workflows but does not delete the workflows.",
  inputSchema: z.object({ id: z.string().describe("Tag ID") }),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, `/api/v1/tags/${encodeURIComponent(args.context.id)}`, { method: "DELETE" }, options?.abortSignal);
  },
});
*/

/* HIDDEN BY REQUEST: Source Control API tools
export const n8n_source_control_status = createTool({
  id: "agent_n8n_source_control_status",
  description: "Get source control status: GET /api/v1/source-control/status. Enterprise only. Returns repo status, branch, pending changes if configured.",
  inputSchema: z.object({}),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, "/api/v1/source-control/status", { method: "GET" }, options?.abortSignal);
  },
});

export const n8n_source_control_pull = createTool({
  id: "agent_n8n_source_control_pull",
  description: "Pull from remote repository: POST /api/v1/source-control/pull. Enterprise only. Syncs remote changes into the n8n project; use strategy to resolve conflicts when available.",
  inputSchema: z.object({
    branch: z.string().optional().describe("Optional branch to pull"),
    strategy: z.enum(["theirs", "ours"]).optional().describe("Merge strategy if applicable"),
  }),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, "/api/v1/source-control/pull", {
      method: "POST",
      body: JSON.stringify(args.context || {}),
    }, options?.abortSignal);
  },
});

export const n8n_source_control_push = createTool({
  id: "agent_n8n_source_control_push",
  description: "Push to remote repository: POST /api/v1/source-control/push. Enterprise only. Commits and pushes local changes; optionally set branch and message.",
  inputSchema: z.object({
    branch: z.string().optional().describe("Optional branch to push"),
    message: z.string().optional().describe("Commit message to use"),
  }),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, "/api/v1/source-control/push", {
      method: "POST",
      body: JSON.stringify(args.context || {}),
    }, options?.abortSignal);
  },
});
*/

// ------------- Utils -------------
function buildQueryString(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "boolean") usp.set(k, String(v));
    else if (typeof v === "number") usp.set(k, String(v));
    else usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

// ------------- Audit -------------
export const n8n_audit_generate = createTool({
  id: "agent_n8n_audit_generate",
  description: "Generate security audit: POST /api/v1/audit. Optional additionalOptions: daysAbandonedWorkflow, categories.",
  inputSchema: z.object({
    additionalOptions: z
      .object({
        daysAbandonedWorkflow: z.number().int().optional(),
        categories: z
          .array(z.enum(["credentials", "database", "nodes", "filesystem", "instance"]))
          .optional(),
      })
      .optional(),
  }),
  execute: async (args, options) => {
    const body = args?.context ? JSON.stringify(args.context) : undefined;
    return await n8nFetch(args.runtimeContext, "/api/v1/audit", { method: "POST", body }, options?.abortSignal);
  },
});

// ------------- Executions -------------
// Перенесено на MCP-инструменты (n8n_list_executions / n8n_get_execution / n8n_delete_execution)

// ------------- Credentials Extras -------------
export const n8n_credentials_get_type_schema = createTool({
  id: "agent_n8n_credentials_get_type_schema",
  description: "Get credential type schema: GET /api/v1/credentials/schema/{credentialTypeName}.",
  inputSchema: z.object({ credentialTypeName: z.string() }),
  execute: async (args, options) => {
    const { credentialTypeName } = args.context;
    return await n8nFetch(args.runtimeContext, `/api/v1/credentials/schema/${encodeURIComponent(credentialTypeName)}`, { method: "GET" }, options?.abortSignal);
  },
});

export const n8n_credentials_transfer = createTool({
  id: "agent_n8n_credentials_transfer",
  description: "Transfer credential to another project: PUT /api/v1/credentials/{id}/transfer.",
  inputSchema: z.object({ id: z.string(), destinationProjectId: z.string() }),
  execute: async (args, options) => {
    const { id, destinationProjectId } = args.context;
    return await n8nFetch(args.runtimeContext, `/api/v1/credentials/${encodeURIComponent(id)}/transfer`, {
      method: "PUT",
      body: JSON.stringify({ destinationProjectId }),
    }, options?.abortSignal);
  },
});

/* HIDDEN BY REQUEST: Projects API tools
// ------------- Projects -------------
export const n8n_projects_list = createTool({
  id: "agent_n8n_projects_list",
  description: "Retrieve projects: GET /api/v1/projects with pagination.",
  inputSchema: z.object({ limit: z.number().optional(), cursor: z.string().optional() }),
  execute: async (args, options) => {
    const qs = buildQueryString(args.context || {});
    return await n8nFetch(args.runtimeContext, `/api/v1/projects${qs}`, { method: "GET" }, options?.abortSignal);
  },
});

export const n8n_projects_create = createTool({
  id: "agent_n8n_projects_create",
  description: "Create a project: POST /api/v1/projects.",
  inputSchema: z.object({ name: z.string() }),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, "/api/v1/projects", { method: "POST", body: JSON.stringify(args.context) }, options?.abortSignal);
  },
});

export const n8n_projects_update = createTool({
  id: "agent_n8n_projects_update",
  description: "Update a project: PUT /api/v1/projects/{projectId}.",
  inputSchema: z.object({ projectId: z.string(), name: z.string() }),
  execute: async (args, options) => {
    const { projectId, name } = args.context;
    return await n8nFetch(args.runtimeContext, `/api/v1/projects/${encodeURIComponent(projectId)}`, { method: "PUT", body: JSON.stringify({ name }) }, options?.abortSignal);
  },
});

export const n8n_projects_delete = createTool({
  id: "agent_n8n_projects_delete",
  description: "Delete a project: DELETE /api/v1/projects/{projectId}.",
  inputSchema: z.object({ projectId: z.string() }),
  execute: async (args, options) => {
    const { projectId } = args.context;
    return await n8nFetch(args.runtimeContext, `/api/v1/projects/${encodeURIComponent(projectId)}`, { method: "DELETE" }, options?.abortSignal);
  },
});

export const n8n_projects_add_users = createTool({
  id: "agent_n8n_projects_add_users",
  description: "Add users to a project: POST /api/v1/projects/{projectId}/users.",
  inputSchema: z.object({
    projectId: z.string(),
    relations: z.array(z.object({ userId: z.string(), role: z.string() })),
  }),
  execute: async (args, options) => {
    const { projectId, relations } = args.context;
    return await n8nFetch(args.runtimeContext, `/api/v1/projects/${encodeURIComponent(projectId)}/users`, { method: "POST", body: JSON.stringify({ relations }) }, options?.abortSignal);
  },
});

export const n8n_projects_delete_user = createTool({
  id: "agent_n8n_projects_delete_user",
  description: "Remove user from project: DELETE /api/v1/projects/{projectId}/users/{userId}.",
  inputSchema: z.object({ projectId: z.string(), userId: z.string() }),
  execute: async (args, options) => {
    const { projectId, userId } = args.context;
    return await n8nFetch(args.runtimeContext, `/api/v1/projects/${encodeURIComponent(projectId)}/users/${encodeURIComponent(userId)}`, { method: "DELETE" }, options?.abortSignal);
  },
});

export const n8n_projects_change_user_role = createTool({
  id: "agent_n8n_projects_change_user_role",
  description: "Change user's role in project: PATCH /api/v1/projects/{projectId}/users/{userId}.",
  inputSchema: z.object({ projectId: z.string(), userId: z.string(), role: z.string() }),
  execute: async (args, options) => {
    const { projectId, userId, role } = args.context;
    return await n8nFetch(args.runtimeContext, `/api/v1/projects/${encodeURIComponent(projectId)}/users/${encodeURIComponent(userId)}`, { method: "PATCH", body: JSON.stringify({ role }) }, options?.abortSignal);
  },
});
*/

// ------------- Workflow Activation (may depend on n8n version/config) -------------
export const n8n_workflow_activate = createTool({
  id: "agent_n8n_workflow_activate",
  description: "Activate a workflow: POST /api/v1/workflows/{id}/activate. Marks the workflow as active so triggers/schedules run. Note: Some n8n instances or MCP docs may restrict activation via API.",
  inputSchema: z.object({ id: z.string().optional().describe("Workflow ID") }),
  execute: async (args, options) => {
    // Try read id from args or runtimeContext (e.g., set by MCP/agent into working memory mirror)
    const rc = args.runtimeContext as any;
    const fromArgs = (args?.context as any)?.id as string | undefined;
    const fromRc = typeof rc?.get === 'function' ? (rc.get('workflow_id') as string | undefined) : undefined;
    const id = fromArgs || fromRc;
    if (!id) {
      return {
        ok: false,
        status: 400,
        message: "Workflow ID is required to activate. Retrieve it first via MCP and store it in working memory.",
        hint: "Use MCP to list/find workflows and write the ID to working memory (and optionally to runtimeContext as 'workflow_id').",
      } as any;
    }
    return await n8nFetch(args.runtimeContext, `/api/v1/workflows/${encodeURIComponent(id)}/activate`, { method: "POST" }, options?.abortSignal);
  },
});

export const n8n_workflow_deactivate = createTool({
  id: "agent_n8n_workflow_deactivate",
  description: "Deactivate a workflow: POST /api/v1/workflows/{id}/deactivate. Disables triggers/schedules. Use before making major edits or when pausing automation.",
  inputSchema: z.object({ id: z.string().optional().describe("Workflow ID") }),
  execute: async (args, options) => {
    const rc = args.runtimeContext as any;
    const fromArgs = (args?.context as any)?.id as string | undefined;
    const fromRc = typeof rc?.get === 'function' ? (rc.get('workflow_id') as string | undefined) : undefined;
    const id = fromArgs || fromRc;
    if (!id) {
      return {
        ok: false,
        status: 400,
        message: "Workflow ID is required to deactivate. Retrieve it first via MCP and store it in working memory.",
        hint: "Use MCP to list/find workflows and write the ID to working memory (and optionally to runtimeContext as 'workflow_id').",
      } as any;
    }
    return await n8nFetch(args.runtimeContext, `/api/v1/workflows/${encodeURIComponent(id)}/deactivate`, { method: "POST" }, options?.abortSignal);
  },
});

export const n8nProTools = {
  // Hidden: credentials_list tool
  agent_n8n_credentials_get: n8n_credentials_get,
  agent_n8n_credentials_create: n8n_credentials_create,
  agent_n8n_credentials_update: n8n_credentials_update,
  agent_n8n_credentials_delete: n8n_credentials_delete,
  // Hidden: variables/tags/source-control tools
  agent_n8n_audit_generate: n8n_audit_generate,
  agent_n8n_credentials_get_type_schema: n8n_credentials_get_type_schema,
  agent_n8n_credentials_transfer: n8n_credentials_transfer,
  // Hidden: projects tools
  agent_n8n_workflow_activate: n8n_workflow_activate,
  agent_n8n_workflow_deactivate: n8n_workflow_deactivate,
};


