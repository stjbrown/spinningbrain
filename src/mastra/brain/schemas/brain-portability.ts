import { z } from 'zod'

export const brainIdSchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/,
    'brainId must be 3-63 lowercase letters, numbers, or hyphens',
  )

export const canonicalDestinationSchema = z.enum(['knowledge', 'sources', 'skills'])

export const importMappingSchema = z.object({
  from: z.string().min(1),
  to: canonicalDestinationSchema,
})

export const importContentMappingSchema = importMappingSchema

export const gitSourceInspectionRequestSchema = z.object({
  repository: z
    .string()
    .url()
    .startsWith('https://')
    .refine(value => {
      const url = new URL(value)
      return !url.username && !url.password
    }, 'Repository URL must not contain embedded credentials'),
  ref: z.string().min(1).default('main'),
})

export const discoveredCharterSchema = z.object({
  path: z.enum(['AGENTS.md', 'CLAUDE.md']),
  content: z.string(),
  bytes: z.number().nonnegative(),
  truncated: z.boolean(),
})

export const gitSourceInspectionSchema = gitSourceInspectionRequestSchema.extend({
  resolvedCommit: z.string().regex(/^[a-f0-9]{40}$/),
  files: z.number().nonnegative(),
  topLevelPaths: z.array(z.string()),
  suggestedMappings: z.array(importMappingSchema),
  charters: z.array(discoveredCharterSchema),
  warnings: z.array(z.string()),
})

export const charterStrategySchema = z
  .enum(['auto', 'prefer-agents', 'prefer-claude', 'merge'])
  .default('auto')
  .describe(
    'Which root instruction files should inform the adapted Brain Charter. Auto considers the only discovered file or both AGENTS.md and CLAUDE.md when both exist.',
  )

export const gitImportRequestSchema = z.object({
  repository: z
    .string()
    .url()
    .startsWith('https://')
    .refine(value => {
      const url = new URL(value)
      return !url.username && !url.password
    }, 'Repository URL must not contain embedded credentials'),
  ref: z
    .string()
    .min(1)
    .default('main')
    .describe('Remote branch name. Tags and commit SHAs are not supported yet.'),
  bucket: z.string().min(3),
  region: z.string().default('us-east-1'),
  brainId: brainIdSchema,
  mappings: z.array(importContentMappingSchema).min(1),
  charterStrategy: charterStrategySchema,
  adaptedCharter: z
    .string()
    .min(1)
    .max(100_000)
    .describe(
      'The canonical Brain Charter adapted from relevant source instructions for the imported Brain.',
    ),
  exclude: z.array(z.string()).default([]),
})

export const importFileSchema = z.object({
  sourcePath: z.string(),
  destinationPath: z.string(),
  bytes: z.number().nonnegative(),
  sha256: z.string().length(64),
})

export const importSectionTotalSchema = z.object({
  files: z.number().nonnegative(),
  bytes: z.number().nonnegative(),
})

export const charterResolutionSchema = z.object({
  requestedStrategy: charterStrategySchema,
  appliedStrategy: z.literal('adapted'),
  sourcePaths: z.array(z.string()),
  content: z.string().min(1).max(100_000),
  bytes: z.number().nonnegative(),
  sha256: z.string().length(64),
})

export const gitImportPlanSchema = gitImportRequestSchema.extend({
  resolvedCommit: z.string().regex(/^[a-f0-9]{40}$/),
  files: z.array(importFileSchema),
  charter: charterResolutionSchema,
  excludedPaths: z.array(z.string()),
  warnings: z.array(z.string()),
  totals: z.object({
    files: z.number().nonnegative(),
    bytes: z.number().nonnegative(),
    bySection: z.record(z.string(), importSectionTotalSchema),
  }),
})

export const pendingImportPlanIdSchema = z.string().regex(/^[a-f0-9]{64}$/)

export const gitImportPlanSummarySchema = z.object({
  planId: pendingImportPlanIdSchema,
  brainId: brainIdSchema,
  repository: z.string().url(),
  requestedRef: z.string(),
  resolvedCommit: z.string().regex(/^[a-f0-9]{40}$/),
  mappings: z.array(importContentMappingSchema),
  charter: charterResolutionSchema,
  excludedFiles: z.number().nonnegative(),
  warnings: z.array(z.string()),
  totals: gitImportPlanSchema.shape.totals,
})

export const executePendingImportSchema = z.object({
  planId: pendingImportPlanIdSchema,
})

export const importApprovalSchema = z.object({
  approved: z.boolean(),
  expectedCommit: z.string().regex(/^[a-f0-9]{40}$/),
})

export const gitImportResultSchema = z.object({
  bucket: z.string(),
  region: z.string(),
  brainId: brainIdSchema,
  repository: z.string().url(),
  requestedRef: z.string(),
  resolvedCommit: z.string().regex(/^[a-f0-9]{40}$/),
  importedFiles: z.number().nonnegative(),
  importedBytes: z.number().nonnegative(),
  descriptorPath: z.string().startsWith('._spinningbrain/brains/'),
  manifestPath: z.string().startsWith('._spinningbrain/brains/'),
})

export type GitImportRequest = z.infer<typeof gitImportRequestSchema>
export type GitImportPlan = z.infer<typeof gitImportPlanSchema>
export type GitImportPlanSummary = z.infer<typeof gitImportPlanSummarySchema>
export type ImportFile = z.infer<typeof importFileSchema>
export type CharterResolution = z.infer<typeof charterResolutionSchema>
export type CharterStrategy = z.infer<typeof charterStrategySchema>
export type GitSourceInspection = z.infer<typeof gitSourceInspectionSchema>
