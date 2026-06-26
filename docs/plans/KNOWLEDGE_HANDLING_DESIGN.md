# Knowledge Handling Design — how Spin treats ingested knowledge

**Status:** Draft 1 — 2026-06-26 · captured from design discussion, not yet implemented
**Related:** `docs/research/llm_wiki_abstract.md` (the pattern), `docs/research/OKF_SPEC.md` (the format),
`docs/research/AGENT_FIRST_WIKI_DIRECTION.md` + `INSIGHTS.md` (why provenance/maintenance is the moat),
`docs/plans/OKF_AGENT_MVP_PLAN.md` (the product).

## Context & purpose
Defines what Spin should and should not do with knowledge it ingests: how sources are preserved, how
synthesis is written, how change over time is represented, and how the knowledge base is maintained.
The goal is a knowledge model whose differentiator is **trust** — provenance, auditability, and a
faithful record of *what was believed when* — rather than a tidy always-current summary.

## Scope: domain-general
This is **not** a CI tool. The model is general research epistemics: tracking claims, sources,
confidence, and change over time. CI is used below only as a vivid worked example because it churns
fast. The same primitives apply to health/personal tracking, deep research, due diligence, travel,
reading, engineering docs, etc. Domain-specific behavior is confined to **source-authority tiers**,
which live in per-customer `AGENTS.md`, not in the product skill.

---

## 0. Operating philosophy — intent, invariants, latitude
Read everything below as a **default playbook, not a cage.** This inherits the posture of our own
sources: the abstract is "intentionally abstract… your LLM can figure out the rest," and OKF is
"minimally opinionated" with a "permissive consumption model." Spin should have wide latitude to use
its intelligence *within a small fence*.

**The intent (the "why" — give Spin this so it can reason from purpose when no rule fits):**
> Build a knowledge base its owner can **trust** — where you can always tell what's currently believed,
> what it rests on, and how that belief changed over time — and that **compounds** as it grows, doing
> the bookkeeping a human never would. The rules serve this goal; they are not the goal.

**The five hard invariants (never relax — these are what create the trust):**
1. **Never rewrite a claim** — append-only on *meaning*; a changed claim → new doc + supersede (§3, §5).
2. **Never lose provenance** — every concept cites a source or is marked user-originated; never invent
   sources (§2).
3. **Never destroy** — tombstone ≠ delete; superseded/held docs stay reachable (§5).
4. **Act on signals, not opinions** — supersede only on an authoritative change signal; otherwise
   hold/cross-link (§4).
5. **Make every change visible** — log it (§3, §7).

**Everything else is adaptable** — structure/subdirs, when to cluster, eager-synthesis vs read-time,
anchor conventions, confidence tiers, which frontmatter fields, what counts as a "material" change.
Start from the defaults; override with judgment.

**Deviation clause:** When you meet something that doesn't fit the model, stay within the five
invariants, prefer the least-destructive option, record your reasoning in `log.md`, and surface to the
human if you're genuinely unsure. The patterns here are not exhaustive.

> **Doc vs. prompt:** This document is the detailed reference for *us*. It is **not** what Spin reads.
> Spin's actual instructions (`okf-write` + `AGENTS.md`) must **lead with the intent + the five
> invariants**, express §3–§7 as "default playbook *with the why*," and include the deviation clause —
> never a verbatim wall of commandments. Dumping all the hard rules into the prompt is exactly how
> we'd crush its judgment.

---

## 1. Three layers (per the abstract), realized in OKF
| Layer | Where | Mutability |
|---|---|---|
| **Raw source** (canonical) | a `references/` concept's `resource:` → the original asset/URL; source material kept in `references/` and linked | immutable |
| **Synthesis** | normal concept pages, citing `references/...` | append-only on content (see §3) |
| **Schema** | `AGENTS.md` (+ the `okf-read`/`okf-write` skills) | config |

The fidelity layer is the OKF-native, **per-bundle** `references/` subdir (OKF §8), not a top-level
`raw/`. This keeps each kb a self-contained, independently portable bundle.

## 2. Reference concepts (provenance)
- One concept per source. `type: Reference` (spec casing). Provenance in **`resource:`** (OKF §4.1) —
  the canonical URL/asset. A Firecrawl crawl's `sourceURL` maps directly onto `resource:`.
- Keep source material (PDFs, images, etc.) **in `references/` and link to it**; the concept body
  carries the extracted text for retrieval.
- Pasted text with no source → agent **asks for a source URL**; if there genuinely is none, it's
  `type: Note` with no `resource:` (user-originated, distinct from sourced material).
- **N:1 provenance.** A source is stored **once** as a single `Reference`; the many concepts derived
  from it all **cite back** to it. Never duplicate the source per concept. (See §6 fan-out.)
  - Implication: re-verifying or updating a source means finding *all its citers* → we need
    **backlink resolution** (concept→source citations are one-directional; `list_backlinks` per
    `AGENT_FIRST_WIKI_DIRECTION.md`). The storage/index design must support it.

## 3. Append-only on content — the core rule
We never change what a document **asserts**. The test for any edit: *does it alter the claim?*

| Edit | Allowed | Rationale |
|---|---|---|
| Spelling/typo (`Netscope`→`Netskope`) | ✅ | doesn't change the claim |
| Fix broken link / add cross-link | ✅ | structure, not content |
| Normalize `type` / metadata | ✅ | metadata, not content |
| Add `supersedes`/`superseded_by`/`status` | ✅ | additive lineage |
| `"doesn't offer X"` → `"does offer X"` | ❌ | rewrites the assertion → **new doc + supersede** |

Keeping the original is the value: it records that the claim *was* true and *when* it changed.
Mutable files overall: `index.md` and cross-links only. `log.md` is append-only (OKF §7).

## 4. Relationships & confidence
Two relationship verbs (frontmatter fields + body links; `type` stays the concept *kind*):
- **`supersedes` / `superseded_by`** + `status: active|superseded` — authoritative replacement.
- **`conflicts_with`** — disagreement that is *not* resolved into replacement.

**Confidence is provenance-driven, not opinion-driven:** `confidence ≈ source-class × independent
corroboration count`. Source-class authority tiers (what counts as high/low confidence) are
**domain-specific and configured in `AGENTS.md`** (e.g. release-notes/official = high; first-party
note = medium-low; social = rumor). The *mechanism* is in `okf-write`; the *mapping* is per-kb config.

### Conflict ≠ supersession
Supersede **only** on a high-confidence change signal: same `resource:` re-fetched with new content;
an official change source (release notes/changelog/announcement); a fresh first-party datapoint on the
**same** entity+attribute; explicit "as of/now/launched/effective" from an authoritative source.
Spin acts on the *signal that the fact changed*, never on its own judgment of which claim is true.
Ambiguous → `conflicts_with` (non-destructive), never tombstone. Every supersession logs its reason.

## 5. The index = current-state projection
The agent retrieves **via the index, not search** — so the index is the entire retrieval surface.
- Index lists **active** concepts only. Truly-superseded docs are **removed from the index**
  (a tombstone, not a delete) and remain reachable only via the `superseded_by` chain, for history.
- **Pros:** no stale answers (Spin retrieves only current knowledge); index stays proportional to
  current knowledge, not total churn (it's in the hot path); cleaner traversal.
- **Cons / mitigations:** reachability depends on link integrity (no search fallback) → **orphan lint**
  (every superseded doc must keep a live inbound link); trend/history view leaves the index → that's
  what `log.md` is for; wrong supersede hides valid info → the high-confidence bar (§4) + conflict
  default prevent it.
- **Guardrails:** (1) atomic supersession — write successor, set links on both, drop from index as one
  operation; (2) orphan lint; (3) high supersede bar.

## 6. Evidence accumulation (belief tracking) — KISS: one stored thing, an immutable concept
Research is accumulating signals toward confidence; the KB models that with **immutable docs +
relationships only**. The crucial line is **immutable-synthesis (fine) vs. edit-in-place rollup
(banned)**: storing a synthesis is fine — it's just a normal concept; what we never do is keep a
*mutable* rollup that gets rewritten on every new signal (the thrash that an earlier
asserted-vs-assessment "regenerated projection" draft would have caused — dropped).

- **Ingestion is not 1:1 — it fans out.** One source may decompose into many concepts scattered
  across the KB, all citing the single stored `Reference` (N:1, §2). E.g. a "top colleges per trending
  major" list → a concept per college in `colleges/`, a new `majors/` subdirectory with a concept (or
  synthesis) per major, cross-links between them. This reinforces **atomic concepts** (one college =
  one concept), which is what makes later supersession granular.
  - Ingestion may **grow the structure**: creating `majors/` means also creating `majors/index.md` and
    updating the index at every affected level (the parent and the kb root). Append/regenerate on the
    index side; the underlying concepts remain immutable.
- Every claim/signal is its **own immutable doc** (a `Reference` or `Note`, carrying its source-class
  confidence per §4). Low-confidence signals that conflict with a high-confidence claim are **held**
  (`conflicts_with`), never discarded, never merged.
- Signals about the same question are **clustered by cross-link** (hub-and-spoke to a topic anchor —
  not a pairwise mesh). The anchor may be: a high-confidence claim (soft signals `conflicts_with` it);
  **a synthesis concept the agent writes** combining related signals; or, failing those, the first
  note as head.
- **Synthesis is a spectrum, not read-time-only.** Default is read-time (Spin reads the cluster and
  answers live). But the agent **may** write a synthesis eagerly at ingest when a cluster is clearly
  forming — that synthesis is a **normal immutable concept**: append-only, refreshed only by
  **supersession** (a fresh synthesis superseding the old, at the high-value bar), **never edited in
  place**. Its body may legitimately lag ("as of notes 1–2") because read-time reads the anchor **plus
  all linked signals** — the *cluster* is what's current, not any single doc.
- Example live answer (whether synthesized at read-time or read off an eager anchor + its links):
  *"Officially no per their docs (Jan); 4 unconfirmed reports since Feb suggest an unannounced beta —
  unconfirmed."* Nothing half-baked is persisted as mutable state.

### Lifecycle (falls out for free)
- **Contested/emerging:** append immutable signal docs, cluster by cross-link, synthesize on read.
- **Confirmed:** a high-confidence signal arrives → *now* write a real asserted concept (the
  compounding artifact), supersede the old claim (§5), and retain the soft signals re-linked as the
  early-signal trail (preserving the detection timeline: customer in Jan, chatter in Feb, confirmed in
  Apr). The "assessment" only ever existed as a live answer during the contested window.

### The one trade-off, and its escape hatch
Not storing the synthesis means Spin **re-derives it on each query** (re-reading the cluster) — the
cost the abstract warns about. Negligible for small clusters at MVP scale; only bites a topic that
accretes hundreds of signals and is queried constantly. The abstract's own remedy applies: *"good
answers can be filed back as new pages."* So synthesize-on-read by default; **optionally** file a
synthesis back as a normal append-only concept only when it is expensive to recompute or genuinely
valuable. Simplicity now; caching later, with no special doc class.

## 7. The lint / reconcile loop (scheduled maintenance)
Per `INSIGHTS.md`, proactive maintenance is the moat. The `conflicts_with` set is the worklist.
- **Worklist:** open conflicts + stale claims (a `resource:` not re-verified in N months) + orphan
  check (the §5 safety net) + missing cross-refs.
- **Four outcomes per conflict:** **promote → supersede** · **reconcile → plain cross-link** ·
  **hold → leave contested** (a legitimate steady state) · **escalate → human**.
- **It can generate the signal, not just route on it:** the loop re-fetches `resource:` URLs
  (Firecrawl) to detect whether the canonical source changed — the high-confidence trigger that
  promotes a held conflict to a supersession. Ingest stays conservative; verification is batched here.
  When a source *has* changed, the loop uses **backlinks** (§2) to find every concept that cited it and
  re-checks each (supersede the affected ones; unaffected citers stand).
- **Discipline:** obeys the same rules — only adjusts relationships/`status`/index and appends to
  `log.md`; never rewrites a body. Needs anti-thrash state (don't re-escalate what's already queued;
  record held-conflict signal strength + last-checked).
- **Escalations:** MVP = a plain markdown review queue (`status: needs_review` / `_review.md`); later
  the MCP Apps diff/review surface from `AGENT_FIRST_WIKI_DIRECTION.md`.
- **Implementation:** a scheduled Mastra workflow. Confirm the exact trigger/cron primitive against
  installed Mastra docs (via the `mastra` skill) at build time — do not assume the API.

## 8. Autonomy (resolves the parked question)
Because nothing is ever destroyed (append-only + tombstone-not-delete), letting Spin write directly is
low-stakes — every action is visible and reversible by following the chain. So:
- **Ingest:** autonomous, silent-but-logged. Safe by construction.
- **Human review:** belongs at the **conflict-resolution layer** (the lint loop's escalations), where
  the hard judgment actually is — not gating every write.
- All of this is an overridable default in `AGENTS.md` (e.g. "ask before superseding").

## 9. Division of responsibility
- **`okf-write` skill (durable mechanics, domain-neutral):** reference concepts + `resource:`; the
  append-only edit rule; supersede vs conflict + the high-confidence bar; index-as-projection;
  cluster-by-cross-link + synthesize-at-read (no stored assessment); relationship/`status` fields.
- **`AGENTS.md` (per-customer/per-kb tuning):** source-authority tiers; supersede-vs-cosmetic
  threshold; history/hedging verbosity; autonomy (ask-before-supersede); synthesis depth.
- **Scheduled workflow:** the lint/reconcile loop (§7).

## 10. Open decisions
1. Binary source storage — resolved: keep source material in `references/` and link. (Confirm any
   size/cost cap for large binaries in R2.)
2. Cosmetic-edit threshold — strict always-supersede vs cosmetic-in-place (recommended), as an
   `AGENTS.md` default.
3. ~~Assessment-as-projection / anchor convention~~ — **resolved (KISS, §6):** one stored synthesized
   thing, an immutable concept (append-only, refresh by supersession only — never edit-in-place).
   Synthesis is a spectrum (read-time by default; eager anchor when a cluster forms). Anchor may be a
   high-confidence claim, an agent-written synthesis concept, or the first note as head.
4. Escalation queue representation (markdown queue now → MCP Apps later) — confirm MVP shape.
5. Lint cadence + scope per kb (and re-verify interval N for stale claims).

## 11. Out of scope (post-MVP)
Per-kb git export with link rewriting; the MCP Apps review/diff UI; multi-tenant routing; any change to
the OKF spec itself (we operate within v0.1 — `resource:`, `references/`, producer-defined keys, open
`type`).
