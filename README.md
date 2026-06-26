# Spinning Brain

An agent-maintained company knowledge platform built with Mastra.

This project is currently under active development.

## Product Model

- **Spin** is the single customer-facing agent. It directly maintains every
  Brain in one customer Brain Store.
- A **Brain** is a specialized, agent-maintained body of company knowledge.
- Operationally, each Brain is an LLM-maintained, Obsidian-compatible Markdown
  wiki: a persistent, interlinked knowledge artifact that compounds over time.
- The root `AGENTS.md` is Spin's Charter. It contains platform-wide instructions
  plus a managed section for every Brain.
- The root `inbox/` is the shared immutable evidence layer. Each source is
  stored once and can drive knowledge updates in multiple Brains.
- All machine-managed configuration and state lives under `._spinningbrain/`.
- A customer's S3 bucket is its **Brain Store**. Each Brain occupies one prefix
  under `brains/`.

Spin is implemented as the conversational and lifecycle surface.
It uses Mastra observational memory for durable conversational continuity.
Broader cross-Brain synthesis remains future work.

## Test Brain

Spin uses a Mastra S3 workspace scoped to the entire customer bucket:

- `SB_BRAIN_BUCKET`
- `SB_BRAIN_REGION`

Copy `.env.example` values into `.env`, authenticate with AWS, and seed the
starter Brain:

```bash
aws login
npm run brain:seed
npm run dev
```

Spin uses `openrouter/deepseek/deepseek-v4-flash`; configure
`OPENROUTER_API_KEY` before running them.

Spin loads the root `AGENTS.md` Charter and directly works inside selected Brain
prefixes.

The Brain Store has these platform boundaries:

```text
AGENTS.md
inbox/
  <shared immutable sources>
brains/
  {brainId}/
    skills/
    knowledge/
      index.md
      log.md
      *.md
._spinningbrain/
  directory.json
  brains/{brainId}/
    descriptor.yaml
    charter.md
    import-manifest.json
  import-plans/
  exports/
```

Canonical Brain knowledge belongs in each Brain's `knowledge/`. Shared raw
sources remain separate at the Brain Store root. Derived pages cite their
supporting `inbox/` paths. Existing per-Brain `sources/` directories from
legacy imports remain readable but receive no new material.

Spin follows the LLM Wiki model described in
[`docs/research/llm_wiki_abstract.md`](docs/research/llm_wiki_abstract.md):

- Sources are immutable evidence.
- A source is stored once in the shared inbox and may inform multiple Brains.
- Spin turns evidence into durable, cross-linked knowledge rather
  than repeatedly retrieving raw documents from scratch.
- Existing knowledge pages are generally preserved as historical artifacts.
- New evidence usually becomes a new linked page. Older pages are annotated as
  superseded only when stronger evidence confidently replaces them, or marked
  as conflicting when uncertainty remains.
- Only designated living pages, such as indexes, logs, navigation, and
  current-state synthesis, are routinely updated.
- Queries synthesize from the Brain and can become new durable knowledge.
- Lint passes identify contradictions, stale claims, orphans, and coverage gaps.
- Knowledge files use portable Markdown, YAML frontmatter, and links that work
  in Obsidian.

## Create Brain Workflow

The `create-brain` Mastra workflow provisions a new unconfigured Brain in a
customer Brain Store. It accepts `bucket`, `brainId`, and `region`, then creates:

```text
brains/{brainId}/
  skills/.keep
  knowledge/.keep

._spinningbrain/brains/{brainId}/
  descriptor.yaml
  charter.md
```

The bootstrap Brain section instructs Spin to interview the user,
propose a Brain design, receive approval, replace the bootstrap Charter, and
initialize the approved knowledge structure. The workflow refuses to overwrite
a prefix that already contains `AGENTS.md`.

## Import Git Brain Workflow

The `import-git-brain` workflow migrates a pushed remote Git branch into the
canonical Spinning Brain structure. It accepts explicit legacy path mappings,
builds a file-by-file plan pinned to the remote commit SHA, and imports and
verifies the approved commit. The standalone administrative workflow uses
Mastra suspend/resume. Spin uses separate plan and execute workflows so chat
approval does not require manually resuming a workflow run.

The first version supports remote HTTPS branch imports only. It never reads a
local repository, executes imported code, or rewrites imported content.
Mappings to the legacy `sources` destination are stored once under
`inbox/imports/{brainId}/` at the Brain Store root.

Before collecting import choices, Spin uses a read-only Git source inspection
workflow to clone the remote branch and report its actual top-level paths,
conventional mapping suggestions, and root `AGENTS.md`/`CLAUDE.md` contents.
Spin then asks only about choices the repository inspection could not resolve.

Source `AGENTS.md` and `CLAUDE.md` files are migration inputs, not canonical
Brain Charters. Spin adapts their relevant domain purpose, knowledge model, and
maintenance rules into a new `adaptedCharter`, while removing local development
instructions and rewriting paths for the canonical Brain structure. Direct
source mappings to `AGENTS.md` are rejected. The exact adapted Charter, its
source files, and its hash appear in the approval plan and import manifest.

Example request:

```json
{
  "repository": "https://github.com/example/ci-os.git",
  "ref": "main",
  "bucket": "sb-wiki-bucket",
  "region": "us-east-1",
  "brainId": "ci-os-import-test",
  "charterStrategy": "auto",
  "adaptedCharter": "# CI OS Brain Charter\n\nMaintain competitive intelligence...",
  "mappings": [
    { "from": "wiki", "to": "knowledge" },
    { "from": "ingest/raw", "to": "sources" },
    { "from": ".agents/skills", "to": "skills" }
  ],
  "exclude": []
}
```

Set `SB_GIT_TOKEN` for private remote repositories. The token is supplied to Git
through the process environment and is never included in import plans or
manifests. Remote Git operations time out after 20 seconds by default; set
`SB_GIT_TIMEOUT_MS` to adjust this limit.

## Export Brain Archive Workflow

The `export-brain-archive` workflow snapshots a canonical Brain into a verified
ZIP archive. Archives preserve the canonical structure exactly and are written
outside the Brain prefix under:

```text
._spinningbrain/exports/{brainId}/{brainId}-{timestamp}.zip
```

This is the first portability and backup export. Canonical archive re-import and
Git pull-request export are planned next.

## Multi-Brain Runtime

Each customer S3 bucket is one Brain Store and contains a durable root-level
Brain directory:

```text
inbox/
brains/
  ci-os/
  z-os/
._spinningbrain/
  directory.json
```

Create and Git import workflows register a Brain in `._spinningbrain/directory.json` only after
its content is ready and update the Brain's managed section in root
`AGENTS.md`. Spin reads and maintains registered Brain prefixes directly.

```json
{
  "bucket": "sb-wiki-bucket",
  "region": "us-east-1",
  "brainId": "ci-os",
  "task": "Compare Zscaler and Netskope MCP server capabilities."
}
```

## Spin Agent

Spin exposes customer-scoped lifecycle workflows while handling ordinary Brain
work directly through its root workspace:

- Create a Brain
- List available Brains
- Import a pushed remote Git repository
- Inspect a pushed remote Git repository before choosing import mappings
- Export a Brain archive

Spin injects the configured customer bucket and region into every workflow. It
never asks the model or user to select a bucket. Git import planning stores an
immutable pending plan under `._spinningbrain/import-plans/` and returns a compact
summary plus `planId`. After explicit user approval, Spin executes that exact
stored plan without a second hidden suspend/resume approval.

Spin's conversation history and observational memory are stored in a durable
local LibSQL database. Set `SB_MEMORY_PATH` to control its location. Clients
must send a stable memory `thread` and `resource` with each request and should
send only the new message rather than the full conversation history.

## Project Structure

- `src/mastra/agents/` - Mastra agents
- `src/mastra/brain/` - Shared Brain behavior and bootstrap material
- `src/mastra/workflows/` - Deterministic platform workflows
- `src/mastra/workspaces/` - Workspace configuration
- `templates/brain/` - Test Brain seed templates
- `docs/research/` - Product and market research
