# Domain Skill Packs (starting with a CI skill)

**Status:** Draft 1 — 2026-06-27 · design captured from discussion, not yet implemented
**Related:** [KNOWLEDGE_HANDLING_DESIGN.md](KNOWLEDGE_HANDLING_DESIGN.md) (the base model),
the `okf` workspace skill (`workspace-template/skills/okf/SKILL.md`), and the proof-of-core
comparison below.

## Context / why
Spin's one-shot Netskope ingest (a fresh demo, generic `okf` skill, cheap default model) produced a
faithful but flat summary. The mature **`~/projects/ci-os/wiki`** produced a far better CI artifact for
the *same* release (compare Spin `knowledge/netskope/release-notes-138-0-0.md` vs
`ci-os/wiki/competitors/netskope/2026-06_release_138.md`). The gap was **not a Spin capability gap** —
it came from (a) a CI-tuned lens/structure, (b) accumulation + entity pages, and (c) a stronger model.

Insight: encode CI expertise as an **optional, installable domain skill** (`skills/ci/`) rather than in
`AGENTS.md`. `AGENTS.md` is workspace-wide and would color *every* kb; a skill is loaded **on demand,
per kb**, so a CI kb gets the CI treatment while a personal kb stays plain OKF. This makes Spin a
platform for **domain packs** (CI now; legal / research / due-diligence later) — the payoff of having
moved OKF itself into a workspace skill.

## Layering
| Layer | Lives in | Scope | Holds |
|---|---|---|---|
| **`okf` skill** (base) | `skills/okf/` | always | domain-neutral mechanics: append-only, supersede-vs-conflict, references/provenance, entity-first, fan-out, cross-link |
| **`ci` skill** (domain pack) | `skills/ci/` | opt-in per kb | the CI lens, structure, competitive interpretation, grounded comparison |
| **`AGENTS.md`** | workspace root | per-customer | instance facts: who we are, who we track, our products |
| **per-kb declaration** | a kb's bundle-root `index.md` | that kb only | which domain skill(s) govern this kb |

## Per-kb opt-in (the key mechanism for "don't lock all kbs")
A kb declares its governing domain skill — e.g. `skills: [ci]` in the bundle-root `index.md`
frontmatter — and the base `okf` skill instructs: *"before working in a kb, check its index for declared
domain skills and load them."* So `knowledge/netskope/` → applies `ci`; `knowledge/personal/` → plain
OKF. The workspace *has* the skill; it's only *applied* where declared.
- **Caveat:** OKF restricts `index.md` frontmatter to `okf_version` (spec §11). Decide: pragmatically
  extend bundle-root index frontmatter with `skills:`, OR use a catalog/`_meta` convention. (Open #1.)

## Learnings split (from the Spin-vs-ci-os comparison)
**→ Fold into `okf` (general — every domain benefits):**
- **Entity-first:** durable concept/`_overview` pages that sources *feed*; dated items are the evidence
  trail, not the primary artifact.
- **Additive-vs-supersede fix:** event-like records (releases, news, dated reports) accumulate as a
  **timeline** — do NOT supersede them. (Spin's `138 supersedes 137` was wrong; ci-os keeping all
  releases was right.) Distinguish "a specific release" (immutable, additive) from "current/latest" (a
  pointer that updates). Supersede is for corrections/replacements only.
- Reinforce fan-out + aggressive cross-linking.

**→ Put in the `ci` skill (domain-specific):**
- **Lens:** competitive intelligence — extract net-new, decision-relevant signals; omit routine
  fixes/minor UI.
- **Competitive interpretation:** map each competitor move against *our* products and other
  competitors; call out gaps closed / parity / differentiation; add a "CI signal" takeaway.
- **Structure:** per-competitor bundle → per-product-area sub-bundles → `_overview` entity pages →
  comparison concepts → release timelines.
- **Source-authority tuned for CI** (official/release-notes = high; social/rumor = low) — overlaps with
  okf; the *specifics* live here / in AGENTS.md.

## Two-pole grounding (CI is relational)
The KB can only ground comparisons in its own knowledge. So a CI workspace needs **both poles as real,
ingested content**:
- a **home/internal kb** (our own products/positioning) — what we compare *against*,
- **per-competitor kbs**,
- **comparison concepts** linking a competitor concept ↔ a home concept, cited on both sides.

Rules the `ci` skill enforces:
- **Grounded-or-abstain:** comparisons must cite KB concepts on *both* sides. If a side is missing,
  **say so and offer to ingest it — never fabricate from the model's training-data memory** of
  "X vs Y." (Direct application of the base invariant *act on sources, not opinion*.)
- "Our products" is **ingested content**, not just a name in `AGENTS.md`.
- **Setup order:** establish the home base (ingest our own product docs) *before* competitors —
  otherwise the kb is half a comparison.

## Build sequence
1. **`okf` general-learnings update** (entity-first, additive-vs-supersede, fan-out/cross-link) — cheap,
   helps every kb. Quick win.
2. **`ci` skill pack** (`skills/ci/SKILL.md` + references) + the per-kb opt-in convention + two-pole
   grounding. Decide install path: seeded via a CI-flavored template vs an on-demand "skill installer".
3. **Re-run the Netskope ingest** with `ci` active *and a home/internal kb ingested*, then compare again
   to ci-os to measure the gap close. Independently, bump `SB_AGENT_MODEL` off the cheap default —
   synthesis depth/competitive insight is partly raw model capability.

## Open decisions
1. Per-kb skill-declaration mechanism: bundle-root `index.md` frontmatter `skills:` vs catalog/`_meta`.
2. CI skill distribution: part of a CI workspace template vs an in-agent skill installer (registry).
3. Structure: one `ci` kb with `internal/` + `competitors/` subdirs vs top-level `internal/` + per-
   competitor kbs; how comparison concepts are typed/linked (e.g. `type: Comparison`).
4. Where the competitor/our-product *lists* live (AGENTS.md instance config) vs the *content* (kbs).

## Evidence / exemplar
ci-os is the quality bar: `~/projects/ci-os/wiki/competitors/netskope/` (per-product-area release pages
+ `_overview.md` entity pages, comparison pages, wikilinks to `internal/zscaler/*`). Its edge is the
CI lens + two-pole content + accumulation — all of which this design makes reproducible in Spin.
