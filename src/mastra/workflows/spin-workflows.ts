import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { brainDirectoryRecordSchema } from '../brain/schemas/brain-directory'
import { brainPrefix } from '../brain/canonical-brain'
import {
  brainIdSchema,
  charterStrategySchema,
  executePendingImportSchema,
  gitImportPlanSummarySchema,
  gitSourceInspectionRequestSchema,
  gitSourceInspectionSchema,
  importContentMappingSchema,
} from '../brain/schemas/brain-portability'
import { registerBrain, listBrains } from '../brain/services/brain-directory'
import { provisionBrain } from '../brain/services/brain-provisioner'
import { importGitPlan } from '../brain/services/brain-store'
import { exportBrainArchive } from '../brain/services/archive-exporter'
import { inspectGitSource } from '../brain/services/git-source-inspector'
import { buildGitImportPlan } from '../brain/services/import-planner'
import {
  deletePendingImportPlan,
  readPendingImportPlan,
  savePendingImportPlan,
} from '../brain/services/pending-import-plans'
import { upsertSpinBrainSection } from '../brain/services/spin-charter'

export interface SpinWorkflowConfig {
  bucket: string
  region: string
}

export function createSpinWorkflows(config: SpinWorkflowConfig) {
  const createInputSchema = z.object({ brainId: brainIdSchema })
  const createOutputSchema = z.object({
    brainId: brainIdSchema,
    createdFiles: z.array(z.string()),
  })
  const createStepForCustomer = createStep({
    id: 'spin-create-brain',
    inputSchema: createInputSchema,
    outputSchema: createOutputSchema,
    execute: async ({ inputData }) => ({
      brainId: inputData.brainId,
      createdFiles: await provisionBrain({ ...config, brainId: inputData.brainId }),
    }),
  })
  const createBrain = createWorkflow({
    id: 'spin-create-brain',
    description: 'Create a new unconfigured Brain in this customer Brain Store.',
    inputSchema: createInputSchema,
    outputSchema: createOutputSchema,
  })
    .then(createStepForCustomer)
    .commit()

  const listInputSchema = z.object({})
  const listOutputSchema = z.object({ brains: z.array(brainDirectoryRecordSchema) })
  const listStep = createStep({
    id: 'spin-list-brains',
    inputSchema: listInputSchema,
    outputSchema: listOutputSchema,
    execute: async () => ({ brains: await listBrains(config.bucket, config.region) }),
  })
  const listCustomerBrains = createWorkflow({
    id: 'spin-list-brains',
    description: 'List all registered Brains available to this customer.',
    inputSchema: listInputSchema,
    outputSchema: listOutputSchema,
  })
    .then(listStep)
    .commit()

  const inspectGitSourceStep = createStep({
    id: 'spin-inspect-git-source',
    inputSchema: gitSourceInspectionRequestSchema,
    outputSchema: gitSourceInspectionSchema,
    execute: async ({ inputData }) => inspectGitSource(inputData.repository, inputData.ref),
  })
  const inspectGitSourceWorkflow = createWorkflow({
    id: 'spin-inspect-git-source',
    description:
      'Read-only clone and inspect a remote Git branch before asking about import mappings, exclusions, or Charter choices.',
    inputSchema: gitSourceInspectionRequestSchema,
    outputSchema: gitSourceInspectionSchema,
  })
    .then(inspectGitSourceStep)
    .commit()

  const importInputSchema = z.object({
    repository: z
      .string()
      .url()
      .startsWith('https://')
      .refine(value => {
        const url = new URL(value)
        return !url.username && !url.password
      }, 'Repository URL must not contain embedded credentials'),
    ref: z.string().min(1).default('main'),
    brainId: brainIdSchema,
    mappings: z.array(importContentMappingSchema).min(1),
    charterStrategy: charterStrategySchema,
    adaptedCharter: z
      .string()
      .min(1)
      .max(100_000)
      .describe('The canonical Brain Charter adapted from the relevant source instructions.'),
    exclude: z.array(z.string()).default([]),
  })
  const importOutputSchema = z.object({
    brainId: brainIdSchema,
    repository: z.string().url(),
    requestedRef: z.string(),
    resolvedCommit: z.string().regex(/^[a-f0-9]{40}$/),
    importedFiles: z.number().nonnegative(),
    importedBytes: z.number().nonnegative(),
  })
  const planImportStep = createStep({
    id: 'spin-plan-git-import',
    inputSchema: importInputSchema,
    outputSchema: gitImportPlanSummarySchema,
    execute: async ({ inputData }) => {
      const plan = await buildGitImportPlan({
        ...inputData,
        bucket: config.bucket,
        region: config.region,
      })
      return savePendingImportPlan(plan)
    },
  })
  const planGitBrainImport = createWorkflow({
    id: 'spin-plan-git-brain-import',
    description:
      'Build and durably store an immutable Git Brain import plan for the user to review.',
    inputSchema: importInputSchema,
    outputSchema: gitImportPlanSummarySchema,
  })
    .then(planImportStep)
    .commit()

  const executeImportStep = createStep({
    id: 'spin-execute-git-import',
    inputSchema: executePendingImportSchema,
    outputSchema: importOutputSchema,
    execute: async ({ inputData }) => {
      const plan = await readPendingImportPlan(config.bucket, config.region, inputData.planId)
      await importGitPlan(plan)
      const now = new Date().toISOString()
      await registerBrain(config.bucket, config.region, {
        brainId: plan.brainId,
        prefix: brainPrefix(plan.brainId),
        status: 'ready',
        createdAt: now,
        updatedAt: now,
        source: {
          type: 'git',
          repository: plan.repository,
          commit: plan.resolvedCommit,
        },
      })
      await upsertSpinBrainSection(config.bucket, config.region, plan.brainId, plan.charter.content)
      await deletePendingImportPlan(config.bucket, config.region, inputData.planId)
      return {
        brainId: plan.brainId,
        repository: plan.repository,
        requestedRef: plan.ref,
        resolvedCommit: plan.resolvedCommit,
        importedFiles: plan.totals.files,
        importedBytes: plan.totals.bytes,
      }
    },
  })
  const executeGitBrainImport = createWorkflow({
    id: 'spin-execute-git-brain-import',
    description:
      'Execute one exact stored Git Brain import plan after the user explicitly approves it.',
    inputSchema: executePendingImportSchema,
    outputSchema: importOutputSchema,
  })
    .then(executeImportStep)
    .commit()

  const exportInputSchema = z.object({ brainId: brainIdSchema })
  const exportOutputSchema = z.object({
    archiveBucket: z.string(),
    archiveKey: z.string(),
    archiveBytes: z.number().nonnegative(),
    archiveSha256: z.string().length(64),
    exportedFiles: z.number().nonnegative(),
    exportedBytes: z.number().nonnegative(),
  })
  const exportStep = createStep({
    id: 'spin-export-brain-archive',
    inputSchema: exportInputSchema,
    outputSchema: exportOutputSchema,
    execute: async ({ inputData }) => exportBrainArchive({ ...config, brainId: inputData.brainId }),
  })
  const exportBrain = createWorkflow({
    id: 'spin-export-brain',
    description: 'Export one registered canonical Brain as a verified ZIP archive.',
    inputSchema: exportInputSchema,
    outputSchema: exportOutputSchema,
  })
    .then(exportStep)
    .commit()

  return {
    createBrain,
    listCustomerBrains,
    inspectGitSource: inspectGitSourceWorkflow,
    planGitBrainImport,
    executeGitBrainImport,
    exportBrain,
  }
}
