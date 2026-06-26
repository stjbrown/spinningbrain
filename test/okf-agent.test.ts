import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DEFAULT_AGENT_MODEL } from '../src/mastra/agents/models'
import { createSpinAgent } from '../src/mastra/agents/spin-agent-factory'
import { okfReadSkill, okfWriteSkill } from '../src/mastra/skills/okf-skills'

describe('OKF agent runtime', () => {
  it('runs as a single OKF agent: no lifecycle workflows, OKF skills attached', async () => {
    const agent = createSpinAgent({
      bucket: 'example-bucket',
      region: 'auto',
    })
    const workflows = await agent.listWorkflows()
    const memory = await agent.getMemory()

    // One customer = one workspace. No multi-collection lifecycle workflows; OKF work is direct.
    assert.deepEqual(Object.keys(workflows), [])
    assert.equal(agent.id, 'spin-agent')
    assert.equal(
      DEFAULT_AGENT_MODEL,
      process.env.SB_AGENT_MODEL ?? 'openrouter/deepseek/deepseek-v4-flash',
    )
    assert.equal(memory?.getConfig().observationalMemory, true)

    // Product-level OKF read/write skills travel with the agent.
    assert.deepEqual([okfReadSkill.name, okfWriteSkill.name].sort(), ['okf-read', 'okf-write'])
    assert.match(okfWriteSkill.instructions, /type/)
  })
})
