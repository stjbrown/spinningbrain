import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createSkill } from '@mastra/core/skills'

/**
 * Load the canonical OKF specification so the agent can `skill_read` it on demand.
 * Read at module load from the repo's research doc. If unavailable (e.g. a bundled
 * deploy that does not ship docs/), the skills still carry the operational rules in
 * their instructions — the full spec reference is best-effort.
 */
function loadOkfSpec(): string {
  const candidates = [resolve(process.env.INIT_CWD ?? process.cwd(), 'docs/research/OKF_SPEC.md')]
  for (const path of candidates) {
    try {
      return readFileSync(path, 'utf8')
    } catch {
      // try next candidate
    }
  }
  return ''
}

const OKF_SPEC = loadOkfSpec()
const specReference: Record<string, string> = OKF_SPEC ? { 'okf-spec.md': OKF_SPEC } : {}

/**
 * okf-read — how to traverse and consume OKF knowledge bundles in this workspace.
 */
export const okfReadSkill = createSkill({
  name: 'okf-read',
  description:
    'Use when reading or answering from knowledge. Explains how to traverse OKF bundles (kbs) under knowledge/.',
  references: specReference,
  instructions: `
# Reading OKF knowledge

Knowledge lives under \`knowledge/\` as one or more **OKF bundles**. Each bundle is called a
"kb" and occupies one subdirectory (for example \`knowledge/ci/\`, \`knowledge/personal/\`).

## Traversal (progressive disclosure)
1. Read \`knowledge/index.md\` first — it is the **catalog** of available kbs.
2. Open the relevant kb's own \`index.md\` to see its concepts before reading individual files.
3. Open only the concept files you need.

## Concept files
- A concept is a single \`.md\` file: YAML frontmatter (a required \`type\` field) followed by a
  markdown body.
- \`index.md\` and \`log.md\` are **reserved** files (a listing and a history), not concepts.

## Following links
- A link beginning with \`/\` is **bundle-root-absolute**: resolve it from \`knowledge/\`
  (e.g. \`/ci/competitors/netskope.md\` → \`knowledge/ci/competitors/netskope.md\`).
- A relative link (\`./other.md\`) resolves from the current file's directory.

## Be permissive (never refuse a bundle)
Tolerate unknown \`type\` values, missing optional frontmatter fields, missing \`index.md\`,
and broken links (a broken link is simply not-yet-written knowledge).

## Cross-kb questions
A single question may span multiple kbs. Consult each relevant kb's catalog/concepts and make
clear in your answer which kb each fact came from.

Use \`skill_read okf-spec.md\` for the full Open Knowledge Format specification when you need
edge-case detail.
`.trim(),
})

/**
 * okf-write — how to author OKF-conformant knowledge, keeping each kb portable.
 */
export const okfWriteSkill = createSkill({
  name: 'okf-write',
  description:
    'Use BEFORE creating or editing any knowledge file. Explains how to write OKF-conformant concepts, indexes, and logs.',
  references: specReference,
  instructions: `
# Writing OKF knowledge

All knowledge is stored as **OKF bundles** ("kb"s) under \`knowledge/\`. Activate this skill
before any write so every file stays conformant and each kb stays independently portable.

## 1. Choose (or create) the right kb
- Write into the kb whose domain fits (e.g. \`knowledge/ci/\` for competitive intelligence).
- If no kb fits and a new domain is warranted, create a new kb:
  - \`knowledge/<kb>/index.md\` (the new bundle root),
  - your concept file(s),
  - and add the kb to the catalog at \`knowledge/index.md\`.

## 2. Write conformant concept files
Every concept \`.md\` MUST begin with YAML frontmatter containing a non-empty \`type\`:

\`\`\`yaml
---
type: <short kind, e.g. Competitor, Metric, Playbook, Reference>   # REQUIRED
title: <human-readable name>
description: <one-sentence summary>
resource: <canonical URI, only if it describes a real asset>
tags: [<tag>, <tag>]
timestamp: <ISO 8601, e.g. 2026-06-26T00:00:00Z>
---
\`\`\`

- Prefer structural markdown in the body (headings, lists, tables, code fences).
- Conventional headings when applicable: \`# Schema\`, \`# Examples\`, \`# Citations\`.
- When the body makes claims from external sources, add a numbered \`# Citations\` section.

## 3. Links
- Cross-reference other concepts with bundle-root-absolute links: \`/<kb>/path.md\`
  (resolved from \`knowledge/\`). Keep links within a kb consistent with this form.

## 4. Maintain reserved files
- Update the kb's \`index.md\` listing when you add, rename, or remove a concept.
- Append a dated entry to the kb's \`log.md\` (\`## YYYY-MM-DD\` then a bullet beginning
  \`**Creation**\` / \`**Update**\` / \`**Deprecation**\`).
- For notable cross-kb changes, you may also append to \`knowledge/log.md\`.

## 5. Safety & conformance
- Read an existing file before overwriting it; preserve unknown frontmatter keys.
- Before finishing, verify: frontmatter parses, \`type\` is non-empty, reserved files are
  well-formed, and links use the \`/<kb>/...\` convention.
- Each kb must independently satisfy OKF conformance so it can be exported on its own later.

Use \`skill_read okf-spec.md\` for the full Open Knowledge Format specification.
`.trim(),
})
