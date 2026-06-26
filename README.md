# Spinning Brain

A deployable agent that reads and maintains a customer's knowledge as
[Open Knowledge Format (OKF)](docs/research/OKF_SPEC.md) bundles, built on
[Mastra](https://mastra.ai).

> Under active development. See [docs/plans/OKF_AGENT_MVP_PLAN.md](docs/plans/OKF_AGENT_MVP_PLAN.md)
> for the MVP build plan.

## Model

- **One customer = one storage bucket = one deployment** (e.g. `<customer>.agent.spinningbrain.io`).
- **The bucket root is the agent's workspace.** It contains exactly:

  ```text
  knowledge/        # one or more OKF bundles ("kb"s) — the agent's read/write surface
    index.md        # catalog: lists each kb
    log.md          # optional cross-kb changelog
    <kb>/           # e.g. ci/, personal/ — each a self-contained, portable OKF bundle
      index.md
      log.md        # optional
      <concept>.md
  AGENTS.md         # customer-specific system-prompt additions, appended at runtime (near-empty by default)
  skills/           # customer-specific skills (empty by default)
  ```

- A **kb** is one OKF bundle. Multiple kbs coexist in a single deployment so one prompt can span
  them, while each kb stays independently portable (per-kb export is post-MVP).
- The agent ships with product-level **OKF skills** (`okf-read`, `okf-write`) that carry the spec and
  the rules for reading/writing conformant knowledge. Customer `skills/` merge on top.

## Storage

The workspace is an [R2](https://developers.cloudflare.com/r2/) (S3-compatible) bucket via Mastra's
`S3Filesystem`. Set `R2_ACCOUNT_ID` (endpoint is derived) and R2 access keys; with no R2 config it
falls back to AWS S3 and the default credential chain.

Conversational and observational memory are stored in a local LibSQL database (`SB_MEMORY_PATH`).

## Develop

```bash
cp .env.example .env        # fill R2 + OPENROUTER_API_KEY + SB_WORKSPACE_BUCKET
npm install
npm run okf:init            # initialize an empty workspace skeleton (the agent creates kbs on first run)
npm run dev                 # Mastra Studio at http://localhost:4111
```

The agent model is configurable via `SB_AGENT_MODEL` (a Mastra model-router string), defaulting to
`openrouter/deepseek/deepseek-v4-flash`.

## Channels (roadmap)

One agent, multiple transports — a web chat UI and a Slack adapter over the same agent + workspace +
memory. See the plan for phasing.

## Project structure

- `src/mastra/agents/` — the agent, its factory, and model config
- `src/mastra/skills/` — product-level OKF read/write skills
- `src/mastra/workspaces/` — R2-backed workspace wiring
- `src/mastra/memory/`, `src/mastra/storage.ts` — durable memory (LibSQL)
- `scripts/init-workspace.mjs` — initialize an empty workspace skeleton; the agent onboards the user and creates kbs (via `AGENTS.md`)
- `docs/research/OKF_SPEC.md` — the Open Knowledge Format specification
