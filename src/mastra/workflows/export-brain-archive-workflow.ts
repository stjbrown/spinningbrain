import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { brainIdSchema } from '../brain/schemas/brain-portability'
import { exportBrainArchive } from '../brain/services/archive-exporter'

const exportBrainArchiveInputSchema = z.object({
  bucket: z.string().min(3),
  region: z.string().default('us-east-1'),
  brainId: brainIdSchema,
})

const exportBrainArchiveOutputSchema = z.object({
  archiveBucket: z.string(),
  archiveKey: z.string(),
  archiveBytes: z.number().nonnegative(),
  archiveSha256: z.string().length(64),
  exportedFiles: z.number().nonnegative(),
  exportedBytes: z.number().nonnegative(),
})

const exportArchiveStep = createStep({
  id: 'export-canonical-brain-archive',
  inputSchema: exportBrainArchiveInputSchema,
  outputSchema: exportBrainArchiveOutputSchema,
  execute: async ({ inputData }) => exportBrainArchive(inputData),
})

export const exportBrainArchiveWorkflow = createWorkflow({
  id: 'export-brain-archive',
  description: 'Export a canonical Spinning Brain as a verified ZIP archive.',
  inputSchema: exportBrainArchiveInputSchema,
  outputSchema: exportBrainArchiveOutputSchema,
})
  .then(exportArchiveStep)
  .commit()
