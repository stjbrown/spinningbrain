import { createHash } from 'node:crypto'
import { S3Filesystem } from '@mastra/s3'
import {
  gitImportPlanSchema,
  type GitImportPlan,
  type GitImportPlanSummary,
} from '../schemas/brain-portability'
import { platformPrefix } from '../canonical-brain'

function createPendingPlanStore(bucket: string, region: string): S3Filesystem {
  return new S3Filesystem({
    id: 'pending-import-plans',
    bucket,
    region,
    prefix: `${platformPrefix}/import-plans`,
  })
}

function planIdFor(plan: GitImportPlan): string {
  return createHash('sha256').update(JSON.stringify(plan)).digest('hex')
}

export function summarizeGitImportPlan(
  planId: string,
  plan: GitImportPlan,
): GitImportPlanSummary {
  return {
    planId,
    brainId: plan.brainId,
    repository: plan.repository,
    requestedRef: plan.ref,
    resolvedCommit: plan.resolvedCommit,
    mappings: plan.mappings,
    charter: plan.charter,
    excludedFiles: plan.excludedPaths.length,
    warnings: plan.warnings,
    totals: plan.totals,
  }
}

export async function savePendingImportPlan(plan: GitImportPlan): Promise<GitImportPlanSummary> {
  const validated = gitImportPlanSchema.parse(plan)
  const planId = planIdFor(validated)
  const store = createPendingPlanStore(validated.bucket, validated.region)
  const path = `${planId}.json`

  if (!(await store.exists(path))) {
    await store.writeFile(path, `${JSON.stringify(validated, null, 2)}\n`, {
      recursive: true,
      overwrite: false,
    })
  }

  return summarizeGitImportPlan(planId, validated)
}

export async function readPendingImportPlan(
  bucket: string,
  region: string,
  planId: string,
): Promise<GitImportPlan> {
  const store = createPendingPlanStore(bucket, region)
  const content = await store.readFile(`${planId}.json`, { encoding: 'utf-8' })
  return gitImportPlanSchema.parse(JSON.parse(content.toString()))
}

export async function deletePendingImportPlan(
  bucket: string,
  region: string,
  planId: string,
): Promise<void> {
  const store = createPendingPlanStore(bucket, region)
  await store.deleteFile(`${planId}.json`, { force: true })
}
