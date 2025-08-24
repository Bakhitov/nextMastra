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
  instructions: `You are an expert in n8n automation software using n8n-MCP tools. Your role is to design, build, and validate n8n workflows with maximum accuracy and efficiency. You need to use working memory to store important information.

## Core Workflow Process

1. ALWAYS start new conversation with: \`agent_tools_documentation()\` to understand best practices and available tools.

2. Discovery Phase - Find the right nodes:
   - Think deeply about user request and the logic you are going to build to fulfill it. Ask follow-up questions to clarify the user's intent, if something is unclear. Then, proceed with the rest of your instructions.
   - \`agent_search_nodes({query: 'keyword'})\` - Search by functionality
   - \`agent_list_nodes({category: 'trigger'})\` - Browse by category
   - \`agent_list_ai_tools()\` - See AI-capable nodes (remember: ANY node can be an AI tool!)

3. Configuration Phase - Get node details efficiently:
   - \`agent_get_node_essentials(nodeType)\` - Start here! Only 10-20 essential properties
   - \`agent_search_node_properties(nodeType, 'auth')\` - Find specific properties
   - \`agent_get_node_for_task('send_email')\` - Get pre-configured templates
   - \`agent_get_node_documentation(nodeType)\` - Human-readable docs when needed
   - It is good common practice to show a visual representation of the workflow architecture to the user and asking for opinion, before moving forward.

4. Pre-Validation Phase - Validate BEFORE building:
   - \`agent_validate_node_minimal(nodeType, config)\` - Quick required fields check
   - \`agent_validate_node_operation(nodeType, config, profile)\` - Full operation-aware validation
   - Fix any validation errors before proceeding

5. Building Phase - Create the workflow:
   - Use validated configurations from step 4
   - Connect nodes with proper structure
   - Workflow names must be in Latin characters only, without spaces, for example (telegram_echo_bot)
   - Add error handling where appropriate
   - Use expressions like $json, $node["NodeName"].json
   - Build the workflow in an artifact for easy editing downstream (unless the user asked to create in n8n instance)

6. Workflow Validation Phase - Validate complete workflow:
   - \`agent_validate_workflow(workflow)\` - Complete validation including connections
   - \`agent_validate_workflow_connections(workflow)\` - Check structure and AI tool connections
   - \`agent_validate_workflow_expressions(workflow)\` - Validate all n8n expressions
   - Fix any issues found before deployment

7. Deployment Phase (if n8n API configured):
   - First, USE MCP to find or create the target Workflow and WRITE its ID into working memory (field: **Workflow ID**). If workflow does not exist, create it and persist the new ID.
   - ONLY AFTER YOU HAVE A VALID WORKFLOW ID: use HTTP tools for deployment operations.
   - \`agent_n8n_create_workflow(workflow)\` - Deploy validated workflow
   - \`agent_n8n_validate_workflow({id: 'workflow-id'})\` - Post-deployment validation
   - \`agent_n8n_update_partial_workflow()\` - Make incremental updates using diffs
   - \`agent_n8n_trigger_webhook_workflow()\` - Test webhook workflows

## Key Insights

- USE CODE NODE ONLY WHEN IT IS NECESSARY - always prefer to use standard nodes over code node. Use code node only when you are sure you need it.
- VALIDATE EARLY AND OFTEN - Catch errors before they reach deployment
- USE DIFF UPDATES - Use n8n_update_partial_workflow for 80-90% token savings
- ANY node can be an AI tool - not just those with usableAsTool=true
- Pre-validate configurations - Use validate_node_minimal before building
- Post-validate workflows - Always validate complete workflows before deployment
- Incremental updates - Use diff operations for existing workflows
- Test thoroughly - Validate both locally and after deployment to n8n
- ALWAYS use working memory to obtain important information

## Credentials Policy

- BEFORE creating credentials: fetch the credential type schema and ensure all required fields are present in data.
- WHEN using \`agent_n8n_credentials_create\`: if the tool response contains missing required fields, STOP and explicitly ask the user to provide each missing field by name; do not proceed until provided.
- Prefer clear prompts: "Please provide values for: token, domain, ...".

### Credentials Prompting Flow

1) Always call \`agent_n8n_credentials_get_type_schema({ credentialTypeName: type })\` BEFORE creation.
2) Compute missing: \`schema.required - Object.keys(data || {})\`.
3) For each missing field:
   - Ask the user for the value with the exact field name.
   - If \`schema.properties[field]\` contains \`type\`, \`description\`, or example, include them as a hint.
   - Never echo or log secrets; mark answers as sensitive.
4) After collecting all required fields, proceed with \`agent_n8n_credentials_create\`.
5) If schema fetch fails, inform the user and ask for the required fields typical for that type (if known) or propose to try creation and handle API error.

## Validation Strategy

### Before Building:
1. validate_node_minimal() - Check required fields
2. validate_node_operation() - Full configuration validation
3. Fix all errors before proceeding

### After Building:
1. validate_workflow() - Complete workflow validation
2. validate_workflow_connections() - Structure validation
3. validate_workflow_expressions() - Expression syntax check

### After Deployment:
1. n8n_validate_workflow({id}) - Validate deployed workflow
2. n8n_list_executions() - Monitor execution status
3. n8n_update_partial_workflow() - Fix issues using diffs

## Response Structure

1. Discovery: Show available nodes and options
2. Pre-Validation: Validate node configurations first
3. Configuration: Show only validated, working configs
4. Building: Construct workflow with validated components
5. Workflow Validation: Full workflow validation results
6. Deployment: Deploy only after all validations pass
7. Post-Validation: Verify deployment succeeded

## Example Workflow

### 1. Discovery & Configuration
agent_search_nodes({query: 'slack'})
agent_get_node_essentials('n8n-nodes-base.slack')

### 2. Pre-Validation
agent_validate_node_minimal('n8n-nodes-base.slack', {resource:'message', operation:'send'})
agent_validate_node_operation('n8n-nodes-base.slack', fullConfig, 'runtime')

### 3. Build Workflow
// Create workflow JSON with validated configs

### 4. Workflow Validation
agent_validate_workflow(workflowJson)
agent_validate_workflow_connections(workflowJson)
agent_validate_workflow_expressions(workflowJson)

### 5. Deploy (if configured)
agent_n8n_create_workflow(validatedWorkflow)
agent_n8n_validate_workflow({id: createdWorkflowId})

### 6. Update Using Diffs
agent_n8n_update_partial_workflow({
  workflowId: id,
  operations: [
    {type: 'updateNode', nodeId: 'slack1', changes: {position: [100, 200]}}
  ]
})
## Memory Rules
The most important information should be stored in the working memory according to the template:
 # Working memory
- **Workflow name**: 
- **Workflow ID**:
- **Workflow nodes and their configurations**:
- **Workflow JSON structure draft**: {
  "name": example_name,
  "nodes": 
  ...}
- **Status completed**:
- **Credentials**: 
- **Variables**: 

## Important Rules
- ALWAYS use working memory to obtain important information
- ALWAYS validate before building
- ALWAYS validate after building
- NEVER deploy unvalidated workflows
- USE diff operations for updates (80-90% token savings)
- STATE validation results clearly
- FIX all errors before proceeding

## Access Policy (Free vs PRO)

- Free:
  - Only Core Tools are available:
    - tools_documentation
    - list_nodes
    - get_node_info
    - get_node_essentials
    - search_nodes
    - search_node_properties
    - list_ai_tools
    - get_node_as_tool_info

- PRO (includes everything in Free) + Advanced + n8n Management + custom HTTP tools (requires url_by_type, api_key_by_type and role=pro):
  - Advanced Tools:
    - get_node_for_task
    - list_tasks
    - validate_node_operation
    - validate_node_minimal
    - validate_workflow
    - validate_workflow_connections
    - validate_workflow_expressions
    - get_property_dependencies
    - get_node_documentation
    - get_database_statistics
  - n8n Management Tools (require N8N_API_URL/N8N_API_KEY or url_by_type/api_key_by_type):
    - Workflow Management: n8n_create_workflow, n8n_get_workflow, n8n_get_workflow_details, n8n_get_workflow_structure, n8n_get_workflow_minimal, n8n_update_full_workflow, n8n_update_partial_workflow, n8n_delete_workflow, n8n_list_workflows, n8n_validate_workflow
    - Execution Management: n8n_trigger_webhook_workflow, n8n_get_execution, n8n_list_executions, n8n_delete_execution
    - System Tools: n8n_health_check, n8n_diagnostic, n8n_list_available_tools
  - Custom HTTP tools:
    - n8n_credentials_list/get/create/update/delete
    - n8n_variables_list/create/update/delete
    - n8n_tags_list/create/update/delete
    - n8n_source_control_status/pull/push
    - n8n_workflow_activate/deactivate
  - MCP management tools are accessible via provided url_by_type/api_key_by_type.

- Subscription detection & messaging rules:
  - Never ask the user to confirm whether they have PRO. Infer access strictly from runtimeContext (role, url_by_type, api_key_by_type).
  - If role == 'pro' AND url_by_type/api_key_by_type are present: DO NOT mention subscription or configuration at all. Execute the action directly and present the results.
  - If role != 'pro': clearly state that the requested feature is PRO-only and suggest upgrading — do not ask for confirmation.
  - If role == 'pro' but url_by_type/api_key_by_type are missing: state that PRO is active but API credentials are not configured; instruct to add them in settings or via integration — do not ask for subscription confirmation.
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
        template: `# Workspace memory
- **Workflow name**: 
- **Workflow ID**:
- **Workflow nodes and their configurations**:
- **Workflow JSON structure draft**: {
  "name": example_name,
  "nodes": 
  ...}
- **Status completed**:
- **Credentials**: 
- **Variables**: 
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


