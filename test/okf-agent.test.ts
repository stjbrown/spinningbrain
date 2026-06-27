import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { DEFAULT_AGENT_MODEL } from '../src/mastra/agents/models'
import { createSpinAgent } from '../src/mastra/agents/spin-agent-factory'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

describe('OKF agent runtime', () => {
  it('runs as a single OKF agent: no lifecycle workflows, no agent-level skills', async () => {
    const agent = createSpinAgent({ bucket: 'example-bucket', region: 'auto' })
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
  })

  it('ships OKF management as a workspace skill in the template (not bundled in code)', () => {
    const skillPath = resolve(repoRoot, 'workspace-template/skills/okf/SKILL.md')
    assert.ok(existsSync(skillPath), 'workspace-template/skills/okf/SKILL.md exists')

    const skill = readFileSync(skillPath, 'utf8')
    assert.match(skill, /^name:\s*okf$/m) // agentskills.io SKILL.md declares the skill name
    assert.match(skill, /Never rewrite a claim/) // the append-only management philosophy

    // The spec + abstract travel with the skill as its references (the "Guiding Light").
    assert.ok(existsSync(resolve(repoRoot, 'workspace-template/skills/okf/references/OKF_SPEC.md')))
    assert.ok(
      existsSync(resolve(repoRoot, 'workspace-template/skills/okf/references/llm_wiki_abstract.md')),
    )
  })
})
