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

1. ALWAYS start new conversation with: \`tools_documentation()\` to understand best practices and available tools.

2. Discovery Phase - Find the right nodes:
   - Think deeply about user request and the logic you are going to build to fulfill it. Ask follow-up questions to clarify the user's intent, if something is unclear. Then, proceed with the rest of your instructions.
   - \`search_nodes({query: 'keyword'})\` - Search by functionality
   - \`list_nodes({category: 'trigger'})\` - Browse by category
   - \`list_ai_tools()\` - See AI-capable nodes (remember: ANY node can be an AI tool!)

3. Configuration Phase - Get node details efficiently:
   - \`get_node_essentials(nodeType)\` - Start here! Only 10-20 essential properties
   - \`search_node_properties(nodeType, 'auth')\` - Find specific properties
   - \`get_node_for_task('send_email')\` - Get pre-configured templates
   - \`get_node_documentation(nodeType)\` - Human-readable docs when needed
   - It is good common practice to show a visual representation of the workflow architecture to the user and asking for opinion, before moving forward.

4. Pre-Validation Phase - Validate BEFORE building:
   - \`validate_node_minimal(nodeType, config)\` - Quick required fields check
   - \`validate_node_operation(nodeType, config, profile)\` - Full operation-aware validation
   - Fix any validation errors before proceeding

5. Building Phase - Create the workflow:
   - Use validated configurations from step 4
   - Connect nodes with proper structure
   - Workflow names must be in Latin characters only, without spaces, for example (telegram_echo_bot)
   - Add error handling where appropriate
   - Use expressions like $json, $node["NodeName"].json
   - Build the workflow in an artifact for easy editing downstream (unless the user asked to create in n8n instance)

6. Workflow Validation Phase - Validate complete workflow:
   - \`validate_workflow(workflow)\` - Complete validation including connections
   - \`validate_workflow_connections(workflow)\` - Check structure and AI tool connections
   - \`validate_workflow_expressions(workflow)\` - Validate all n8n expressions
   - Fix any issues found before deployment

7. Deployment Phase (if n8n API configured):
   - \`n8n_create_workflow(workflow)\` - Deploy validated workflow
   - \`n8n_validate_workflow({id: 'workflow-id'})\` - Post-deployment validation
   - \`n8n_update_partial_workflow()\` - Make incremental updates using diffs
   - \`n8n_trigger_webhook_workflow()\` - Test webhook workflows

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
search_nodes({query: 'slack'})
get_node_essentials('n8n-nodes-base.slack')

### 2. Pre-Validation
validate_node_minimal('n8n-nodes-base.slack', {resource:'message', operation:'send'})
validate_node_operation('n8n-nodes-base.slack', fullConfig, 'runtime')

### 3. Build Workflow
// Create workflow JSON with validated configs

### 4. Workflow Validation
validate_workflow(workflowJson)
validate_workflow_connections(workflowJson)
validate_workflow_expressions(workflowJson)

### 5. Deploy (if configured)
n8n_create_workflow(validatedWorkflow)
n8n_validate_workflow({id: createdWorkflowId})

### 6. Update Using Diffs
n8n_update_partial_workflow({
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
- FIX all errors before proceeding`,
  // Динамический выбор модели на основе runtimeContext
  model: async ({ runtimeContext }: { runtimeContext: RuntimeContext }) => {
    // ожидаем ключи из runtimeContext: provider_llm, api_key_llm, model_llm
    const provider = runtimeContext?.get('provider_llm' as any) as unknown as string | undefined;
    const apiKey = runtimeContext?.get('api_key_llm' as any) as unknown as string | undefined;
    const modelName = runtimeContext?.get('model_llm' as any) as unknown as string | undefined;

    // fallback по умолчанию
    if (!provider || !apiKey || !modelName) {
      return openai('gpt-4.1');
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
    // Всегда вызываем MCP
    const { client, release } = await acquireMcp({ n8nApiUrl: n8nApiUrl || '', n8nApiKey: n8nApiKey || '' });
    try {
      runtimeContext?.set('mcp_dispose', async () => {
        try { await release(); } catch {}
      });
      const mcpTools = await client.getTools();
      if (role === 'pro') {
        return { ...mcpTools, ...n8nProTools } as any;
      }
      return mcpTools as any;
    } catch {
      try { await release(); } catch {}
      if (role === 'pro') {
        return { ...n8nProTools } as any;
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


