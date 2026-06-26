import { S3Filesystem } from '@mastra/s3'

// Seeds a customer workspace (bucket root) with the MVP skeleton:
//   knowledge/index.md         catalog of kbs
//   knowledge/log.md           cross-kb log
//   knowledge/ci/...           starter "Competitive Intelligence" kb (one OKF bundle)
//   knowledge/personal/...     starter "Personal" kb (another OKF bundle)
//   AGENTS.md                  customer-specific instructions (near-empty)
//   skills/.keep               customer skills prefix (empty by default)
// Idempotent: existing files are skipped.

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

const today = new Date().toISOString().slice(0, 10)
const now = new Date().toISOString()

const files = [
  {
    path: 'knowledge/index.md',
    content: `---
okf_version: "0.1"
---

# Knowledge Catalog

This workspace's knowledge is organized into bundles (kbs). Each kb is a self-contained OKF
bundle that can be browsed — or exported — on its own.

# Bundles

* [Competitive Intelligence](ci/) - Competitor, market, and product knowledge.
* [Personal](personal/) - Personal notes, references, and playbooks.
`,
  },
  {
    path: 'knowledge/log.md',
    content: `# Knowledge Update Log

## ${today}
* **Initialization**: Seeded the knowledge catalog with the \`ci\` and \`personal\` bundles.
`,
  },
  {
    path: 'knowledge/ci/index.md',
    content: `---
okf_version: "0.1"
---

# Competitive Intelligence

Knowledge about competitors, markets, and product comparisons.

# Concepts

* [Example Competitor](example-competitor.md) - Placeholder competitor overview.
`,
  },
  {
    path: 'knowledge/ci/log.md',
    content: `# Directory Update Log

## ${today}
* **Initialization**: Created the Competitive Intelligence bundle.
`,
  },
  {
    path: 'knowledge/ci/example-competitor.md',
    content: `---
type: Competitor
title: Example Competitor
description: Placeholder competitor concept demonstrating OKF structure.
tags: [example]
timestamp: ${now}
---

# Overview

This is a placeholder OKF concept in the \`ci\` bundle. Replace it with real knowledge.

# Citations

[1] [Source placeholder](https://example.com)
`,
  },
  {
    path: 'knowledge/personal/index.md',
    content: `---
okf_version: "0.1"
---

# Personal

Personal notes, references, and playbooks.

# Concepts

* [Welcome](welcome.md) - Starter personal note.
`,
  },
  {
    path: 'knowledge/personal/welcome.md',
    content: `---
type: Note
title: Welcome
description: Starter note in the personal knowledge bundle.
tags: [example]
timestamp: ${now}
---

# Welcome

This is the \`personal\` bundle. Add notes, references, and playbooks here.
`,
  },
  {
    path: 'AGENTS.md',
    content: `# Customer Instructions

Add customer-specific guidance for the agent here. This file is appended to the agent's system
prompt at runtime. It is intentionally minimal by default.
`,
  },
  {
    path: 'skills/.keep',
    content: '',
  },
]

for (const { path, content } of files) {
  if (await filesystem.exists(path)) {
    console.log(`Skipped existing ${bucket}/${path}`)
    continue
  }
  await filesystem.writeFile(path, content, { recursive: true })
  console.log(`Created ${bucket}/${path}`)
}
