# OKF Adoption Plan

## Objective

Adopt the **Open Knowledge Format (OKF) v0.1**
([GoogleCloudPlatform/knowledge-catalog](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf),
local copy in [`docs/research/OKF_SPEC.md`](../research/OKF_SPEC.md)) as the
canonical on-disk format for Spinning Brain knowledge. Spin becomes a
conformant OKF **enrichment agent**: every Brain it maintains produces a
conformant OKF **Knowledge Bundle** that can be cloned, diffed, archived, and
exchanged across organizations with no Spinning Brain tooling required.

This is a format-conformance and authoring-contract effort, not a rewrite. Our
LLM Wiki model already uses markdown + YAML frontmatter, `index.md` for
progressive disclosure, `log.md` for history, and markdown cross-links. OKF
standardizes the small set of rules we were already approximating.

## Product Decisions

1. **The OKF bundle is `brains/{brainId}/knowledge/`.** Nothing else.
   - The Charter (root `AGENTS.md`), `skills/`, the shared root `inbox/`, and
     all `._spinningbrain/` state live **outside** the bundle and carry no OKF
     conformance obligation.
   - Consequence: OKF conformance rule §9.2 ("non-empty `type` on every
     non-reserved `.md`") binds only agent-authored knowledge pages.
2. **Spin is the enrichment agent.** It MUST author conformant concepts. The
   authoring contract lives in Spin's instructions and the bootstrap Charter.
3. **Legacy Git imports are warn-only.** Imported markdown is copied
   byte-for-byte (unchanged current behavior). Pages lacking a `type` field are
   reported as conformance warnings in the import plan, never auto-mutated and
   never rejected. Spin may bring them into conformance later as a maintenance
   pass.
4. **Exports are OKF bundles.** `export-brain-archive` (and the future
   canonical re-import) treat `knowledge/` as the OKF bundle root, including its
   `okf_version` declaration. The archive is a portable, standalone OKF bundle.
5. **OKF stays registry-free.** We do not introduce an OKF schema registry or
   central type authority. Our existing `._spinningbrain/.../descriptor.yaml`
   remains out-of-band platform metadata outside the bundle and does not
   participate in OKF conformance.
6. **House `type` vocabulary, not a locked taxonomy.** We define a small set of
   recommended `type` values for consistency, while consumers tolerate any
   value (per OKF §4.1).
7. **Raw evidence never enters the bundle.** Captured artifacts (scraped HTML,
   downloaded PDFs, binaries) live only in the shared root `inbox/`. They are
   non-conformant by nature and stay outside `knowledge/`. There is no `Source`
   concept type and no `references/` subdirectory — sources are cited inline, not
   modeled as concepts.
8. **Citations are inline markdown links, preferring the canonical origin.**
   Concepts cite sources in their `# Citations` body section as numbered markdown
   links (OKF §8). Cite the canonical origin URL when one is stable; cite the
   `inbox/` artifact path only as a fallback when no stable URL exists. See the
   Evidence & Citation Model below.
9. **These conventions are platform defaults; a Brain's `AGENTS.md` may override
   any of them — except `type`.** The full recommended frontmatter set, the house
   `type` vocabulary, citation practice, and link style are defaults Spin applies
   unless a Brain's Charter says otherwise. A Brain may, for example, require
   additional frontmatter keys, narrow its `type` vocabulary, or relax `resource`.
   The one non-negotiable is the OKF standard's required `type` field, which no
   Charter may waive.
10. **Standard markdown links are canonical; wiki links are tolerated on input
    and canonicalized.** Per OKF §5 and the proposed §5.4
    ([issue #44](https://github.com/GoogleCloudPlatform/knowledge-catalog/issues/44)),
    Spin emits standard markdown links (`[text](/path.md)`). It accepts
    `[[wikilink]]` input (authors from wiki tools type it by habit), warns on
    import when it finds them, and canonicalizes them to path-based markdown links.
    Ambiguous wiki links are surfaced for human disambiguation, never silently
    dropped. See Link Style below.

## Link Style

OKF deliberately lacks a flat global namespace — duplicate filenames (`index.md`,
`log.md`, and any repeated concept name) exist across directories — so a name-based
`[[proposal]]` reference is ambiguous, while a path-based `/work/a/proposal.md` is
not. OKF therefore specifies standard markdown links.

Our stance, aligned with the proposed OKF §5.4:

- **Produce** standard markdown links, bundle-relative (`[text](/path.md)`)
  preferred over relative.
- **Tolerate** `[[wikilink]]` and `[[wikilink|alias]]` on input rather than
  rejecting them.
- **Canonicalize** wiki links to path-based markdown links by resolving the
  target within the bundle.
- **Disambiguate, don't drop.** When a wiki-link name resolves to more than one
  path (or to none), surface it as a finding for human/agent resolution; never
  guess silently.

Wiki links are a **house lint finding**, not an OKF §9 conformance violation
(§9 is silent on link style). The conformance checker reports them separately
from hard conformance violations so an import is never blocked solely for using
wiki links.

## Evidence & Citation Model

A concept's `resource` frontmatter field **is its citation** for the common case:
the canonical URI of the source material the page is built from. A single-sourced
page needs nothing more. A separate `# Citations` body section (OKF §8) is an
**escalation**, used only when `resource` is insufficient:

- the page draws on **more than one** primary source, or
- specific claims need to be tied to specific sources, or
- a cited source differs from the page's canonical `resource`.

We do not add a `Source` concept type or a `references/` directory — sources are
referenced through `resource` and inline citations, never modeled as documents.

Two layers:

1. **`inbox/` — raw evidence & processing buffer (outside the bundle, shared,
   root-level).** Holds captured artifacts exactly as retrieved: Firecrawl HTML
   dumps, downloaded PDFs, other binaries. Immutable, deduplicated, and shared —
   a single artifact can support claims in multiple Brains. Non-OKF by nature,
   which is precisely why it lives outside `knowledge/`.

2. **Knowledge concepts.** Distill evidence into conformant concepts. Point
   `resource` at the canonical source; add `# Citations` only when one source
   isn't enough.

### Source-reference precedence

Whether in `resource` or in a `# Citations` link, reference the **most durable
canonical thing available**:

1. **Canonical origin URL** — e.g. a scraped page is referenced by its URL, not by
   our crawl. The `inbox/` HTML is a processing buffer and MAY be
   garbage-collected once distilled.
2. **`inbox/` artifact path** — the fallback when no stable URL exists (e.g. a
   downloaded PDF). The artifact is retained permanently and referenced directly
   as a path; record the original URL alongside it when known, even if it has
   since gone dead.

```markdown
---
type: Reference
title: Netskope MCP server
resource: https://netskope.com/blog/mcp-ga    # the citation for a single-sourced page
---
```

When more than one source is involved, escalate to a `# Citations` section:

```markdown
# Citations

[1] [Netskope MCP server announcement](https://netskope.com/blog/mcp-ga)
[2] [Acme security whitepaper (PDF)](/../inbox/sources/9f2a…-acme-security.pdf)
```

OKF §8 permits source links to be absolute URLs or paths; an `inbox/` artifact
path target lives above the bundle root, so it is referenced as a store path, not
a bundle-relative OKF link.

### Retention rule

- **URL-backed source:** `inbox/` copy is transient — keep during processing,
  eligible for GC afterward.
- **No-stable-URL source (e.g. PDF):** `inbox/` artifact is permanent and is the
  durable citation target.

## OKF Conformance Target (from spec §9)

A `knowledge/` bundle is conformant when:

1. Every non-reserved `.md` file contains a parseable YAML frontmatter block.
2. Every frontmatter block contains a non-empty `type` field.
3. Reserved files (`index.md`, `log.md`) follow §6 / §7 structure when present.

Plus our producer-side conventions (soft per OKF, but house standard — Spin
should follow them):

- **Adopt the full recommended frontmatter set as standard practice** on every
  knowledge concept, not just the required `type`:

  ```yaml
  ---
  type: <Type name>                  # REQUIRED
  title: <display name>
  description: <one-line summary>
  resource: <canonical URI for the source material>   # the page's citation
  tags: [<tag>, …]
  timestamp: <ISO 8601 last-modified datetime>
  # … other producer-defined keys as needed
  ---
  ```

  Fields are populated whenever the information exists; `resource` is omitted only
  for genuinely sourceless/abstract concepts.
- **`resource` is the citation** for a single-sourced page. Add a `# Citations`
  section only when one source isn't enough (multiple primary sources, or
  claim-level attribution). See the Evidence & Citation Model.
- Bundle-relative cross-links (`/path.md`) preferred over relative links.
- `# Citations`, when present, is numbered `[1] [text](url)`.
- `index.md` carries no frontmatter, except the bundle-root `index.md` which MAY
  declare `okf_version: "0.1"`.
- `log.md` uses bare ISO date headings (`## 2026-06-08`) with
  `* **Creation**:` / `* **Update**:` / `* **Deprecation**:` style entries.

## House `type` Vocabulary (initial)

Descriptive, self-explanatory, non-binding. Producers may add more; consumers
tolerate unknown values.

| `type`       | Use for                                                        |
|--------------|----------------------------------------------------------------|
| `Reference`  | A durable factual page about an external thing/system.         |
| `Synthesis`  | A current-state synthesis page that is routinely updated.      |
| `Decision`   | A recorded decision and its reasoning.                         |
| `Playbook`   | A procedure / runbook.                                         |
| `Question`   | An unresolved open question awaiting evidence.                 |

## Gap Summary (current state -> OKF)

| # | Area | Today | Action |
|---|------|-------|--------|
| 1 | `type` on concepts | Not required/enforced | Authoring contract + lint |
| 2 | `index.md` frontmatter | `type: index` + dates in template | Strip; root index keeps only `okf_version` |
| 3 | `log.md` format | `## [date] created \| ...` | Bare ISO heading + bold-verb entries |
| 4 | `okf_version` | Absent | Declare in bundle-root `index.md` |
| 5 | Citations | Prose convention | `# Citations` heading, numbered |
| 6 | Cross-links | Obsidian links | Prefer bundle-relative `/path.md` |
| 7 | Import conformance | Bytes verbatim, no check | Warn-only conformance + lint report in plan |
| 8 | Conformance check | None | New `okf` library (conformance + links) + `createScorer` wrapper + tests |
| 9 | Agent OKF awareness | None | OKF know-how as `createSkill()` agent skills + bootstrap Charter |
| 10 | Wiki links (`[[…]]`) | Not handled | Detect + warn + canonicalize to markdown links |
| 11 | Per-Brain overrides | Not modeled | Charter may override defaults; `type` non-waivable |
| 12 | Repair (links + frontmatter) | None | Repair tool runnable on import or standalone |

Reference points in current code:
- Seed templates: [`templates/brain/index.md`](../../templates/brain/index.md),
  [`templates/brain/log.md`](../../templates/brain/log.md),
  [`templates/brain/AGENTS.md`](../../templates/brain/AGENTS.md)
- Agent instructions: [`src/mastra/agents/spin-agent-factory.ts`](../../src/mastra/agents/spin-agent-factory.ts)
- Import planning: [`src/mastra/brain/services/import-planner.ts`](../../src/mastra/brain/services/import-planner.ts)
- Canonical paths/descriptor: [`src/mastra/brain/canonical-brain.ts`](../../src/mastra/brain/canonical-brain.ts)

## Mastra Primitives We Build On

Verified against the installed `@mastra/core@1.46.0` embedded docs and types.
Stability flags matter — two of these are alpha and one feature is not yet in the
installed version.

- **Agent skills** — `createSkill()` from `@mastra/core/skills` (**stable**,
  1.46). A skill is `{ name, description, instructions, references?,
  'user-invocable'?, metadata? }`; `references` bundles in-memory markdown the
  agent reads via the auto-injected `skill_read` tool. An Agent's `skills: SkillInput[]`
  (inline objects or `./path` strings) auto-adds `skill`, `skill_read`, and
  `skill_search` tools. `agent.getSkill(name)` / `agent.listSkills()` expose them
  to application code. Agent-level skills merge with workspace skills, agent-level
  winning on name conflicts. **We use this to ship Spin's OKF know-how as loadable
  skills instead of one giant instruction string.**
- **Custom scorers** — `createScorer({ id, description, type: 'agent', judge? })`
  with chained `.preprocess/.analyze/.generateScore/.generateReason` steps
  (**stable**). Critically, **function steps never invoke the judge** — a scorer
  built only from functions is deterministic and LLM-free. **OKF §9 conformance is
  deterministic, so it becomes a function-step scorer returning `1.0`/`0.0` now.**
  LLM `judge` steps (with `judge.model`/`instructions`, and per the 1.44 changelog
  optional judge `tools`/`memory`) are reserved for checks deterministic code
  can't make.
- **Goals** — Agent `goal: { judge, maxRuns, prompt?, scorer? }` with
  `setObjective/getObjective/updateObjectiveOptions/clearObjective`
  (**ALPHA**, added 1.42; "subject to breaking changes in minor versions").
  A durable, thread-scoped objective judged in-loop until satisfied or `maxRuns`
  is hit; `goal.scorer` accepts a custom scorer as the judge. Requires storage +
  a memory-backed thread (Spin already has both). **We use this to drive the
  repair/enrichment loop, with the conformance scorer as the gate.**
- **Eval gates** — `runEvals` `gates` ("scorers that must score 1.0 to pass",
  `{ scorer, threshold }`, `verdict`/`gateResults`) is **1.47-alpha — NOT in the
  installed 1.46**. The conformance *scorer* is usable now (on agent runs, traces,
  experiments, or directly via `.run()`); wiring it as a hard `runEvals` gate
  waits for 1.47 stable. Until then we gate in our own code by reading the
  scorer's score.

Adoption posture: build on the **stable** pieces (agent skills, `createScorer`
function steps) as load-bearing; treat **goals** and **eval gates** as
opt-in/experimental layers we can adopt without blocking the core work if the
alpha APIs shift.

## Implementation Phases

### Phase 1: OKF Conformance Library (foundation)

New module: `src/mastra/brain/okf/`

- `frontmatter.ts` — minimal, dependency-light YAML frontmatter parse/serialize
  helpers (parse block, get `type`, preserve unknown keys on round-trip per
  §4.1). Reuse an existing dependency if one is already present; otherwise a
  small purpose-built parser is acceptable for the constrained frontmatter we
  produce.
- `conformance.ts` — `checkBundleConformance(files)` implementing §9:
  parseable frontmatter, non-empty `type`, reserved-file structure. Returns
  structured `{ conformant, violations[], lint[] }`, never throws on
  non-conformance. **Violations** are hard §9 failures; **lint** are house-style
  findings (missing recommended frontmatter, wiki links, relative-not-absolute
  links) that do not affect conformance.
- `links.ts` — link tooling: detect markdown vs `[[wikilink]]`/`[[wiki|alias]]`
  forms; `resolveWikiLink(name, bundleFiles)` returning a unique path, multiple
  candidates (ambiguous), or none (broken); `canonicalizeLinks(content, …)`
  rewriting resolvable wiki links to bundle-relative markdown links and reporting
  ambiguous/broken ones for disambiguation.
- `concept-types.ts` — the house `type` vocabulary as exported constants
  (advisory; a Brain Charter may narrow it).
- `conformance-scorer.ts` — wrap `checkBundleConformance` as a Mastra
  `createScorer` using a **function `generateScore` step** (no judge, fully
  deterministic): `1.0` when a bundle has zero §9 violations, `0.0` otherwise,
  with a `generateReason` summarizing violations. This is the reusable gate object
  consumed by import reporting (Phase 4), export (Phase 5), and the repair loop
  (Phase 6). Pure library — registering it on `Mastra({ scorers })` or wiring it
  into `runEvals` gates (1.47) is deferred and optional.

Acceptance gate:

- Unit tests cover: missing frontmatter, empty/missing `type`, valid concept,
  reserved-file handling, unknown-key preservation on round-trip, broken-link
  tolerance, wiki-link detection, unique/ambiguous/broken wiki-link resolution,
  and canonicalization output.
- The checker separates hard §9 violations from house lint findings, and never
  reports wiki links as a conformance violation.
- The conformance scorer returns `1.0` for a conformant fixture and `0.0` with a
  useful reason for a non-conformant one — without making any LLM call.

### Phase 2: Conformant Seed Templates

- `templates/brain/index.md` — remove `type`/`created`/`updated` frontmatter.
  Bundle-root index MAY carry only `okf_version: "0.1"`. Body uses OKF index
  section format (`# Heading` + `* [Title](/path.md) - description`).
- `templates/brain/log.md` — remove frontmatter; bare ISO date headings
  (`## 2026-06-08`) and `* **Creation**: …` entries.
- `templates/brain/AGENTS.md` — Charter is outside the bundle; no OKF
  obligation. Keep as-is or drop its `type:` (cosmetic).
- Add a starter example concept (e.g. `templates/brain/knowledge/` example) only
  if useful for the seed; otherwise leave `knowledge/` empty with the
  conformant `index.md`/`log.md`.

Acceptance gate:

- A freshly seeded Brain's `knowledge/` passes `checkBundleConformance`.
- `npm run brain:seed` still succeeds.

### Phase 3: Spin OKF Authoring Contract (delivered as agent skills)

Deliver the authoring contract as **agent skills** via `createSkill()`
(`@mastra/core/skills`, stable in 1.46) rather than one large instruction string.
Spin loads them on demand through the auto-injected `skill`/`skill_read`/
`skill_search` tools, keeping the base system prompt lean and letting the OKF
know-how travel with the agent definition.

New module: `src/mastra/agents/skills/okf/` exporting inline skills:

- `okf-authoring` — how to write a conformant concept: required `type`, the full
  recommended frontmatter set, `resource`-as-citation with `# Citations`
  escalation, markdown links, reserved-file shapes. Bundle the OKF cheat-sheet and
  the house `type` vocabulary as `references` (e.g. `references: { 'frontmatter.md':
  …, 'type-vocabulary.md': …, 'examples.md': … }`) so Spin can `skill_read` them
  when authoring.
- `okf-evidence` — the Evidence & Citation Model: capture raw artifacts only in
  the shared root `inbox/`, never binaries in `knowledge/`; canonical-URL-first
  referencing with the `inbox/` path as fallback.
- `okf-repair` — how to canonicalize wiki links and backfill frontmatter (paired
  with the Phase 6 tooling).

Wire them onto Spin in
[`spin-agent-factory.ts`](../../src/mastra/agents/spin-agent-factory.ts) via the
Agent `skills: [...]` config. Keep only a short pointer in the base instructions
("Author Brain knowledge per the `okf-authoring` skill; never waive `type`").

The authoring contract content (used as each skill's `instructions`/`references`):

  - The `knowledge/` directory of each Brain is an OKF v0.1 bundle.
  - Every knowledge page MUST start with YAML frontmatter containing a non-empty
    `type`, and as house standard SHOULD populate the full recommended set —
    `title`, `description`, `resource`, `tags`, `timestamp` — whenever the
    information exists.
  - `resource` is the page's citation for a single-sourced concept. Add a
    `# Citations` section only when one source isn't enough (multiple primary
    sources or claim-level attribution).
  - In `resource` and any `# Citations` link, reference the canonical origin URL
    when stable; reference the `inbox/` artifact path only as a fallback when no
    stable URL exists (per the Evidence & Citation Model).
  - Emit standard markdown links, bundle-relative (`/path.md`). Do not author
    `[[wikilinks]]`; if source text contains them, canonicalize to markdown links
    and flag any ambiguous ones for disambiguation. `# Citations`, when present,
    is numbered.
  - These are platform defaults. Honor any overriding conventions stated in the
    Brain's own `AGENTS.md` Charter, except the required `type` field, which is
    never waivable.
  - Capture raw artifacts only in the shared root `inbox/`; never place binaries
    or non-markdown evidence inside `knowledge/`. Distill evidence into concepts
    rather than modeling sources as their own documents.
  - Maintain `index.md` (no frontmatter) and `log.md` (bare ISO dates) in the
    OKF-conformant shapes.
  - Prefer the house `type` vocabulary; introduce new descriptive types only
    when needed.
- Mirror the durable, Brain-facing subset of this contract into
  [`bootstrap-charter.ts`](../../src/mastra/brain/bootstrap-charter.ts) so newly
  provisioned and adapted Charters inherit it (skills configure Spin; the Charter
  records the contract for the Brain itself).

Note on per-Brain `skills/`: a Brain's S3 `skills/` directory is Brain *content*
Spin maintains, distinct from these agent-level operational skills. Surfacing the
active Brain's `skills/` as Mastra workspace skills (which merge with agent skills,
agent-level winning) is a natural follow-on but out of scope here.

Acceptance gate:

- `agent.listSkills()` on Spin includes `okf-authoring`, `okf-evidence`, and
  `okf-repair`; `getSkill('okf-authoring')` returns the expected instructions and
  references.
- Existing instruction tests (in
  [`test/canonical-brain.test.ts`](../../test/canonical-brain.test.ts)) still pass.
- A new test asserts Spin exposes the OKF skills and that the bootstrap Charter
  carries the Brain-facing contract.

### Phase 4: Import Conformance Reporting (warn-only)

- In [`import-planner.ts`](../../src/mastra/brain/services/import-planner.ts),
  after the file list is built, run `checkBundleConformance` over files mapped to
  `knowledge/` and add findings to the plan:
  - hard §9 **violations** (e.g. "knowledge/foo.md is missing required OKF `type`
    field"), and
  - **lint** findings, including wiki links detected
    (e.g. "knowledge/foo.md uses 3 `[[wikilink]]` references; 1 is ambiguous").
- Do NOT mutate bytes. Do NOT reject. Imported content remains verbatim
  (per decision 3). Repair is a separate, opt-in step (Phase 6).
- Surface violation and lint summary counts in the plan summary so Spin can
  report them and offer to run repair after import.

Acceptance gate:

- Importing fixture content with mixed conformant/non-conformant knowledge pages,
  including some wiki links, yields accurate violation + lint findings and zero
  content mutation.
- Conformant, markdown-linked imports produce no spurious findings.

### Phase 5: OKF Bundle Export

- Update `export-brain-archive` so the produced archive presents `knowledge/`
  as a self-contained OKF bundle, including the bundle-root `index.md` with
  `okf_version: "0.1"`.
- Decide archive layout: either keep the full canonical Brain in the archive
  (Charter + skills + knowledge) while guaranteeing the `knowledge/` subtree is
  a conformant OKF bundle, or add an explicit OKF-bundle export mode. Default:
  keep canonical archive, guarantee the embedded `knowledge/` subtree is
  conformant and `okf_version`-stamped.
- Run the conformance scorer during export and record its score + reason in the
  export report (non-blocking, since legacy imports may be non-conformant).

Acceptance gate:

- Export report includes an OKF conformance result for the `knowledge/` bundle.
- The exported `knowledge/` tree validates as OKF v0.1 (for Brains authored by
  Spin under the new contract).

### Phase 6: Repair Tooling (links + frontmatter)

A reusable repair capability built on the Phase 1 `okf` library, runnable in two
modes against a Brain's `knowledge/` bundle:

- **On import** — after an approved import, as an opt-in follow-up Spin offers
  based on the Phase 4 findings ("This import has 12 pages missing `type` and 30
  wiki links — repair now?").
- **Standalone maintenance** — invoked any time to pay down conformance debt on
  an existing Brain.

Repair scope:

- **Links:** canonicalize resolvable `[[wikilinks]]` to bundle-relative markdown
  links; collect ambiguous/broken ones into a disambiguation report instead of
  guessing.
- **Frontmatter:** add missing required `type` (inferred conservatively or
  prompted), backfill recommended fields (`title` from filename/heading,
  `timestamp`, etc.) without overwriting existing values; preserve unknown keys.
- **Reserved files:** normalize `log.md` headings/entries and regenerate
  `index.md` to the OKF shapes.

Repair principles:

- Always produces a reviewable change set (diff / proposed plan); never silent
  in-place mutation. The user/agent approves before write-back.
- Idempotent: re-running a repaired bundle is a no-op.
- Honors per-Brain Charter overrides (decision 9) when deciding what "fixed"
  means, but always enforces the non-waivable `type`.

Deterministic core, optional agent loop:

- The deterministic repairs (wiki→markdown canonicalization, frontmatter
  backfill, reserved-file normalization) are plain library functions — no LLM
  needed, and they are the load-bearing implementation.
- Where judgment is required (inferring a sensible `type`, disambiguating a
  wiki link with multiple candidates, summarizing a source for `description`),
  Spin handles it conversationally using the `okf-repair` skill.
- **Optional goal-driven mode (alpha):** model "bring `brains/{id}/knowledge` to
  OKF conformance" as a durable objective via `setObjective`, with the Phase 1
  conformance scorer supplied as `goal.scorer`. Spin then iterates — applying
  deterministic repairs and resolving the judgment cases — until the scorer
  returns `1.0` or `maxRuns` is hit. This makes repair self-verifying: the same
  deterministic check that defines conformance is the loop's gate. Gated behind
  the Goals alpha flag; the manual repair path is the non-alpha fallback.

Acceptance gate:

- Repairing a fixture bundle converts unique wiki links to markdown links,
  reports ambiguous ones, adds missing `type`, and leaves already-conformant
  content byte-stable.
- A repaired bundle passes `checkBundleConformance` (scorer returns `1.0`) with
  zero hard violations, and re-running repair changes nothing.
- The goal-driven mode, when enabled, terminates when the conformance scorer
  reaches `1.0` and parks (not loops forever) on hitting `maxRuns`.

## Testing Strategy

### Unit
- Frontmatter parse/serialize round-trip, unknown-key preservation.
- §9 conformance: missing frontmatter, empty/missing `type`, reserved-file
  shapes, broken-link tolerance; violations vs. lint separation.
- Link tooling: wiki-link detection, unique/ambiguous/broken resolution,
  canonicalization to bundle-relative markdown.
- Repair: wiki→markdown conversion, missing-`type` backfill, idempotence,
  byte-stability of already-conformant content.
- Per-Brain Charter override resolution (defaults vs. override; `type`
  non-waivable).
- Conformance scorer: `1.0` on a conformant fixture, `0.0` + reason otherwise,
  with no LLM call (function-step only).
- Seed templates conform.
- Spin exposes the OKF skills (`listSkills`/`getSkill`); bootstrap Charter carries
  the Brain-facing contract.

### Integration
- Git import over a mixed fixture (non-conformant frontmatter + wiki links):
  accurate violation + lint findings, byte-for-byte content preservation.
- Repair-after-import: import then repair yields a conformant bundle (scorer
  `1.0`); re-running repair is a no-op.
- Export: `knowledge/` archive validates as OKF v0.1 and is `okf_version`
  stamped.

> Goal-driven repair (alpha) and `runEvals` gate wiring (1.47) are validated
> opportunistically, not gating the suite, since they ride on alpha/not-yet-installed APIs.

## Out of Scope

- OKF schema registry or central type authority (OKF is registry-free).
- Auto-mutating or rejecting legacy imported content at import time (warn-only by
  decision; repair is a separate opt-in step).
- A locked/closed `type` taxonomy.
- Authoring `[[wikilinks]]` as an output form (we only tolerate + canonicalize
  them on input).
- Changing the role of `._spinningbrain/` descriptor/manifest metadata.
- Building an OKF graph visualizer / consumer UI (consumption tooling is a
  separate effort; this plan covers production conformance).
- Depending on alpha/not-yet-installed Mastra APIs for load-bearing behavior:
  Goals (alpha) and `runEvals` gates (1.47) are opt-in layers, never the core.
- Surfacing each Brain's S3 `skills/` as Mastra workspace skills (a natural
  follow-on to agent-level OKF skills, but not part of this milestone).

## Definition of Done

Spinning Brain adopts OKF v0.1 when:

1. A conformance library implements OKF §9 (violations vs. lint) plus wiki-link
   tooling, exposes a deterministic `createScorer` conformance gate, and is
   unit-tested.
2. Newly seeded and Spin-authored Brains produce conformant `knowledge/`
   bundles, `okf_version`-stamped at the bundle root, with standard markdown
   links.
3. Spin carries the OKF authoring contract as `createSkill()` agent skills
   (`okf-authoring`/`okf-evidence`/`okf-repair`) and the bootstrap Charter
   records the Brain-facing contract — honoring per-Brain Charter overrides
   except the non-waivable `type`.
4. Git import reports OKF violations and lint (including wiki links) without
   mutating or rejecting content.
5. The repair tool canonicalizes wiki links and backfills frontmatter on import
   or on demand, idempotently and with reviewable change sets; an optional
   goal-driven mode (alpha) loops until the conformance scorer returns `1.0`.
6. Exported archives present a conformant, portable OKF `knowledge/` bundle.
