import { createSpinAgent } from './spin-agent-factory'

const bucket = process.env.SB_WORKSPACE_BUCKET
const region = process.env.SB_WORKSPACE_REGION ?? 'auto'

if (!bucket) {
  throw new Error('SB_WORKSPACE_BUCKET is required')
}

export const spinAgent = createSpinAgent({ bucket, region })
