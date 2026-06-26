import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { brainPrefix } from '../brain/canonical-brain'
import { brainIdSchema } from '../brain/schemas/brain-portability'
import { provisionBrain } from '../brain/services/brain-provisioner'

const createBrainInputSchema = z.object({
  bucket: z.string().min(3).describe('Customer S3 bucket name'),
  brainId: brainIdSchema.describe('Stable Brain identifier used as the S3 prefix'),
  region: z.string().default('us-east-1'),
})

const createBrainOutputSchema = z.object({
  bucket: z.string(),
  brainId: z.string(),
  prefix: z.string(),
  createdFiles: z.array(z.string()),
})

const provisionBrainStep = createStep({
  id: 'provision-brain',
  inputSchema: createBrainInputSchema,
  outputSchema: createBrainOutputSchema,
  execute: async ({ inputData }) => {
    const { bucket, brainId, region } = inputData
    const createdFiles = await provisionBrain({ bucket, region, brainId })

    return {
      bucket,
      brainId,
      prefix: brainPrefix(brainId),
      createdFiles,
    }
  },
})

export const createBrainWorkflow = createWorkflow({
  id: 'create-brain',
  description: 'Provision a new unconfigured specialized Brain in a customer Brain Store.',
  inputSchema: createBrainInputSchema,
  outputSchema: createBrainOutputSchema,
})
  .then(provisionBrainStep)
  .commit()
