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

The index lists only **current** knowledge — it is your retrieval surface (you find things via the
index, not by searching). That is by design (see "Currency & history").

## Concept files
- A concept is a single \`.md\` file: YAML frontmatter (a required \`type\` field) followed by a
  markdown body.
- \`index.md\` and \`log.md\` are **reserved** files (a listing and a history), not concepts.

## Following links
- A link beginning with \`/\` is **bundle-root-absolute**: resolve it from \`knowledge/\`
  (e.g. \`/ci/competitors/netskope.md\` → \`knowledge/ci/competitors/netskope.md\`).
- A relative link (\`./other.md\`) resolves from the current file's directory.

## Currency & history
- If you follow a link to a concept whose frontmatter says \`status: superseded\`, follow its
  \`superseded_by\` link to the current version and answer from **that**. Superseded concepts are kept
  for history (they are removed from the index, not deleted) — use them only when the user asks how
  something evolved over time.

## Contested knowledge (answer with nuance, not a flat yes/no)
- When concepts are linked with \`conflicts_with\`, read the **anchor and all linked signals** before
  answering. Give a **hedged, sourced, time-aware** answer: separate what is confirmed by authoritative
  sources from what is only suggested by softer signals, with dates and sources. For example:
  *"Officially no per their docs (Jan); however 3 customer reports + chatter since Feb suggest an
  unannounced beta — unconfirmed."*

## Be permissive (never refuse a bundle)
Tolerate unknown \`type\` values, missing optional frontmatter fields, missing \`index.md\`,
and broken links (a broken link is simply not-yet-written knowledge).

## Cross-kb questions, and always cite
A single question may span multiple kbs. Consult each relevant kb's catalog/concepts, and make clear
in your answer **which kb and which source** backs each part of it.

Use \`skill_read okf-spec.md\` for the full Open Knowledge Format specification when you need
edge-case detail.
`.trim(),
})

/**
 * okf-write — how to author OKF knowledge under the append-only, provenance-first model.
 * Intent-first and deliberately loose: a few hard invariants, then a default playbook with the
 * reasoning attached, so the agent can adapt to cases the rules don't cover.
 */
export const okfWriteSkill = createSkill({
  name: 'okf-write',
  description:
    'Use BEFORE creating or editing any knowledge file. How to author trustworthy, append-only OKF knowledge with provenance.',
  references: specReference,
  instructions: `
# Writing knowledge

## Why you do this (the goal these rules serve)
You maintain a knowledge base its owner can **trust** and that **compounds** over time: anyone should
be able to tell what is currently believed, what it rests on, and how that belief changed. The playbook
below is how that usually goes best — it is not a cage. Use your intelligence; serve the goal.

## Five invariants — never break these (they are what create the trust)
1. **Never rewrite a claim.** If what a document asserts changes, write a NEW document and supersede the
   old one — never edit the meaning of an existing one.
2. **Never lose provenance.** Every concept either cites a source or is marked user-originated. Never
   invent a source.
3. **Never destroy.** Removing something from an index is a *tombstone, not a delete* — superseded and
   contested docs stay on disk and reachable.
4. **Act on signals, not opinions.** Replace older knowledge only when an authoritative source shows it
   changed — not because you think the new claim is more likely true.
5. **Make every change visible.** Append a dated entry to \`log.md\` for anything you create, supersede,
   or relink.

**When something doesn't fit this model:** stay within the five invariants, prefer the least-destructive
option, write your reasoning into \`log.md\`, and ask the human if you're genuinely unsure. These
patterns are not exhaustive.

## Default playbook

### Sources & provenance — store once, cite many (N:1)
- Store each source **once** as a concept with \`type: Reference\` and \`resource:\` set to its
  canonical URL or asset. Keep source material (PDFs, images, captured pages) under the kb's
  \`references/\` subdir and link to it; the Reference body holds extracted text for retrieval.
- One source often yields **many** concepts (e.g. a "top colleges per major" list → a concept per
  college, maybe a new \`majors/\` subdir, cross-links among them). They all **cite the one Reference** —
  never duplicate the source.
- Prefer **atomic** concepts (one entity / one claim per file). It keeps later supersession surgical.
- Pasted text with no source: **ask for a source URL.** If there truly is none, record it as
  \`type: Note\` with no \`resource:\` (user-originated — honestly distinct from sourced material).

### Append-only on content
The test for any edit: *does it change what the document asserts?*
- **OK to edit in place:** spelling/typos, fixing or adding links, normalizing \`type\`/metadata,
  updating an index.
- **NOT OK:** changing a claim's meaning. Instead write a new doc and supersede (below). Keeping the
  original is the point — it records that the claim was once true, and when it changed.

### Conflict vs. supersede
- New info that simply **disagrees** with existing knowledge → link them with \`conflicts_with\` and
  leave **both active**. Disagreement is not replacement.
- **Supersede (replace) only on a high-confidence, provenance-based change signal** — e.g. the same
  \`resource:\` re-fetched now says something different, an official change source (release notes /
  changelog / announcement), or a fresh first-party datapoint on the same thing. Confidence comes from
  the **source** — its authority tier (see \`AGENTS.md\`) and how many independent sources corroborate —
  **never from your own sense of what's true.**
- Ambiguous? Default to \`conflicts_with\`, never to supersede.

### Superseding — do it atomically
Write the new concept; set \`superseded_by:\` on the old and \`supersedes:\` on the new (with
\`status: superseded\` on the old); remove the old one from its index; and log the reason — as one
operation. The superseded doc stays on disk, reachable via the link, for history.

### The index is the current view
An index lists only **active** concepts (it's how things get found). Superseded concepts are removed
from the index but remain reachable through \`superseded_by\`. Keep each level's index current as you
add and supersede.

### Synthesis is a spectrum
You don't have to store a synthesis — by default let it emerge at read time. But when a cluster of
related signals is clearly forming, you **may** write a synthesis concept as the cluster's **anchor**
and cross-link the signals to it. A stored synthesis is a normal concept: **append-only**, refreshed
only by superseding it with a better one — **never edited in place** as new signals arrive. Its body may
legitimately say "as of …"; the linked signals carry the rest.

## Frontmatter — conventions, applied with judgment (not a rigid schema)
Required: \`type\` (non-empty). Common: \`title\`, \`description\`, \`resource:\` (canonical source),
\`tags\`, \`timestamp\` (ISO 8601). Relationship/state: \`status: active|superseded\`, \`supersedes:\`,
\`superseded_by:\`, \`conflicts_with:\`, and optionally \`confidence: high|medium|low\`. Preserve any
unknown keys you find.

## Links & logs
- Cross-reference concepts with bundle-root-absolute links: \`/<kb>/path.md\` (resolved from
  \`knowledge/\`).
- Append dated entries to the kb's \`log.md\` (\`## YYYY-MM-DD\` then a bullet beginning
  \`**Creation**\` / \`**Update**\` / \`**Supersede**\` / \`**Conflict**\`). Notable cross-kb changes
  may also go in \`knowledge/log.md\`.

Use \`skill_read okf-spec.md\` for the full Open Knowledge Format specification when you need
edge-case detail.
`.trim(),
})
