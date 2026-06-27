---
name: okf
description: How to read and maintain this workspace's knowledge as trustworthy, append-only OKF bundles. Load before creating, editing, or answering from knowledge.
version: 1.0.0
tags:
  - okf
  - knowledge
  - writing
  - reading
---

# Managing OKF knowledge

This skill is the **recommended** way to manage this workspace's knowledge. It is a starting point —
the owner may tweak or replace it. Your base instructions already cover OKF basics and the
non-negotiable safety rules; this skill adds the *management philosophy*.

Goal: a knowledge base the owner can **trust** and that **compounds** — anyone can tell what is
currently believed, what it rests on, and how it changed. These rules serve that goal; use judgment.

## Principles (the trust model)
1. **Never rewrite a claim.** If what a document asserts changes, write a NEW document and supersede the
   old one — never edit the meaning of an existing one.
2. **Never lose provenance.** Every concept either cites a source or is marked user-originated. Never
   invent a source.
3. **Never destroy.** Removing something from an index is a *tombstone, not a delete* — superseded and
   contested docs stay on disk and reachable.
4. **Act on signals, not opinions.** Replace older knowledge only when an authoritative source shows it
   changed — not because you think the new claim is more likely true.
5. **Make every change visible.** Append a dated entry to `log.md` for anything you create, supersede,
   or relink.

When something doesn't fit: stay within these principles, prefer the least-destructive option, write
your reasoning into `log.md`, and ask the human if you're genuinely unsure. These patterns are not
exhaustive.

## Writing

### Sources & provenance — store once, cite many (N:1)
- Store each source **once** as a concept with `type: Reference` and `resource:` set to its canonical
  URL or asset. Keep source material (PDFs, images, captured pages) under the kb's `references/` subdir
  and link to it; the Reference body holds extracted text for retrieval.
- One source often yields **many** concepts (e.g. a "top colleges per major" list → a concept per
  college, maybe a new `majors/` subdir, cross-links among them). They all **cite the one Reference** —
  never duplicate the source.
- Prefer **atomic** concepts (one entity / one claim per file). It keeps later supersession surgical.
- Pasted text with no source: **ask for a source URL.** If there truly is none, record it as
  `type: Note` with no `resource:` (user-originated — honestly distinct from sourced material).

### Entity-first — build durable concepts, not just dated snapshots
Prefer durable **entity/topic concepts** that accumulate over time (a product, company, capability),
and let incoming sources *feed* them — don't just drop a fresh dated snapshot per ingest. Dated items
(a specific release, a news item) are the **evidence trail**; the entity concept is the living synthesis
that cites them. Keep an `_overview`/index concept per area as the entry point, and as an area grows,
**fan out** into sub-bundles (e.g. `netskope/ai_gateway/`, `netskope/npa/`).

### Append-only on content
The test for any edit: *does it change what the document asserts?*
- **OK to edit in place:** spelling/typos, fixing or adding links, normalizing `type`/metadata,
  updating an index.
- **NOT OK:** changing a claim's meaning. Instead write a new doc and supersede (below). Keeping the
  original is the point — it records that the claim was once true, and when it changed.

### Conflict vs. supersede
- New info that simply **disagrees** with existing knowledge → link them with `conflicts_with` and
  leave **both active**. Disagreement is not replacement.
- **Supersede (replace) only on a high-confidence, provenance-based change signal** — e.g. the same
  `resource:` re-fetched now says something different, an official change source (release notes /
  changelog / announcement), or a fresh first-party datapoint on the same thing. Confidence comes from
  the **source** — its authority tier (see `AGENTS.md`) and how many independent sources corroborate —
  **never from your own sense of what's true.**
- Ambiguous? Default to `conflicts_with`, never to supersede.

### Events & timelines — additive, do NOT supersede
Event-like records — a specific release, a news item, a dated report — are **additive historical
facts**. They accumulate as a **timeline**; a newer one does NOT supersede an older one (Release 138's
notes don't make Release 137's false). Keep each as its own active concept. Distinguish a *specific*
instance ("Release 138" — immutable) from a *current/latest* pointer ("latest release" — a small
concept that you update to point at the newest). Only supersede when new info *corrects or replaces* a
claim (below).

### Superseding — do it atomically
Write the new concept; set `superseded_by:` on the old and `supersedes:` on the new (with
`status: superseded` on the old); remove the old one from its index; and log the reason — as one
operation. The superseded doc stays on disk, reachable via the link, for history.

### The index is the current view
An index lists only **active** concepts (it's how things get found — there is no search). Superseded
concepts are removed from the index but remain reachable through `superseded_by`. Keep each level's
index current as you add and supersede.

### Synthesis is a spectrum
You don't have to store a synthesis — by default let it emerge at read time. But when a cluster of
related signals is clearly forming, you **may** write a synthesis concept as the cluster's **anchor**
and cross-link the signals to it. A stored synthesis is a normal concept: **append-only**, refreshed
only by superseding it with a better one — **never edited in place** as new signals arrive. Its body
may legitimately say "as of …"; the linked signals carry the rest.

### Frontmatter — conventions, applied with judgment (not a rigid schema)
Required: `type` (non-empty). Common: `title`, `description`, `resource:` (canonical source), `tags`,
`timestamp` (ISO 8601). Relationship/state: `status: active|superseded`, `supersedes:`,
`superseded_by:`, `conflicts_with:`, and optionally `confidence: high|medium|low`. Preserve any unknown
keys you find.

### Links & logs
- Cross-reference concepts with bundle-root-absolute links: `/<kb>/path.md` (resolved from
  `knowledge/`).
- Append dated entries to the kb's `log.md` (`## YYYY-MM-DD` then a bullet beginning `**Creation**` /
  `**Update**` / `**Supersede**` / `**Conflict**`). Notable cross-kb changes may also go in
  `knowledge/log.md`.

## Reading

### Currency & history
- If you follow a link to a concept whose frontmatter says `status: superseded`, follow its
  `superseded_by` link to the current version and answer from **that**. Superseded concepts are kept
  for history (removed from the index, not deleted) — use them only when the user asks how something
  evolved over time.

### Contested knowledge — answer with nuance, not a flat yes/no
- When concepts are linked with `conflicts_with`, read the **anchor and all linked signals** before
  answering. Give a **hedged, sourced, time-aware** answer: separate what is confirmed by authoritative
  sources from what is only suggested by softer signals, with dates and sources. For example:
  *"Officially no per their docs (Jan); however 3 customer reports + chatter since Feb suggest an
  unannounced beta — unconfirmed."*

## Deeper reference
- Full **Open Knowledge Format** specification: `skill_read` `references/OKF_SPEC.md`.
- The guiding intent behind this whole approach (the "LLM Wiki" idea): `references/llm_wiki_abstract.md`.
