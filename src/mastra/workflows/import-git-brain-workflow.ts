import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { brainDescriptorKey, brainImportManifestKey, brainPrefix } from '../brain/canonical-brain'
import {
  gitImportPlanSchema,
  gitImportRequestSchema,
  gitImportResultSchema,
  importApprovalSchema,
} from '../brain/schemas/brain-portability'
import { importGitPlan } from '../brain/services/brain-store'
import { registerBrain } from '../brain/services/brain-directory'
import { buildGitImportPlan } from '../brain/services/import-planner'

const buildPlanStep = createStep({
  id: 'build-git-import-plan',
  inputSchema: gitImportRequestSchema,
  outputSchema: gitImportPlanSchema,
  execute: async ({ inputData }) => buildGitImportPlan(inputData),
})

const approvePlanStep = createStep({
  id: 'approve-git-import-plan',
  inputSchema: gitImportPlanSchema,
  outputSchema: gitImportPlanSchema,
  suspendSchema: gitImportPlanSchema,
  resumeSchema: importApprovalSchema,
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return suspend(inputData)
    }
    if (!resumeData.approved) {
      throw new Error('Git Brain import was not approved.')
    }
    if (resumeData.expectedCommit !== inputData.resolvedCommit) {
      throw new Error('Approved commit does not match the import plan.')
    }
    return inputData
  },
})

const executeImportStep = createStep({
  id: 'execute-git-import',
  inputSchema: gitImportPlanSchema,
  outputSchema: gitImportResultSchema,
  execute: async ({ inputData }) => {
    await importGitPlan(inputData)
    const now = new Date().toISOString()
    await registerBrain(inputData.bucket, inputData.region, {
      brainId: inputData.brainId,
      prefix: brainPrefix(inputData.brainId),
      status: 'ready',
      createdAt: now,
      updatedAt: now,
      source: {
        type: 'git',
        repository: inputData.repository,
        commit: inputData.resolvedCommit,
      },
    })

    return {
      bucket: inputData.bucket,
      region: inputData.region,
      brainId: inputData.brainId,
      repository: inputData.repository,
      requestedRef: inputData.ref,
      resolvedCommit: inputData.resolvedCommit,
      importedFiles: inputData.totals.files,
      importedBytes: inputData.totals.bytes,
      descriptorPath: brainDescriptorKey(inputData.brainId),
      manifestPath: brainImportManifestKey(inputData.brainId),
    }
  },
})

export const importGitBrainWorkflow = createWorkflow({
  id: 'import-git-brain',
  description: 'Migrate an approved remote Git branch into a canonical Spinning Brain.',
  inputSchema: gitImportRequestSchema,
  outputSchema: gitImportResultSchema,
})
  .then(buildPlanStep)
  .then(approvePlanStep)
  .then(executeImportStep)
  .commit()
