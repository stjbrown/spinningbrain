import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { brainDirectoryRecordSchema } from '../brain/schemas/brain-directory'
import { listBrains } from '../brain/services/brain-directory'

const listBrainsInputSchema = z.object({
  bucket: z.string().min(3),
  region: z.string().default('us-east-1'),
})

const listBrainsOutputSchema = z.object({
  brains: z.array(brainDirectoryRecordSchema),
})

const listBrainsStep = createStep({
  id: 'list-customer-brains',
  inputSchema: listBrainsInputSchema,
  outputSchema: listBrainsOutputSchema,
  execute: async ({ inputData }) => ({
    brains: await listBrains(inputData.bucket, inputData.region),
  }),
})

export const listBrainsWorkflow = createWorkflow({
  id: 'list-brains',
  description: 'List registered Brains in one customer Brain Store.',
  inputSchema: listBrainsInputSchema,
  outputSchema: listBrainsOutputSchema,
})
  .then(listBrainsStep)
  .commit()
