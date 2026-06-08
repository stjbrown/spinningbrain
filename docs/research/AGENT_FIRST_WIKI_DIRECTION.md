# Agent-First Wiki Direction

Captured: 2026-05-27

## Thesis

The strongest version of the hosted LLM Wiki is not a traditional SaaS wiki with AI features. It is an agent-first knowledge system where the primary interface is API/MCP access, and human-facing UI is exposed only where useful through MCP Apps views.

In this framing, the wiki is infrastructure:

- Agents read, query, update, lint, and reconcile the wiki through tools.
- Humans review and edit knowledge through focused UI views surfaced inside their agent environment.
- Obsidian compatibility remains valuable, but mostly as export, local sync, inspection, or power-user workflow.
- The hosted service is not trying to replace Notion, Confluence, or Obsidian as a general-purpose document app.

## Core Product Shape

The product should feel like an open company brain that any authorized agent can connect to, search, and answer from.

Primary surfaces:

- **MCP server** for agent access.
- **API** for direct integration.
- **MCP Apps UI views** for humans to inspect, approve, and edit notes.
- **Markdown/vault export** for portability and optional Obsidian workflows.

Non-primary surfaces:

- No full web app as the main experience.
- No standalone Notion-style editor as the default product.
- No attempt to make the browser UI the center of gravity.

## Why This Is Sharper

Most competitors start from the human UI:

- Docs app plus AI.
- Enterprise search plus chat.
- Wiki plus assistant.
- Knowledge base plus automation.

This direction starts from the agent interface:

> The wiki is a durable, permissioned memory layer for agents, with human review surfaces embedded where decisions happen.

That makes the product more aligned with the YC Company Brain idea and with the likely future of agentic work. Agents need reliable company context before they can safely execute tasks. A wiki maintained as an agent-readable substrate can become that context layer.

## Human Access Model

Humans still need to see and shape the knowledge, but they do not need a heavyweight app.

Useful MCP Apps views:

- Note viewer with backlinks, sources, owner, freshness, and permissions.
- Suggested-change review screen.
- Diff view showing proposed additions, removals, and source evidence.
- Claim provenance panel.
- Page health panel showing stale claims, conflicts, missing citations, and orphaned references.
- Lightweight markdown editor for direct edits.
- Source-to-page trace showing why a note changed.

The design goal: every human UI should be attached to a concrete workflow, not a general browsing destination.

## Agent Tooling

The MCP/API layer should expose verbs that match how agents work:

- `search_notes`
- `read_note`
- `answer_from_wiki`
- `list_backlinks`
- `get_note_graph`
- `get_overview`
- `list_coverage`
- `recent_changes`
- `propose_note_change`
- `review_pending_changes`
- `create_note`
- `update_note`
- `lint_wiki`
- `find_stale_claims`
- `find_conflicts`
- `trace_claim_sources`
- `export_vault`

Over time, the agent interface can become more opinionated:

- `ingest_source`
- `summarize_source`
- `reconcile_source_with_wiki`
- `prepare_context_bundle`
- `generate_agent_instructions`

The `answer_from_wiki` capability is core. It should not behave like generic RAG over files. It should search the wiki, read relevant notes, follow graph links when useful, synthesize a direct answer, cite supporting notes or claims, flag stale/uncertain context, and suggest when the answer should be filed back as durable wiki knowledge.

## Storage Model

The canonical hosted representation does not have to be a literal Obsidian vault, but it should preserve the useful properties of one:

- Markdown-compatible content.
- Stable note identifiers and slugs.
- Wikilinks or equivalent graph edges.
- Backlinks.
- Version history.
- Frontmatter-like metadata.
- Exportability.
- Optional local vault sync.

A likely architecture:

- Database for permissions, versions, provenance, review state, and graph indexes.
- Object/file storage for canonical markdown snapshots and source artifacts.
- Search index for lexical and semantic retrieval.
- MCP/API layer as the main product surface.
- Export pipeline that can render the hosted wiki as an Obsidian-compatible vault.

## Differentiation

This direction avoids competing head-on with mature wiki/document products.

Differentiators:

- Agent-native from day one.
- MCP-first rather than web-app-first.
- Human review embedded inside agent workflows.
- Suggestions and diffs instead of silent autonomous mutation.
- Permissions and provenance as core primitives.
- Obsidian compatibility without making Obsidian the product.
- Open access model: many agents can connect to the same knowledge layer.

## Key Open Questions

- What is the minimum useful hosted primitive: note store, MCP search/read, or full propose/review workflow?
- Should the first customer be individuals using local agents, small teams, or companies with SSO/RBAC needs?
- Should ingestion be part of the MVP, or should the MVP focus on serving and editing an existing agent-maintained wiki?
- How close should the canonical format stay to plain Markdown files?
- Is the first killer workflow agent memory, company support knowledge, engineering docs, research synthesis, or onboarding?

## MVP Candidate

A focused first version could be:

1. Hosted Markdown/wiki store with graph metadata.
2. MCP server exposing search, read, answer, backlinks, create, update, and propose-change tools.
3. MCP Apps note viewer.
4. MCP Apps diff/review view for suggested changes.
5. Basic version history and provenance fields.
6. Export to Obsidian-compatible vault.

This MVP would prove the core claim: agents can use the wiki as persistent, structured memory, while humans can review and steer changes without needing a full standalone app.

## Positioning

Short version:

> Agent-first company brain. Open wiki memory for any authorized agent, with human review through MCP Apps.

Longer version:

> A hosted, permissioned, Markdown-compatible knowledge layer designed primarily for agents. It exposes company knowledge through MCP/API, lets agents propose and maintain wiki updates, and gives humans focused review/edit views inside their agent environment.
