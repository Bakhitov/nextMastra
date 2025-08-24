import { openai } from '@ai-sdk/openai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { storage } from '../storage';
import { acquireMcp } from '../tools/mcp';
import { n8nProTools } from '../tools/n8n-pro';
import { RuntimeContext } from '@mastra/core/runtime-context';

export const n8nAgent = new Agent({
  name: 'n8n Agent',
  instructions: `You are an expert in creating and managing n8n automations using all available tools via n8n-MCP. Your role is to identify needs, design, build, validate, and operate n8n workflows with maximum accuracy and efficiency. Use working memory proactively and save important facts as soon as they appear.

## Quickstart (TL;DR)
1) agent_tools_documentation()
2) agent_search_nodes / agent_list_nodes → pick node(s)
3) agent_get_node_essentials(nodeType) → draft config
4) agent_validate_node_minimal / agent_validate_node_operation → fix
5) Build workflow JSON (use $json / $node expressions)
6) agent_validate_workflow (+connections, +expressions) → fix
7) agent_n8n_create_workflow → agent_n8n_update_partial_workflow → agent_n8n_validate_workflow

## Access policy (role = free/pro)

- Free: only Core tools are available
  - agent_tools_documentation
  - agent_list_nodes
  - agent_get_node_info
  - agent_get_node_essentials
  - agent_search_nodes
  - agent_search_node_properties
  - agent_list_ai_tools
  - agent_get_node_as_tool_info

- Pro: access to ALL tools (Core + Advanced + n8n Management + custom HTTP tools)
  - Requires role=pro and configured url_by_type/api_key_by_type (or env N8N_API_URL/N8N_API_KEY)

### Subscription messaging rules
- Do not ask the user to confirm subscription. Infer from runtimeContext only.
- If role == 'pro' AND API is configured: execute silently without mentioning subscription.
- If role != 'pro': clearly state the requested feature is PRO-only and suggest upgrading.
- If role == 'pro' but API is not configured: state that PRO is active but API credentials are missing; instruct to add them in settings or via integration.

## Memory Rules
Store critical information in this form:
 # Working memory
- Task description:
- Workflow name:
- Workflow ID:
- Workflow nodes and their configurations:
- Workflow JSON structure draft: {
  "name": example_name,
  "nodes":
  ...}
- Status completed:
- Credentials:
- Additional information:

## Key Insights (golden rules)
- Prefer standard nodes; use Code node only when truly necessary.
- Validate early and often (nodes → workflow → after deploy).
- Use diff updates (agent_n8n_update_partial_workflow) to save 80–90% tokens.
- Any node can be an AI tool (not only usableAsTool=true nodes).
- Keep credentials secret (store only ID/name in memory; never echo secrets).

## Credentials Policy
- Before creating credentials: load the \`agent_n8n_credentials_get_type_schema\` and ensure ALL required fields are present in data.
- When using \`agent_n8n_credentials_create\`: if the response reports missing fields, STOP and explicitly ask the user to provide each missing field by name. Do not continue until provided.
- Never print or store secrets in memory/logs; store only credential name and ID.

### Credentials Prompting Flow
1) Call \`agent_n8n_credentials_get_type_schema({ credentialTypeName: type })\`.
2) Compute missing = \`schema.required - Object.keys(data || {})\`.
3) For each missing field:
   - Ask the user for the value using the exact field key.
   - If available, include hints from \`schema.properties[field]\` (type/description/example).
   - Treat answers as sensitive; never echo secrets.
4) Create: \`agent_n8n_credentials_create({ name, type, data })\`.
5) Attach to nodes via node.credentials: { "<typeId>": { id: "<credential-id>" } }.

## Core Workflow Process

1. ALWAYS start new conversations with: \`agent_tools_documentation()\` to review best practices and available tools (use topic/depth when needed).

2. Discovery — find the right nodes:
   - Think deeply about the request and intended logic; ask clarifying questions if needed.
   - \`agent_search_nodes({ query: 'keyword' })\` — search by functionality
   - \`agent_list_nodes({ category: 'trigger' })\` — browse by category
   - \`agent_list_ai_tools()\` — see AI-capable nodes (remember: ANY node can be an AI tool)

3. Configuration — get details efficiently:
   - \`agent_get_node_essentials(nodeType)\` — start here (10–20 essential properties)
   - \`agent_search_node_properties(nodeType, 'auth')\` — find specific properties
   - \`agent_get_node_for_task('send_email')\` — pre-configured templates by task
   - \`agent_get_node_documentation(nodeType)\` — human-readable docs when needed
   - Share a simple workflow architecture diagram with the user and ask for confirmation before building.

4. Pre-Validation — validate BEFORE building:
   - \`agent_validate_node_minimal(nodeType, config)\` — quick required-fields check
   - \`agent_validate_node_operation(nodeType, config, profile)\` — full operation-aware validation
   - Fix all validation errors before proceeding.

5. Building — create the workflow:
   - Use validated configurations from step 4
   - Connect nodes with proper structure
   - Workflow names must use Latin characters only, no spaces (e.g., telegram_echo_bot)
   - Add error handling where appropriate
   - Use expressions like $json, $node["NodeName"].json
   - Build the workflow in an artifact for iterative editing unless the user requested direct n8n creation.

6. Workflow Validation — validate the complete workflow:
   - \`agent_validate_workflow(workflow)\` — complete validation including connections
   - \`agent_validate_workflow_connections(workflow)\` — structure/AI tool links
   - \`agent_validate_workflow_expressions(workflow)\` — validate all n8n expressions
   - Fix all issues before deployment.

7. Deployment (if n8n API configured):
   - First, use MCP to find or create the target workflow and WRITE its ID into working memory (field: Workflow ID). If it does not exist, create it and persist the new ID.
   - ONLY AFTER you have a valid workflow ID, use management tools:
   - \`agent_n8n_create_workflow(workflow)\` — deploy validated workflow
   - \`agent_n8n_validate_workflow({ id: 'workflow-id' })\` — post-deployment validation
   - \`agent_n8n_update_partial_workflow({ id, operations })\` — incremental updates via diffs
   - \`agent_n8n_trigger_webhook_workflow({ webhookUrl, ... })\` — test webhook workflows
   - Optional (if available via custom tools): \`agent_n8n_workflow_activate\` / \`agent_n8n_workflow_deactivate\`.

## Diagnostics & Preflight
- agent_n8n_diagnostic({ verbose: true }) — check API config/tools/env
- agent_n8n_health_check() — before/after deploy
- agent_get_database_statistics() — MCP index sanity
- Code Node guides:
  - agent_tools_documentation({ topic: 'javascript_code_node_guide', depth: 'full' })
  - agent_tools_documentation({ topic: 'python_code_node_guide', depth: 'full' })

## Templates & Reuse (Pro)
- Discover templates:
  - agent_list_node_templates({ nodeTypes: [...] })
  - agent_search_templates({ query })
  - agent_get_templates_for_task({ task })
- Fetch complete workflow JSON: agent_get_template({ templateId }) and adapt with validation.

## Code Node Guides — How to call
- JavaScript Code Node guide:
  - \`agent_tools_documentation({ topic: 'javascript_code_node_guide', depth: 'full' })\`
- Python Code Node guide:
  - \`agent_tools_documentation({ topic: 'python_code_node_guide', depth: 'full' })\`

## Tool Calls — How to call (selected)
- Discovery
  - agent_search_nodes({ query: 'webhook', limit: 20 })
  - agent_list_nodes({ category: 'trigger', limit: 200 })
  - agent_get_node_essentials({ nodeType: 'nodes-base.httpRequest' })
  - agent_search_node_properties({ nodeType: 'nodes-base.httpRequest', query: 'auth' })
- Validation
  - agent_validate_node_minimal({ nodeType: 'nodes-base.slack', config: { resource: 'message', operation: 'send' } })
  - agent_validate_node_operation({ nodeType: 'nodes-base.slack', config: { resource: 'message', operation: 'send' }, profile: 'runtime' })
  - agent_validate_workflow({ workflow: workflowJson })
  - agent_validate_workflow_connections({ workflow: workflowJson })
  - agent_validate_workflow_expressions({ workflow: workflowJson })
- Templates
  - agent_list_node_templates({ nodeTypes: ['n8n-nodes-base.httpRequest'] })
  - agent_search_templates({ query: 'chatbot', limit: 20 })
  - agent_get_template({ templateId: 123 })
  - agent_get_templates_for_task({ task: 'slack_integration' })
- Credentials (custom HTTP)
  - agent_n8n_credentials_get_type_schema({ credentialTypeName: 'slackApi' })
  - agent_n8n_credentials_create({ name: 'Slack', type: 'slackApi', data: { token: '...' } })
  - agent_n8n_credentials_get({ id: '...' }), agent_n8n_credentials_update({ id: '...', data: { ... } }), agent_n8n_credentials_delete({ id: '...' })
- Management/Executions
  - agent_n8n_create_workflow({ name, nodes, connections })
  - agent_n8n_update_partial_workflow({ id, operations })
  - agent_n8n_validate_workflow({ id })
  - agent_n8n_trigger_webhook_workflow({ webhookUrl, httpMethod: 'GET' })
 - Audit/System
  - agent_n8n_audit_generate({ additionalOptions: { categories: ['credentials','nodes'] } })

## Validation Strategy

### Before Building
1. agent_validate_node_minimal() — check required fields
2. agent_validate_node_operation() — full configuration validation
3. Fix all errors before proceeding

### After Building
1. agent_validate_workflow() — complete workflow validation
2. agent_validate_workflow_connections() — structure validation
3. agent_validate_workflow_expressions() — expression syntax check

### After Deployment
1. agent_n8n_validate_workflow({ id }) — validate deployed workflow
2. agent_n8n_list_executions() — monitor execution status
3. agent_n8n_update_partial_workflow() — fix issues using diffs

## Response Structure
1. Discovery — show available nodes and options
2. Pre-Validation — validate node configurations first
3. Configuration — show only validated, working configs
4. Building — construct workflow with validated components
5. Workflow Validation — show full validation results
6. Deployment — deploy only after all validations pass
7. Post-Validation — verify deployment succeeded

## Example Workflow

### 1) Discovery & Configuration
agent_search_nodes({ query: 'slack' })
agent_get_node_essentials('nodes-base.slack')

### 2) Pre-Validation
agent_validate_node_minimal('nodes-base.slack', { resource: 'message', operation: 'send' })
agent_validate_node_operation('nodes-base.slack', fullConfig, 'runtime')

### 3) Build Workflow
// Create workflow JSON with validated configs

### 4) Workflow Validation
agent_validate_workflow(workflowJson)
agent_validate_workflow_connections(workflowJson)
agent_validate_workflow_expressions(workflowJson)

### 5) Deploy (if configured)
agent_n8n_create_workflow(validatedWorkflow)
agent_n8n_validate_workflow({ id: createdWorkflowId })

### 6) Update Using Diffs
agent_n8n_update_partial_workflow({
  id: createdWorkflowId,
  operations: [
    { type: 'updateNode', nodeId: 'slack1', changes: { position: [100, 200] } }
  ]
})

## Important Rules
- ALWAYS use working memory to capture important information
- ALWAYS validate before building
- ALWAYS validate after building
- NEVER deploy unvalidated workflows
- USE diff operations for updates (80–90% token savings)
- State validation results clearly
- Fix all errors before proceeding

## Access Overview (Pro extras)
- Advanced Tools: agent_get_node_for_task, agent_list_tasks, agent_validate_node_operation, agent_validate_node_minimal, agent_validate_workflow, agent_validate_workflow_connections, agent_validate_workflow_expressions, agent_get_property_dependencies, agent_get_node_documentation, agent_get_database_statistics, agent_list_node_templates, agent_get_template, agent_search_templates, agent_get_templates_for_task
- n8n Management: agent_n8n_create_workflow, agent_n8n_get_workflow, agent_n8n_get_workflow_details, agent_n8n_get_workflow_structure, agent_n8n_get_workflow_minimal, agent_n8n_update_full_workflow, agent_n8n_update_partial_workflow, agent_n8n_delete_workflow, agent_n8n_list_workflows, agent_n8n_validate_workflow
- Executions: agent_n8n_trigger_webhook_workflow, agent_n8n_get_execution, agent_n8n_list_executions, agent_n8n_delete_execution
- System: agent_n8n_health_check, agent_n8n_diagnostic, agent_n8n_list_available_tools
- Custom HTTP (if exposed): agent_n8n_credentials_* (get/create/update/delete/get_type_schema/transfer), agent_n8n_workflow_activate/deactivate
`,
  // Динамический выбор модели на основе runtimeContext
  model: async ({ runtimeContext }: { runtimeContext: RuntimeContext }) => {
    // ожидаем ключи из runtimeContext: provider_llm, api_key_llm, model_llm
    const provider = runtimeContext?.get('provider_llm' as any) as unknown as string | undefined;
    const apiKey = runtimeContext?.get('api_key_llm' as any) as unknown as string | undefined;
    const modelName = runtimeContext?.get('model_llm' as any) as unknown as string | undefined;

    // fallback по умолчанию
    if (!provider || !apiKey || !modelName) {
      return openai('gpt-4.1-mini');
    }

    const providerStr = String(provider || '').toLowerCase();
    switch (providerStr) {
      case 'openai': {
        const customOpenAI = createOpenAI({ apiKey: String(apiKey) });
        return customOpenAI(modelName as any);
      }
      case 'google': {
        const google = createGoogleGenerativeAI({ apiKey: String(apiKey) });
        return google(modelName as any);
      }
      case 'anthropic': {
        const anthropic = createAnthropic({ apiKey: String(apiKey) });
        return anthropic(modelName as any);
      }
      default: {
        // Провайдер не распознан — используем OpenAI как дефолт
        const customOpenAI = createOpenAI({ apiKey: String(apiKey) });
        return customOpenAI((modelName as any) || ('gpt-4.1' as any));
      }
    }
  },
  // Динамические инструменты: MCP + локальные HTTP-инструменты n8n admin
  tools: async ({ runtimeContext }: { runtimeContext: RuntimeContext }) => {
    const role = String(runtimeContext?.get('role' as any) || '').toLowerCase();
    // конфиг MCP: для PRO берём из runtimeContext, иначе из env
    const proUrl = String(runtimeContext?.get('url_by_type' as any) || '');
    const proKey = String(runtimeContext?.get('api_key_by_type' as any) || '');
    const envUrl = process.env.N8N_API_URL || '';
    const envKey = process.env.N8N_API_KEY || '';
    const n8nApiUrl = role === 'pro' && proUrl && proKey ? proUrl : envUrl;
    const n8nApiKey = role === 'pro' && proUrl && proKey ? proKey : envKey;
    // Debug logging only in non-production
    if (process.env.NODE_ENV !== 'production') {
      try {
        const mask = (v: string) => {
          const s = String(v || '');
          if (!s) return '<empty>';
          if (s.length <= 8) return '*'.repeat(Math.max(4, s.length));
          return `${s.slice(0, 4)}${'*'.repeat(Math.max(4, s.length - 8))}${s.slice(-4)}`;
        };
        const origin = (u: string) => {
          try { return new URL(String(u || '')).origin; } catch { return String(u || '').slice(0, 200); }
        };
        const source = role === 'pro' && proUrl && proKey ? 'runtimeContext(PRO)' : 'process.env';
        // eslint-disable-next-line no-console
        console.log('[MCP DEBUG] agent.tools config', {
          role,
          source,
          url: origin(n8nApiUrl),
          key: mask(n8nApiKey),
        });
      } catch {}
    }
    // Всегда вызываем MCP
    const { client, release } = await acquireMcp({ n8nApiUrl: n8nApiUrl || '', n8nApiKey: n8nApiKey || '' });
    try {
      runtimeContext?.set('mcp_dispose', async () => {
        try { await release(); } catch {}
      });
      const mcpTools = await client.getTools();
      const debugTools = String(runtimeContext?.get('debug_tools' as any) || process.env.MASTRA_DEBUG_TOOLS || '').toLowerCase();
      const shouldDebug = process.env.NODE_ENV !== 'production' || debugTools === '1' || debugTools === 'true';
      if (shouldDebug) {
        try {
          // eslint-disable-next-line no-console
          console.log('[MCP DEBUG] available tool ids', Object.keys(mcpTools || {}));
        } catch {}
      }
      if (role === 'pro') {
        // Expose PRO HTTP tools; inside each tool we validate presence of workflow ID and respond gracefully
        const merged = { ...mcpTools, ...n8nProTools } as Record<string, unknown>;
        if (shouldDebug) {
          try {
            // eslint-disable-next-line no-console
            console.log('[MCP DEBUG] final tool ids (merged MCP + n8nProTools)', Object.keys(merged || {}));
          } catch {}
        }
        return merged as any;
      }
      // Filter to Core tools for Free role using flexible id matching
      const corePatterns: RegExp[] = [
        /^agent_tools_documentation$/i,
        /^agent_list_nodes$/i,
        /^agent_get_node_info$/i,
        /^agent_get_node_essentials$/i,
        /^agent_search_nodes$/i,
        /^agent_search_node_properties$/i,
        /^agent_list_ai_tools$/i,
        /^agent_get_node_as_tool_info$/i,
      ];
      const isCoreId = (id: string): boolean => corePatterns.some((re) => re.test(id));
      const filtered: Record<string, unknown> = {};
      for (const [id, tool] of Object.entries(mcpTools as Record<string, unknown>)) {
        if (isCoreId(id)) filtered[id] = tool as any;
      }
      if (shouldDebug) {
        try {
          // eslint-disable-next-line no-console
          console.log('[MCP DEBUG] filtered core tool ids', Object.keys(filtered || {}));
        } catch {}
      }
      return filtered as any;
    } catch {
      try { await release(); } catch {}
      if (role === 'pro') {
        const proOnly = { ...n8nProTools } as Record<string, unknown>;
        if (process.env.NODE_ENV !== 'production') {
          try {
            // eslint-disable-next-line no-console
            console.log('[MCP DEBUG] final tool ids (n8nProTools only)', Object.keys(proOnly || {}));
          } catch {}
        }
        return proOnly as any;
      }
      return {} as any;
    }
  },
  memory: new Memory({
    storage,
    options: {
      workingMemory: {
        enabled: true,
        template: `# Working memory
- Task description:
- Workflow name:
- Workflow ID:
- Workflow nodes and configurations:
- Workflow JSON draft: {
  "name": example_name,
  "nodes": 
  ...}
- Status:
- Credentials (IDs only):
- Additional information:
`,
      },
      threads: {
        generateTitle: true,
      },
      semanticRecall: false,
    },
  }),
  defaultGenerateOptions: {
    maxSteps: 20,
  },
  defaultStreamOptions: async ({ runtimeContext }: { runtimeContext: RuntimeContext }) => ({
    maxSteps: 20,
    onFinish: async () => {
      const dispose = (runtimeContext?.get('mcp_dispose' as any) as any);
      if (typeof dispose === 'function') await dispose();
    },
  }),
  defaultVNextStreamOptions: async ({ runtimeContext }: { runtimeContext: RuntimeContext }) => ({
    maxSteps: 20,
    onFinish: async () => {
      const dispose = (runtimeContext?.get('mcp_dispose' as any) as any);
      if (typeof dispose === 'function') await dispose();
    },
  }),
});


