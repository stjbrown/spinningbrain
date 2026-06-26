import { Workspace } from '@mastra/core/workspace'
import { S3Filesystem } from '@mastra/s3'

export interface SpinWorkspaceConfig {
  bucket: string
  region: string
}

/**
 * Resolve the S3-compatible endpoint. When R2 config is present, target Cloudflare R2;
 * otherwise fall back to AWS S3 (endpoint undefined → SDK default).
 */
function resolveEndpoint(): string | undefined {
  if (process.env.R2_ENDPOINT) return process.env.R2_ENDPOINT
  if (process.env.R2_ACCOUNT_ID) {
    return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  }
  return undefined
}

export function createSpinWorkspace(config: SpinWorkspaceConfig) {
  const endpoint = resolveEndpoint()

  const filesystem = new S3Filesystem({
    id: 'spin-filesystem',
    bucket: config.bucket,
    region: config.region,
    endpoint,
    // Path-style is required for R2; harmless for the default AWS fallback when no endpoint set.
    forcePathStyle: endpoint ? true : undefined,
    // Omitted (undefined) → SDK default credential chain (AWS profile / env / IMDS).
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  })

  const workspace = new Workspace({
    id: 'spin-workspace',
    name: 'Spin Workspace',
    filesystem,
    // Customer-specific skills live in the bucket's skills/ prefix (empty by default).
    // Product OKF skills are attached at the agent level and merge on top (agent wins on name).
    skills: ['skills'],
  })

  return { filesystem, workspace }
}
