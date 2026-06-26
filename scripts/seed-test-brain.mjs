import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { S3Filesystem } from '@mastra/s3'

const bucket = process.env.SB_BRAIN_BUCKET
const region = process.env.SB_BRAIN_REGION ?? 'us-east-1'
const brainId = process.env.SB_BRAIN_ID ?? 'test-brain'
const prefix = `brains/${brainId}`

if (!bucket) {
  throw new Error('SB_BRAIN_BUCKET is required')
}

const templateDirectory = fileURLToPath(new URL('../templates/brain/', import.meta.url))
const filesystem = new S3Filesystem({ bucket, region, prefix })

const seedFiles = [
  { template: 'AGENTS.md', destination: 'AGENTS.md' },
  { template: 'index.md', destination: 'knowledge/index.md' },
  { template: 'log.md', destination: 'knowledge/log.md' },
]

for (const { template, destination } of seedFiles) {
  if (await filesystem.exists(destination)) {
    console.log(`Skipped existing s3://${bucket}/${prefix}/${destination}`)
    continue
  }

  const content = await readFile(join(templateDirectory, template), 'utf-8')
  await filesystem.writeFile(destination, content, { recursive: true })
  console.log(`Created s3://${bucket}/${prefix}/${destination}`)
}
