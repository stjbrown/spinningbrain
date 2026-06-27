import { Agent } from '@mastra/core/agent'
import { spinSystemPrompt } from '../prompts/spin-system-prompt'
import { firecrawlTools } from '../mcp/firecrawl'
import { dateTool } from '../tools/date'
import { createSpinMemory } from '../memory/spin-memory'
import { createSpinWorkspace, type SpinWorkspaceConfig } from '../workspaces/spin-workspace'
import { DEFAULT_AGENT_MODEL } from './models'

/** Minimal filesystem surface needed to read the customer's AGENTS.md. */
interface InstructionsFilesystem {
  exists(path: string): Promise<boolean>
  readFile(path: string, options?: { encoding?: string }): Promise<string | Buffer>
}

/**
 * Customer-specific system-prompt additions live in the workspace root AGENTS.md and are appended
 * to the agent's instructions at runtime. Near-empty by default; absent is fine.
 */
async function readCustomerInstructions(filesystem: InstructionsFilesystem): Promise<string> {
  try {
    if (await filesystem.exists('AGENTS.md')) {
      const content = await filesystem.readFile('AGENTS.md', { encoding: 'utf-8' })
      const text = (typeof content === 'string' ? content : content.toString('utf-8')).trim()
      if (text) return text
    }
  } catch {
    // Treat any read error as "no customer instructions" rather than failing the agent.
  }
  return '(No customer-specific instructions configured.)'
}

export function createSpinAgent(config: SpinWorkspaceConfig) {
  const { filesystem, workspace } = createSpinWorkspace(config)

  // No agent-level skills: the OKF management skill is discovered from the workspace's skills/ prefix
  // (see spin-workspace.ts `skills: ['skills']`), so it is editable per-customer.
  return new Agent({
    id: 'spin-agent',
    name: 'Spin',
    description: 'Reads and maintains OKF knowledge bundles in the customer workspace.',
    model: DEFAULT_AGENT_MODEL,
    memory: createSpinMemory(),
    workspace,
    // `date` is always available; Firecrawl web tools are present only when FIRECRAWL_API_KEY is set.
    tools: { date: dateTool, ...firecrawlTools },
    defaultOptions: {
      maxSteps: 20,
    },
    instructions: async () =>
      `${spinSystemPrompt}\n\n# Customer instructions (AGENTS.md)\n\n${await readCustomerInstructions(filesystem)}`,
  })
}
