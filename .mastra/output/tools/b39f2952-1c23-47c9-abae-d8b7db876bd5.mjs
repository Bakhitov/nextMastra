import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

function resolveN8nConfig(runtimeContext) {
  const rcUrl = runtimeContext?.get("url_by_type") || process.env.N8N_API_URL || "";
  const rcKey = runtimeContext?.get("api_key_by_type") || process.env.N8N_API_KEY || "";
  if (!rcUrl || !rcKey) throw new Error("N8N API is not configured. Provide N8N_API_URL and N8N_API_KEY (or runtimeContext url_by_type/api_key_by_type).");
  const baseUrl = rcUrl.replace(/\/$/, "");
  const headers = {
    "Content-Type": "application/json",
    "X-N8N-API-KEY": rcKey
  };
  return { baseUrl, headers };
}
async function n8nFetch(runtimeContext, path, init = {}, abortSignal) {
  const { baseUrl, headers } = resolveN8nConfig(runtimeContext);
  const res = await fetch(`${baseUrl}${path}`, {
    method: init.method || "GET",
    headers: { ...headers, ...init.headers },
    body: init.body,
    signal: abortSignal
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`n8n API ${init.method || "GET"} ${path} failed: ${res.status} ${res.statusText} ${text}`);
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return await res.json();
  return await res.text();
}
const credentialsCreateSchema = z.object({
  name: z.string().describe("Credential name"),
  type: z.string().describe("n8n credential type ID, e.g. 'slackApi'"),
  data: z.record(z.any()).describe("Credential data object per n8n type schema"),
  nodesAccess: z.array(z.object({
    nodeType: z.string().optional(),
    allowNodes: z.array(z.string()).optional()
  })).optional().describe("Optional nodes access control")
});
const credentialsUpdateSchema = z.object({
  id: z.string().describe("Credential ID"),
  name: z.string().optional(),
  data: z.record(z.any()).optional(),
  nodesAccess: z.array(z.object({
    nodeType: z.string().optional(),
    allowNodes: z.array(z.string()).optional()
  })).optional()
});
const n8n_credentials_list = createTool({
  id: "n8n_credentials_list",
  description: "List credentials from n8n: GET /api/v1/credentials. Use to discover existing credentials before assigning them to nodes. Returns minimal metadata; sensitive fields are redacted by n8n.",
  inputSchema: z.object({}).optional(),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, "/api/v1/credentials", { method: "GET" }, options?.abortSignal);
  }
});
const n8n_credentials_get = createTool({
  id: "n8n_credentials_get",
  description: "Get credential by ID: GET /api/v1/credentials/{id}. Use to inspect a specific credential configuration. Sensitive data may be redacted depending on n8n settings.",
  inputSchema: z.object({ id: z.string().describe("Credential ID") }),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, `/api/v1/credentials/${encodeURIComponent(args.context.id)}`, { method: "GET" }, options?.abortSignal);
  }
});
const n8n_credentials_create = createTool({
  id: "n8n_credentials_create",
  description: "Create credential: POST /api/v1/credentials. Provide 'name', 'type' and 'data' according to the credential type schema (e.g. slackApi). Newly created credentials can be referenced by nodes using their name/ID.",
  inputSchema: credentialsCreateSchema,
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, "/api/v1/credentials", {
      method: "POST",
      body: JSON.stringify(args.context)
    }, options?.abortSignal);
  }
});
const n8n_credentials_update = createTool({
  id: "n8n_credentials_update",
  description: "Update credential (partial): PATCH /api/v1/credentials/{id}. Include only fields to change. Use to rotate secrets or rename credentials without recreating.",
  inputSchema: credentialsUpdateSchema,
  execute: async (args, options) => {
    const { id, ...body } = args.context;
    return await n8nFetch(args.runtimeContext, `/api/v1/credentials/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    }, options?.abortSignal);
  }
});
const n8n_credentials_delete = createTool({
  id: "n8n_credentials_delete",
  description: "Delete credential: DELETE /api/v1/credentials/{id}. Irreversible. Ensure no active workflows depend on it before deletion.",
  inputSchema: z.object({ id: z.string().describe("Credential ID") }),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, `/api/v1/credentials/${encodeURIComponent(args.context.id)}`, { method: "DELETE" }, options?.abortSignal);
  }
});
const variableCreateSchema = z.object({
  key: z.string().describe("Variable key"),
  value: z.string().describe("Variable value")
});
const variableUpdateSchema = z.object({
  id: z.string().describe("Variable ID"),
  key: z.string().optional(),
  value: z.string().optional()
});
const n8n_variables_list = createTool({
  id: "n8n_variables_list",
  description: "List variables: GET /api/v1/variables. Variables are global key/value pairs resolved in expressions. Use to audit available keys.",
  inputSchema: z.object({}).optional(),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, "/api/v1/variables", { method: "GET" }, options?.abortSignal);
  }
});
const n8n_variables_create = createTool({
  id: "n8n_variables_create",
  description: "Create variable: POST /api/v1/variables. Provide key and value. Use variables in expressions like {{$env.VAR}}/$json replacements depending on n8n version.",
  inputSchema: variableCreateSchema,
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, "/api/v1/variables", {
      method: "POST",
      body: JSON.stringify(args.context)
    }, options?.abortSignal);
  }
});
const n8n_variables_update = createTool({
  id: "n8n_variables_update",
  description: "Update variable (partial): PATCH /api/v1/variables/{id}. Change key and/or value. Consider workflow dependencies on variable names.",
  inputSchema: variableUpdateSchema,
  execute: async (args, options) => {
    const { id, ...body } = args.context;
    return await n8nFetch(args.runtimeContext, `/api/v1/variables/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    }, options?.abortSignal);
  }
});
const n8n_variables_delete = createTool({
  id: "n8n_variables_delete",
  description: "Delete variable: DELETE /api/v1/variables/{id}. Removing variables may break expressions in existing workflows.",
  inputSchema: z.object({ id: z.string().describe("Variable ID") }),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, `/api/v1/variables/${encodeURIComponent(args.context.id)}`, { method: "DELETE" }, options?.abortSignal);
  }
});
const tagCreateSchema = z.object({
  name: z.string().describe("Tag name")
});
const tagUpdateSchema = z.object({
  id: z.string().describe("Tag ID"),
  name: z.string().describe("New tag name")
});
const n8n_tags_list = createTool({
  id: "n8n_tags_list",
  description: "List tags: GET /api/v1/tags. Tags are labels for workflows; use them for organization and filtering.",
  inputSchema: z.object({}).optional(),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, "/api/v1/tags", { method: "GET" }, options?.abortSignal);
  }
});
const n8n_tags_create = createTool({
  id: "n8n_tags_create",
  description: "Create tag: POST /api/v1/tags. Use to add organizational labels for workflows.",
  inputSchema: tagCreateSchema,
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, "/api/v1/tags", {
      method: "POST",
      body: JSON.stringify(args.context)
    }, options?.abortSignal);
  }
});
const n8n_tags_update = createTool({
  id: "n8n_tags_update",
  description: "Update tag: PATCH /api/v1/tags/{id}. Rename existing tags; workflows linked to the tag will reflect the new name.",
  inputSchema: tagUpdateSchema,
  execute: async (args, options) => {
    const { id, ...body } = args.context;
    return await n8nFetch(args.runtimeContext, `/api/v1/tags/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    }, options?.abortSignal);
  }
});
const n8n_tags_delete = createTool({
  id: "n8n_tags_delete",
  description: "Delete tag: DELETE /api/v1/tags/{id}. Deleting a tag removes the label from associated workflows but does not delete the workflows.",
  inputSchema: z.object({ id: z.string().describe("Tag ID") }),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, `/api/v1/tags/${encodeURIComponent(args.context.id)}`, { method: "DELETE" }, options?.abortSignal);
  }
});
const n8n_source_control_status = createTool({
  id: "n8n_source_control_status",
  description: "Get source control status: GET /api/v1/source-control/status. Enterprise only. Returns repo status, branch, pending changes if configured.",
  inputSchema: z.object({}).optional(),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, "/api/v1/source-control/status", { method: "GET" }, options?.abortSignal);
  }
});
const n8n_source_control_pull = createTool({
  id: "n8n_source_control_pull",
  description: "Pull from remote repository: POST /api/v1/source-control/pull. Enterprise only. Syncs remote changes into the n8n project; use strategy to resolve conflicts when available.",
  inputSchema: z.object({
    branch: z.string().optional().describe("Optional branch to pull"),
    strategy: z.enum(["theirs", "ours"]).optional().describe("Merge strategy if applicable")
  }).optional(),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, "/api/v1/source-control/pull", {
      method: "POST",
      body: JSON.stringify(args.context || {})
    }, options?.abortSignal);
  }
});
const n8n_source_control_push = createTool({
  id: "n8n_source_control_push",
  description: "Push to remote repository: POST /api/v1/source-control/push. Enterprise only. Commits and pushes local changes; optionally set branch and message.",
  inputSchema: z.object({
    branch: z.string().optional().describe("Optional branch to push"),
    message: z.string().optional().describe("Commit message to use")
  }).optional(),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, "/api/v1/source-control/push", {
      method: "POST",
      body: JSON.stringify(args.context || {})
    }, options?.abortSignal);
  }
});
const n8n_workflow_activate = createTool({
  id: "n8n_workflow_activate",
  description: "Activate a workflow: POST /api/v1/workflows/{id}/activate. Marks the workflow as active so triggers/schedules run. Note: Some n8n instances or MCP docs may restrict activation via API.",
  inputSchema: z.object({ id: z.string().describe("Workflow ID") }),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, `/api/v1/workflows/${encodeURIComponent(args.context.id)}/activate`, { method: "POST" }, options?.abortSignal);
  }
});
const n8n_workflow_deactivate = createTool({
  id: "n8n_workflow_deactivate",
  description: "Deactivate a workflow: POST /api/v1/workflows/{id}/deactivate. Disables triggers/schedules. Use before making major edits or when pausing automation.",
  inputSchema: z.object({ id: z.string().describe("Workflow ID") }),
  execute: async (args, options) => {
    return await n8nFetch(args.runtimeContext, `/api/v1/workflows/${encodeURIComponent(args.context.id)}/deactivate`, { method: "POST" }, options?.abortSignal);
  }
});
const n8nProTools = {
  n8n_credentials_list,
  n8n_credentials_get,
  n8n_credentials_create,
  n8n_credentials_update,
  n8n_credentials_delete,
  n8n_variables_list,
  n8n_variables_create,
  n8n_variables_update,
  n8n_variables_delete,
  n8n_tags_list,
  n8n_tags_create,
  n8n_tags_update,
  n8n_tags_delete,
  n8n_source_control_status,
  n8n_source_control_pull,
  n8n_source_control_push,
  n8n_workflow_activate,
  n8n_workflow_deactivate
};

export { n8nProTools, n8n_credentials_create, n8n_credentials_delete, n8n_credentials_get, n8n_credentials_list, n8n_credentials_update, n8n_source_control_pull, n8n_source_control_push, n8n_source_control_status, n8n_tags_create, n8n_tags_delete, n8n_tags_list, n8n_tags_update, n8n_variables_create, n8n_variables_delete, n8n_variables_list, n8n_variables_update, n8n_workflow_activate, n8n_workflow_deactivate };
