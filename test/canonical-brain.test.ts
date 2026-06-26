import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assertNoDestinationCollisions,
  brainPrefix,
  createBrainDescriptor,
  mapDestinationPath,
  validateCanonicalPath,
} from '../src/mastra/brain/canonical-brain'
import { DEFAULT_AGENT_MODEL } from '../src/mastra/agents/models'
import { createSpinAgent } from '../src/mastra/agents/spin-agent-factory'
import { okfReadSkill, okfWriteSkill } from '../src/mastra/skills/okf-skills'
import { brainDirectorySchema } from '../src/mastra/brain/schemas/brain-directory'
import { gitImportRequestSchema } from '../src/mastra/brain/schemas/brain-portability'
import { suggestGitImportMappings } from '../src/mastra/brain/services/git-source-inspector'
import { describeGitSourceError } from '../src/mastra/brain/services/git-source'
import { summarizeGitImportPlan } from '../src/mastra/brain/services/pending-import-plans'
import { reconcileSpinCharter } from '../src/mastra/brain/services/spin-charter'
import {
  createAdaptedCharterResolution,
  destinationForSource,
  selectDiscoveredCharterStrategy,
} from '../src/mastra/brain/services/import-planner'

describe('canonical Brain paths', () => {
  it('maps a legacy wiki directory into canonical knowledge', () => {
    assert.equal(
      mapDestinationPath('wiki/competitors/netskope/_overview.md', 'wiki', 'knowledge'),
      'knowledge/competitors/netskope/_overview.md',
    )
  })

  it('discovers AGENTS.md and CLAUDE.md with deterministic precedence', () => {
    assert.equal(selectDiscoveredCharterStrategy('auto', true, false), 'agents')
    assert.equal(selectDiscoveredCharterStrategy('auto', false, true), 'claude')
    assert.equal(selectDiscoveredCharterStrategy('auto', true, true), 'merged')
    assert.equal(selectDiscoveredCharterStrategy('prefer-agents', true, true), 'agents')
    assert.equal(selectDiscoveredCharterStrategy('prefer-claude', true, true), 'claude')
    assert.equal(selectDiscoveredCharterStrategy('merge', true, true), 'merged')
    assert.equal(selectDiscoveredCharterStrategy('auto', false, false), 'missing')
  })

  it('rejects traversal and noncanonical destinations', () => {
    assert.throws(() => validateCanonicalPath('../knowledge/page.md'), /Invalid repository path/)
    assert.throws(() => validateCanonicalPath('wiki/page.md'), /outside the canonical Brain/)
  })

  it('rejects destination collisions', () => {
    assert.throws(
      () =>
        assertNoDestinationCollisions([
          {
            sourcePath: 'wiki/page.md',
            destinationPath: 'knowledge/page.md',
            bytes: 1,
            sha256: 'a'.repeat(64),
          },
          {
            sourcePath: 'other/page.md',
            destinationPath: 'knowledge/page.md',
            bytes: 1,
            sha256: 'b'.repeat(64),
          },
        ]),
      /Import path collision/,
    )
  })

  it('creates the canonical descriptor', () => {
    assert.match(createBrainDescriptor('ci-os'), /id: ci-os/)
    assert.match(createBrainDescriptor('ci-os'), /sharedInbox: inbox/)
    assert.match(createBrainDescriptor('ci-os'), /knowledge: brains\/ci-os\/knowledge/)
    assert.doesNotMatch(createBrainDescriptor('ci-os'), /\n  sources:/)
    assert.equal(brainPrefix('ci-os'), 'brains/ci-os')
  })

  it('rejects repository URLs with embedded credentials', () => {
    const result = gitImportRequestSchema.safeParse({
      repository: 'https://secret@github.com/example/brain.git',
      ref: 'main',
      bucket: 'example-bucket',
      region: 'us-east-1',
      brainId: 'example-brain',
      mappings: [{ from: 'wiki', to: 'knowledge' }],
      adaptedCharter: '# Example Brain',
      exclude: [],
    })

    assert.equal(result.success, false)
  })

  it('defaults Git imports to automatic Charter discovery', () => {
    const result = gitImportRequestSchema.parse({
      repository: 'https://github.com/example/brain.git',
      ref: 'main',
      bucket: 'example-bucket',
      region: 'us-east-1',
      brainId: 'example-brain',
      mappings: [{ from: 'wiki', to: 'knowledge' }],
      adaptedCharter: '# Example Brain',
      exclude: [],
    })

    assert.equal(result.charterStrategy, 'auto')
  })

  it('rejects direct source instruction mappings', () => {
    const result = gitImportRequestSchema.safeParse({
      repository: 'https://github.com/example/brain.git',
      ref: 'main',
      bucket: 'example-bucket',
      region: 'us-east-1',
      brainId: 'example-brain',
      mappings: [{ from: 'AGENTS.md', to: 'AGENTS.md' }],
      adaptedCharter: '# Adapted Brain Charter',
      exclude: [],
    })

    assert.equal(result.success, false)
  })

  it('pins an adapted Charter while recording its source instructions', () => {
    const request = gitImportRequestSchema.parse({
      repository: 'https://github.com/example/brain.git',
      ref: 'main',
      bucket: 'example-bucket',
      region: 'us-east-1',
      brainId: 'example-brain',
      mappings: [{ from: 'wiki', to: 'knowledge' }],
      adaptedCharter: '# Adapted Brain Charter',
      exclude: [],
    })
    const result = createAdaptedCharterResolution(request, ['AGENTS.md', 'CLAUDE.md'])

    assert.equal(result.appliedStrategy, 'adapted')
    assert.equal(result.content, '# Adapted Brain Charter')
    assert.deepEqual(result.sourcePaths, ['AGENTS.md', 'CLAUDE.md'])
    assert.equal(result.sha256.length, 64)
  })

  it('suggests import mappings from paths that actually exist', () => {
    assert.deepEqual(
      suggestGitImportMappings([
        'wiki/page.md',
        'ingest/raw/source.md',
        'raw_ingests/other.md',
        '.agents/skills/slides/SKILL.md',
      ]),
      [
        { from: 'wiki', to: 'knowledge' },
        { from: 'ingest/raw', to: 'sources' },
        { from: 'raw_ingests', to: 'sources' },
        { from: '.agents/skills', to: 'skills' },
      ],
    )
  })

  it('routes imported sources into the shared root inbox', () => {
    const request = gitImportRequestSchema.parse({
      repository: 'https://github.com/example/brain.git',
      ref: 'main',
      bucket: 'example-bucket',
      region: 'us-east-1',
      brainId: 'example-brain',
      mappings: [{ from: 'ingest/raw', to: 'sources' }],
      adaptedCharter: '# Adapted Brain Charter',
      exclude: [],
    })

    assert.equal(
      destinationForSource('ingest/raw/report.md', request),
      'inbox/imports/example-brain/report.md',
    )
  })

  it('turns remote Git connectivity failures into actionable errors', () => {
    const error = describeGitSourceError(
      new Error("fatal: Failed to connect to github.com: Couldn't connect to server"),
      'branch resolution for main',
    )

    assert.match(error.message, /could not reach the repository/)
  })

  it('summarizes a pending import plan without returning excluded path details', () => {
    const request = gitImportRequestSchema.parse({
      repository: 'https://github.com/example/brain.git',
      ref: 'main',
      bucket: 'example-bucket',
      region: 'us-east-1',
      brainId: 'example-brain',
      mappings: [{ from: 'wiki', to: 'knowledge' }],
      adaptedCharter: '# Adapted Brain Charter',
      exclude: [],
    })
    const charter = createAdaptedCharterResolution(request, ['AGENTS.md'])
    const summary = summarizeGitImportPlan('a'.repeat(64), {
      ...request,
      resolvedCommit: 'b'.repeat(40),
      files: [],
      charter,
      excludedPaths: ['package.json', 'src/index.ts'],
      warnings: [],
      totals: { files: 1, bytes: charter.bytes, bySection: {} },
    })

    assert.equal(summary.planId, 'a'.repeat(64))
    assert.equal(summary.excludedFiles, 2)
    assert.equal('excludedPaths' in summary, false)
  })
})

describe('single-player Spin runtime', () => {
  it('updates the platform Charter while preserving managed Brain sections', () => {
    const section = [
      '<!-- SPIN:BRAIN:ci-os:START -->',
      '## Brain: ci-os',
      '',
      'Use `ci-os/knowledge/` for canonical knowledge and `ci-os/sources/` for evidence.',
      '<!-- SPIN:BRAIN:ci-os:END -->',
    ].join('\n')
    const result = reconcileSpinCharter(`# Old Charter\n\n${section}\n`)

    assert.match(result, /shared root `inbox\/`/)
    assert.match(result, /SPIN:BRAIN:ci-os:START/)
    assert.match(result, /Use `brains\/ci-os\/knowledge\/`/)
    assert.doesNotMatch(result, /ci-os\/sources\/` for evidence/)
  })

  it('validates the customer-level Brain directory', () => {
    const now = new Date().toISOString()
    const result = brainDirectorySchema.parse({
      formatVersion: 1,
      brains: {
        'ci-os': {
          brainId: 'ci-os',
          prefix: 'brains/ci-os',
          status: 'ready',
          createdAt: now,
          updatedAt: now,
          source: { type: 'created' },
        },
      },
    })

    assert.equal(result.brains['ci-os'].prefix, 'brains/ci-os')
  })

  it('runs as a single OKF agent: no lifecycle workflows, OKF skills attached', async () => {
    const spin = createSpinAgent({
      bucket: 'example-bucket',
      region: 'auto',
    })
    const workflows = await spin.listWorkflows()
    const memory = await spin.getMemory()

    // MVP: brain-lifecycle workflows are parked; the agent does OKF work directly.
    assert.deepEqual(Object.keys(workflows), [])
    assert.equal(spin.id, 'spin-agent')
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
