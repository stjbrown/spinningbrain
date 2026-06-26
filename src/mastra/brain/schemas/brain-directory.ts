import { z } from 'zod'
import { brainIdSchema } from './brain-portability'

export const brainStatusSchema = z.enum(['ready', 'archived'])

export const brainSourceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('created'),
  }),
  z.object({
    type: z.literal('git'),
    repository: z.string().url(),
    commit: z.string().regex(/^[a-f0-9]{40}$/),
  }),
])

export const brainDirectoryRecordSchema = z.object({
  brainId: brainIdSchema,
  prefix: z.string().min(1),
  status: brainStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  source: brainSourceSchema,
})

export const brainDirectorySchema = z.object({
  formatVersion: z.literal(1),
  brains: z.record(brainIdSchema, brainDirectoryRecordSchema),
})

export type BrainDirectory = z.infer<typeof brainDirectorySchema>
export type BrainDirectoryRecord = z.infer<typeof brainDirectoryRecordSchema>
