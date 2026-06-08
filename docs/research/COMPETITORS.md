# LLM Wiki Competitor Review

## Direct implementations and forks

- **OmegaWiki**
  - Link: https://github.com/skyllwt/OmegaWiki
  - Notes: Claude Code skill ecosystem for research workflows, typed entities/edges, paper lifecycle support, presentation/poster generation.

- **Synthadoc**
  - Link: https://github.com/axoviq-ai/synthadoc
  - Notes: local-first wiki for document conversion, adversarial review, claim provenance, audit features.

- **Link**
  - Link: https://github.com/gowtham0992/link
  - Notes: local source-backed markdown memory, MCP server, local HTTP UI, searchable wiki and graph.

- **Synto**
  - Link: https://github.com/kytmanov/synto
  - Notes: plain Markdown wiki, Obsidian-friendly, local LLM support, no vector DB, now includes MCP server and query tools.

- **llm-wiki-manager**
  - Link: https://github.com/sametbrr/llm-wiki-manager
  - Notes: Claude Code skill covering bootstrap, ingest, query, update, lint, multi-wiki routing, and bookkeeping scripts.

- **LLM-WIKI-MCP**
  - Link: https://github.com/Electro-resonance/LLM-WIKI-MCP
  - Notes: MCP server + CLI, supports local Ollama/OpenAI-compatible models, recursive ingestion and local chat.

- **long-term-agent-memory**
  - Link: https://github.com/eslamgenio/long-term-agent-memory
  - Notes: filesystem-first agent memory and linked knowledge, emphasizes session history and durable memory.

- **FrameCode VibeWork**
  - Link: https://github.com/Sistema2D/FrameCode-VibeWork
  - Notes: documentation and governance framework for AI-assisted development, focuses on operational memory and context loss.

## Adjacent or conceptually related projects

- **NoH MiTaInA**
  - Link: https://nohmitaina.com/
  - Notes: desktop editor implementation with Claude Code / Codex CLI support.

- **MindHub**
  - Link: https://www.trymindhub.com/
  - Notes: knowledge base product built for Anthropic/OpenAI/Gemini models.

- **Maintainer Wiki Kit**
  - Link: https://gist.github.com/pjdurka/6793739c25db5c49a0386ab43f418d3f
  - Notes: open-source maintainer knowledge workflow for bus-factor problem and project documentation.

- **SciAI Wiki**
  - Link: https://github.com/cnpem/sci-ai-wiki
  - Notes: scientific wiki framework for papers and research, preserving provenance, relationships, and accumulated reasoning.

## Critique and risk voices

- **CIBFE / headkey.ai critique**
  - Link: https://headkey.ai/
  - Notes: alternative cognitive architecture approach, mentioned by critics as a more pluggable solution than wiki-first memory.

- **General market skepticism**
  - Notes: some commenters argued the pattern is overhyped and urged deeper research in IR/storage before relying on an LLM-wiki model.

## Notes for review

- Many existing projects share these common elements:
  - local-first markdown storage
  - Obsidian compatibility
  - MCP/agent integration
  - claim provenance and auditing
  - token/context efficiency strategies

- Key differentiation opportunities for a hosted service:
  - proactive maintenance automation
  - duplicate and hierarchy handling
  - enterprise-grade collaboration and security
  - hosted graph/search with local sync options
