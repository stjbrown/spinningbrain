# OKF Agent MVP Plan

**Status:** Draft 1 — 2026-06-26
**Goal:** Ship a repeatable, per-customer, OKF-compliant Mastra agent with a web front end and a Slack channel.

This plan deliberately *trims* the current spinningbrain platform machinery (multi-brain registry, git-import,
charter adaptation, `inbox/`, `._spinningbrain/`, archive export) down to a lean single-tenant-per-deployment
agent. Those features are a post-MVP platform layer, not MVP.

---

## 1. Product model (the shape we're building toward)

- **One customer = one R2 bucket + one deployment** reachable at `<customer>.agent.spinningbrain.io`.
- **The bucket root is the agent's workspace.** It contains exactly three things:

  ```text
  <customer-bucket>/
    knowledge/        # knowledge root: holds one or more OKF bundles ("kb"s). The agent's read/write surface.
      index.md        # CATALOG index: lists each kb + description (may carry okf_version frontmatter)
      log.md          # OPTIONAL cross-kb changelog
      ci/             # one kb = one portable OKF bundle
        index.md      # kb bundle root (may carry okf_version)
        log.md        # OPTIONAL per-kb log
        <concepts>.md
      personal/       # another kb, independently portable
        index.md
        <concepts>.md
    AGENTS.md         # customer-specific system-prompt additions; appended to instructions at runtime. Near-empty by default.
    skills/           # customer-specific skills (SKILL.md dirs). EMPTY by default.
  ```

  > **"kb" = one OKF bundle.** Multiple kbs (e.g. `ci/` and `personal/`) coexist in one deployed agent so a single
  > cross-kb prompt can span them, while each subdir stays a valid standalone OKF bundle that can be exported/forked
  > separately later (git-per-kb export is **post-MVP**).

### Multi-KB design (OKF-conformant)
- OKF supports this natively: a bundle MAY be a subdirectory of a larger tree (spec §3), and `index.md`/`log.md` MAY
  appear at any level. `log.md` is **never required** (conformance §9 only needs parseable frontmatter + non-empty `type`).
- **Each kb is a self-contained OKF bundle** — copying `knowledge/<kb>/` out yields a conformant standalone bundle.
- `knowledge/index.md` is a **catalog**: it lists the kbs (subdirs) with descriptions. The agent reads it first
  (progressive disclosure), then drills into the relevant kb's own `index.md`.
- **Link resolution:** the agent treats `knowledge/` as its resolution root, so cross-kb references are written
  `/ci/...`, `/personal/...`. Intra-kb links may use the same workspace-root-absolute form for MVP simplicity.
  Standalone export of a single kb requires rewriting `/<kb>/...` → `/...` at export time — a designed-for transform,
  **not in MVP scope**.
- The `okf-read` / `okf-write` skills encode: catalog-first traversal, the `/<kb>/` link convention, and the rule that
  every kb must independently satisfy OKF conformance.

- **Product-level skills live with the agent**, not in the bucket. At minimum an **OKF skill** (the spec + how to
  read and write conformant OKF). Customer `skills/` is for per-customer extensions and merges on top.
- **One agent, multiple transports.** Web and Slack are thin adapters over the *same* agent + workspace + memory.
  No separate "Slack agent". Channel-specific formatting happens at the edge.

### What this drops from the current repo (for MVP)
- `brains/{id}/` multi-brain layout and `._spinningbrain/directory.json` registry → **gone**; one bundle per bucket.
- `import-git-brain`, `inspect-git-source`, `export-brain-archive`, `list-brains` workflows → **parked** (move out of `index.ts`).
- Charter adaptation / `inbox/` shared-evidence model → **parked**.

### What it keeps / reuses
- Agent factory + memory (LibSQL) wiring (`agents/`, `memory/`, `storage.ts`).
- Workspace wiring (`workspaces/spin-workspace.ts`) — repointed at R2.
- `docs/research/OKF_SPEC.md` — becomes a bundled reference inside the OKF skill.

---

## 2. Architecture

```text
                ┌──────────── R2 bucket = Workspace (per customer) ────────────┐
                │  knowledge/ (OKF bundle)   AGENTS.md   skills/ (customer)     │
                └───────────────────────────────▲──────────────────────────────┘
                                                 │ @mastra/s3 S3Filesystem (R2 endpoint)
                                   ┌─────────────┴─────────────┐
                                   │   Spin agent (one)         │
   product skills (createSkill) ──▶│   - OKF read + write skill │◀── AGENTS.md appended to instructions
                                   │   - LibSQL memory          │
                                   └─────────────▲─────────────┘
                                                 │ agent.generate({ messages, memory:{ thread, resource } })
                  ┌──────────────────────────────┼──────────────────────────────┐
                  ▼                               ▼                              ▼
            Web chat UI                    Slack adapter                  Studio (dev only)
       (Mastra /api/agents/.../stream) (registerApiRoute /slack/events)
```

---

## 3. Mapping to Mastra primitives (verified against installed `@mastra/core` / `@mastra/s3`)

| MVP need | Mastra primitive | Notes |
|---|---|---|
| R2-backed workspace | `S3Filesystem` with `endpoint`, `region: 'auto'`, `accessKeyId`/`secretAccessKey`, `forcePathStyle` | R2 is explicitly documented as supported. ~5-line config change in `spin-workspace.ts`. |
| OKF read/write knowledge | `Workspace` filesystem tools over `knowledge/` | Agent already reads/writes markdown; conformance is driven by the OKF skill + instructions. |
| Product-level OKF skill | `createSkill({ name, description, instructions, references })` on `agent.skills` | Bundle `OKF_SPEC.md` as a `references/` doc. Agent auto-gets `skill`, `skill_read`, `skill_search` tools. |
| Customer-specific skills | `Workspace({ skills: ['skills'] })` | Reads `skills/` prefix from the bucket. Empty by default. Merges with agent skills; agent-level wins on name clash. |
| `AGENTS.md` → system prompt | Dynamic `instructions` function reading `<root>/AGENTS.md` via the workspace filesystem and appending | The repo already does this pattern for the charter (`readSpinCharter`). Re-use it; trim to a plain AGENTS.md append. |
| Web + Slack endpoints | `registerApiRoute()` in `mastra.server.apiRoutes` (Hono context) | Built-in `/api/agents/{id}/stream` already serves the web chat; custom route handles Slack events. |

> Decision to confirm during build: whether to load `AGENTS.md` via a dynamic-instructions function (simple, matches
> existing code) or a workspace instructions processor. Default to the dynamic-instructions function for MVP.

---

## 4. OKF skill(s) — the core compliance deliverable

Create as **agent-level** skills via `createSkill()` so they travel with every deployment regardless of bucket contents.
Split into two so the agent loads only what it needs:

1. **`okf-read`** — how to traverse a bundle: read `index.md` first (progressive disclosure), follow bundle-relative
   `/path.md` links, tolerate unknown `type`/broken links/missing fields (per spec §9 permissive consumption).
2. **`okf-write`** — how to author conformant concepts: required `type` frontmatter, recommended
   `title`/`description`/`resource`/`tags`/`timestamp`, reserved files (`index.md`, `log.md`), `# Citations`
   convention, absolute bundle-relative links, and updating `log.md` on changes.

Both bundle `references/OKF_SPEC.md` (copied from `docs/research/OKF_SPEC.md`) so the agent can `skill_read` the full
spec on demand. Optionally add a small **`okf_lint` tool** later that validates a file's frontmatter has a non-empty
`type` and reserved files are well-formed — not required for MVP conformance but a strong quality guardrail.

---

## 5. Phased build

### Phase 0 — Lean the repo (no behavior change yet)
- Move parked workflows out of `src/mastra/index.ts` registration (keep files; stop wiring them).
- Reduce the agent's workflow set to none (or just a future `provision` hook). Trim instructions.
- **Exit:** typecheck clean, `mastra dev` boots a single agent with no multi-brain workflows.

### Phase 1 — OKF agent on R2 (the vertical slice) ⭐
- Repoint `spin-workspace.ts` `S3Filesystem` at R2 (endpoint, `region:'auto'`, R2 keys, `forcePathStyle`).
- Workspace `basePath`/prefix = bucket root; knowledge root = `knowledge/`; `skills: ['skills']`.
- Add `okf-read` + `okf-write` `createSkill()` definitions (catalog-first traversal, multi-kb link convention); attach to the agent.
- Rewrite agent instructions: OKF operating loop + dynamic `AGENTS.md` append.
- Seed a test bucket: `knowledge/index.md` (catalog) + one starter kb (`knowledge/ci/index.md`), empty `AGENTS.md`, empty `skills/`.
- **Exit:** in Studio, agent reads the catalog, answers from a kb, writes a conformant new concept into a kb, updates that kb's `log.md`, all on R2. Bonus: a cross-kb prompt spanning two seeded kbs.

### Phase 2 — Provisioning (repeatable customer launch)
- A `provision` script/workflow: create R2 bucket `<customer>`, seed the 3-item skeleton (`knowledge/index.md` catalog + AGENTS.md + empty `skills/`; kbs created on demand), return the workspace URL.
- Config map from `<customer>` → bucket name (convention: bucket name = customer slug).
- **Exit:** one command stands up a new empty customer workspace.

### Phase 3 — Web front end
- Minimal chat UI calling the agent's `/api/agents/{id}/stream`. Fastest path: Mastra client + `assistant-ui`
  (or a hand-rolled streaming chat). Pass a stable `thread` + `resource` per browser session.
- **Exit:** browser chat talks to the OKF agent end-to-end against R2.

### Phase 4 — Slack channel
- `registerApiRoute('/slack/events', ...)` handling URL verification + `event_callback` (`app_mention`/`message`).
- Map Slack `channel:thread_ts` → memory `thread`, Slack team/user → `resource`. Format replies as Slack mrkdwn.
- Verify Slack signing secret in middleware. Respond within 3s (ack) then post via `chat.postMessage`.
- **Exit:** mention the bot in Slack, get an OKF-grounded answer in-thread.

### Phase 5 — Per-customer deploy + subdomains
- Single Node deployment per customer (Fly/Render) with env-injected R2 bucket + Slack creds.
- Wildcard DNS `*.agent.spinningbrain.io` → per-customer instances (or one router process resolving subdomain → bucket).
- **Decision:** instance-per-customer (simplest, strongest isolation) vs single multi-tenant process keyed by `Host`
  header → bucket. Recommend **instance-per-customer** for MVP isolation; revisit if cost/ops pushes to multi-tenant.

---

## 6. Environment / config

```bash
# R2 workspace
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
SB_BRAIN_BUCKET=<customer-slug>          # bucket = workspace root
R2_ENDPOINT=https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com

# Model + memory
OPENROUTER_API_KEY=...                    # current model: openrouter/deepseek (revisit per deployment)
SB_MEMORY_PATH=.mastra/spinningbrain.db   # LibSQL conversational memory

# Slack (Phase 4)
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
```

---

## 7. Open questions to resolve before/while building
1. **Model** — keep openrouter/deepseek, or move to a deployment-configurable model (ci-os-aws uses Bedrock)?
2. **Web UI stack** — `assistant-ui` vs minimal hand-rolled streaming chat vs Next.js. Recommend assistant-ui for speed.
3. **Deploy target** — Fly vs Render vs Cloudflare Workers. Workers pairs naturally with R2 but constrains Mastra/Node; recommend a Node host (Fly/Render) for MVP, revisit Workers later.
4. **Provisioning trigger** — CLI script vs an admin endpoint vs a control-plane agent. CLI script for MVP.
5. **`okf_lint` tool** — include in MVP as a write-time guardrail, or defer? Lean defer; add if write quality wobbles.

---

## 8. Reference: relationship to the two source projects
- **ci-os-aws** is the proof that "Mastra workspace over an OKF markdown bundle" = a working OKF agent; it just lacks
  R2, a web UI, and channels. This MVP generalizes that into a repeatable, per-customer product.
- **spinningbrain.io (current)** has more machinery than the MVP needs; we keep its agent/memory/workspace scaffold and
  shelve the platform lifecycle features until after the MVP loop is proven.
