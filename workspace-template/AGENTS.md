# Workspace Setup

This knowledge workspace has just been initialized and currently contains **no knowledge bundles
(kbs)**. While the catalog at `knowledge/index.md` lists no bundles, treat every new conversation
as first-run setup.

## First-run onboarding (only while the catalog has no bundles)
1. Briefly greet the user and explain this is a fresh knowledge base with no bundles yet.
2. Ask what knowledge bundles (kbs) they want to start with. For each, get a short name/topic and a
   one-line description of what it will hold (offer examples: competitive intelligence, personal
   notes, product docs).
3. For each requested kb, using your `okf` skill so the bundle stays OKF-conformant:
   - Pick a short lowercase slug for the directory (e.g. `ci`, `personal`).
   - Create `knowledge/<slug>/index.md` as the bundle root: `okf_version` frontmatter, an
     `# <Title>` heading, the description, and an empty `# Concepts` section.
   - Create `knowledge/<slug>/log.md` with an initialization entry dated today.
4. Update the catalog `knowledge/index.md`: under `# Bundles`, add a bullet linking each new kb
   (`* [<Title>](<slug>/) - <description>`), replacing the "No bundles yet" placeholder line.
5. Append a dated entry to the root `knowledge/log.md` noting which bundles were created.
6. Confirm what was created and invite the user to start adding knowledge.
7. Finally, now that the workspace has at least one bundle, retire this onboarding so it never runs
   again: overwrite `AGENTS.md` at the workspace root, replacing ALL of its current contents and
   keeping none of this onboarding text. Write a short **knowledge-handling config scaffold** the
   customer can tune — these adjust the defaults built into your `okf` skill's behavior. Use this
   structure:
   - A top-level heading `# Customer Instructions`, then a one-line note that this file is appended to
     the agent's system prompt at runtime and is safe to edit.
   - A `## Knowledge handling preferences` section stating the defaults (and that per-kb overrides can
     be added under a `### <kb>` heading):
     - **Source-authority tiers** — High: official / primary sources (release notes, changelogs,
       filings, the entity itself). Medium: reputable secondary reporting. Low / rumor: community and
       social (forums, social posts, unverified word-of-mouth).
     - **Supersede threshold** — replace existing knowledge only on a High-tier change signal;
       otherwise record the disagreement as a conflicting signal and keep both.
     - **Cosmetic edits** — fixing typos, links, and metadata in place is fine; never rewrite a claim's
       meaning.
     - **Answer style** — when knowledge is contested, give a hedged, sourced, time-aware answer rather
       than a flat yes/no.

Once `knowledge/index.md` lists one or more bundles — or this onboarding section is no longer present
in `AGENTS.md` — setup is complete: operate normally per your base instructions.
