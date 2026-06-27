import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { S3Filesystem } from '@mastra/s3'

// Initializes a customer workspace (bucket root) by copying the repo's `workspace-template/` tree
// up to R2 verbatim. The template mirrors the bucket layout exactly:
//   knowledge/index.md, knowledge/log.md   the empty-but-valid OKF knowledge skeleton
//   AGENTS.md                              the onboarding bootstrap (self-replaces after first run)
//   skills/okf/SKILL.md + references/       the OKF management skill (the agent's editable "take")
// No kbs are pre-seeded — the agent creates them interactively on first run (see AGENTS.md).
// Idempotent: existing files are skipped, so re-running won't clobber a populated/edited workspace.

const bucket = process.env.SB_WORKSPACE_BUCKET
const region = process.env.SB_WORKSPACE_REGION ?? 'auto'

if (!bucket) {
  throw new Error('SB_WORKSPACE_BUCKET is required')
}

const endpoint =
  process.env.R2_ENDPOINT ??
  (process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined)

const filesystem = new S3Filesystem({
  bucket,
  region,
  endpoint,
  forcePathStyle: endpoint ? true : undefined,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
})

const templateDir = resolve(fileURLToPath(new URL('..', import.meta.url)), 'workspace-template')

/** Recursively list every file under a directory, returned as absolute paths. */
function listFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listFiles(full))
    else if (entry.isFile()) out.push(full)
  }
  return out
}

const files = listFiles(templateDir)
if (files.length === 0) {
  throw new Error(`workspace-template/ is empty or missing at ${templateDir}`)
}

for (const abs of files) {
  // Bucket key = path relative to the template root (POSIX separators).
  const key = relative(templateDir, abs).split(/[\\/]+/).join('/')
  if (await filesystem.exists(key)) {
    console.log(`Skipped existing ${bucket}/${key}`)
    continue
  }
  await filesystem.writeFile(key, readFileSync(abs, 'utf8'), { recursive: true })
  console.log(`Created ${bucket}/${key}`)
}
