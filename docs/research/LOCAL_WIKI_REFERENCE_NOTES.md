# Local Wiki Reference Notes

Captured: 2026-05-27

Reference systems reviewed:

- `/Users/sbrown/projects/ci-os`
- `/Users/sbrown/projects/z-os`

These are reference examples for product feel and workflow. They should not be treated as implementation constraints for the hosted version.

## Quick Read

The local systems already demonstrate the core pattern: the wiki is a compiled knowledge artifact maintained by agents, not a document dump. The agent reads the index, follows links, searches pages, synthesizes answers, and files valuable answers back into the wiki.

The hosted product should preserve this loop, but expose it through API/MCP rather than assuming a local Obsidian vault as the primary interface.

## What Exists Locally

### ci-os

`ci-os` is a competitive intelligence operating system.

Observed shape:

- Markdown wiki at `wiki/`
- Raw ingest area at `ingest/raw/`
- Agent instructions in `AGENTS.md` and `CLAUDE.md`
- Mastra agents and tools under `src/mastra/`
- About 106 Markdown wiki pages
- Obsidian-compatible vault structure

Important parts:

- `wiki/00_index.md` is the main navigation surface for agents.
- `wiki/01_log.md` is an append-only operational audit trail.
- `_overview.md` pages are synthesized roll-ups for directories/entities.
- Source pages are generally append-only.
- Query outputs that become meaningful analysis are expected to be filed as new wiki pages.

Mastra tool layer already points toward the hosted/MCP shape:

- `search-wiki` searches across Markdown pages.
- `read-page` returns full page content.
- `get-overview` returns an entity overview plus child pages.
- `list-coverage` summarizes what the wiki covers.
- `recent-changes` exposes git-backed activity history.

The `ci-frontend` agent is especially relevant because it is explicitly a read-only query interface. Its instructions require search, page reading, synthesis, citations to wiki pages, stale-info warnings, and suggestions to file substantive analyses back into the wiki.

### z-os

`z-os` is a personal work wiki spanning people, product, customer zero work, themes, and actions.

Observed shape:

- Markdown wiki at `wiki/`
- Raw ingest area at `raw_ingests/`
- Agent instructions in `CLAUDE.md`
- Local skills in `.skills/`
- About 66 Markdown wiki pages
- Obsidian-compatible vault structure

Important parts:

- `wiki/00_index.md` routes the agent through people, product, themes, and program areas.
- `wiki/01_log.md` records ingests and updates.
- `wiki/02_actions.md` tracks durable action items across wiki entities.
- `_overview.md` pages act as living summaries for sections.
- Skills define user-facing workflows: ingest, query, lint, status, dashboard sync, summaries, and standup prep.

The `z-os-query` skill is highly relevant. It instructs the agent to:

- Start with `wiki/00_index.md`.
- Follow wikilinks across sections.
- Read relevant pages in full.
- Synthesize direct answers.
- Cite wiki pages.
- Surface non-obvious connections.
- Propose filing valuable answers back into the wiki.

This is the clearest expression of the agent-first wiki behavior.

## Product Lessons

### 1. Search and Answer Are Core

The hosted service cannot just expose note CRUD. The primary agent experience must support:

- Search the wiki.
- Read selected pages.
- Follow graph relationships.
- Synthesize an answer.
- Cite supporting pages or claims.
- Identify uncertainty or stale context.
- Suggest when the answer should become a durable page.

This means `answer_from_wiki` should be a core tool/API capability, not a later workflow.

### 2. The Index Is an Agent Routing Table

`00_index.md` works locally because it gives the agent a compressed map of the knowledge base. In the hosted version, this probably becomes a generated routing layer:

- Human-readable index page.
- Machine-readable note catalog.
- Search and graph index.
- Per-agent/user permission-filtered view of available knowledge.

The exact file does not matter. The function matters.

### 3. The Log Is an Audit Primitive

`01_log.md` is doing more than journaling. It gives the agent temporal context and gives the human trust in what changed.

Hosted equivalent:

- Append-only event log.
- Change history by note, source, actor, and workflow.
- Agent-readable recent activity endpoint.
- Human-readable activity view through MCP Apps.

### 4. Overview Pages Are Compiled State

`_overview.md` pages are the highest-value wiki pages because they collapse many source pages into an entity-level summary.

Hosted equivalent:

- Entity summary pages.
- Auto-maintained roll-ups.
- Freshness and source coverage indicators.
- Child-note inventory.
- Diffable updates when source material changes.

### 5. Query Results Should Compound

Both systems treat good answers as potential wiki additions. This is crucial. A hosted agent-first wiki should support an answer lifecycle:

1. Agent answers from existing wiki context.
2. Agent marks the answer as potentially durable.
3. Human can approve filing it as a page or update.
4. The filed answer becomes searchable future context.

This turns the wiki into compounding memory rather than a passive retrieval store.

### 6. Roles Matter

The local systems already distinguish between:

- Read/query agents.
- Maintainer/ingest agents.
- Triage/classification agents.
- Lint/status/report agents.

Hosted product should make these permissions explicit:

- Read-only agents can search and answer.
- Suggest-mode agents can propose changes.
- Maintainer agents can apply approved changes.
- Admin agents can configure sources, permissions, and policies.

### 7. Obsidian Is Useful but Not Central

The local experience benefits from Obsidian because Markdown, wikilinks, graph view, and vault browsing are ergonomic. But for the hosted product, Obsidian should be treated as:

- Export format.
- Local sync target.
- Power-user inspection surface.
- Trust/portability mechanism.

The primary interface remains MCP/API.

## Hosted Primitive Set

Minimum agent-facing tools should include:

- `search_notes`
- `read_note`
- `answer_from_wiki`
- `list_backlinks`
- `get_note_graph`
- `get_overview`
- `list_coverage`
- `recent_changes`
- `propose_note_change`
- `create_note`
- `update_note`
- `lint_wiki`
- `export_vault`

The first version of `answer_from_wiki` should return:

- Direct answer.
- Supporting note references.
- Confidence/staleness notes.
- Related pages read.
- Suggested durable follow-up, if any.

## Implication For The Product Direction

The product should be described as:

> An agent-native wiki memory layer that lets authorized agents search, read, answer from, and propose changes to a durable company brain.

That is more accurate than simply saying "open agent access wiki." The agent needs not only access, but a query/synthesis contract.
