# Git Brain Portability Plan

## Objective

Build the first complete Spinning Brain portability lifecycle:

```text
Remote Git repository
  -> plan and approve migration
  -> canonical Brain in S3
  -> canonical archive export
  -> re-import into a fresh Brain
```

The first real migration target is the remote `ci-os` repository on its `main`
branch. The importer must not read or interact with local `ci-os` or `z-os`
repositories.

## Product Decisions

1. A Brain has one canonical Spinning Brain format after import.
2. Importers understand legacy repository layouts and migrate them into the
   canonical format.
3. Exporters only emit the canonical format. They do not reconstruct the
   source repository's legacy layout.
4. Every Git import resolves a mutable ref such as `main` to an immutable commit
   SHA before approval.
5. Import planning and execution are deterministic workflows, not agent tasks.
6. Imported repository code, hooks, scripts, and skills are never executed
   during import.
7. The first importer supports remote HTTPS Git repositories only.
8. The first exporter produces a downloadable canonical archive. Git push and
   pull-request export come later.

## Canonical Brain Format

Every imported and exported Brain uses this structure:

```text
.spinningbrain.yaml
.spinningbrain/
  import-manifest.json
AGENTS.md
knowledge/
sources/
skills/
```

`AGENTS.md` is the Brain Charter. `knowledge/`, `sources/`, and `skills/` retain
their existing platform meanings.

### Canonical Descriptor

`.spinningbrain.yaml` describes the canonical Brain, not its source migration:

```yaml
formatVersion: 1
brain:
  id: ci-os
  charter: AGENTS.md
  knowledge: knowledge
  sources: sources
  skills: skills
```

### Import Manifest

`.spinningbrain/import-manifest.json` records provenance and migration details:

```json
{
  "formatVersion": 1,
  "importedAt": "2026-06-12T00:00:00.000Z",
  "source": {
    "type": "git",
    "repository": "https://github.com/stjbrown/ci-os.git",
    "requestedRef": "main",
    "resolvedCommit": "full-commit-sha"
  },
  "charter": {
    "requestedStrategy": "auto",
    "appliedStrategy": "adapted",
    "sourcePaths": ["AGENTS.md", "CLAUDE.md"],
    "content": "# CI OS Brain Charter\n\nMaintain competitive intelligence...",
    "bytes": 1234,
    "sha256": "..."
  },
  "mappings": [
    { "from": "wiki", "to": "knowledge" },
    { "from": "ingest/raw", "to": "sources" },
    { "from": ".agents/skills", "to": "skills" }
  ],
  "files": [
    {
      "sourcePath": "wiki/00_index.md",
      "destinationPath": "knowledge/00_index.md",
      "bytes": 4211,
      "sha256": "..."
    }
  ]
}
```

The manifest is provenance. It is included in exports but is not required to
operate or re-import the canonical Brain.

## First-Version Scope

### Included

- Remote HTTPS Git source
- Public repositories and authenticated private repositories
- Branch, tag, or commit input
- Exact commit resolution
- Legacy-layout mapping supplied in the import request
- Import plan with counts, sizes, hashes, exclusions, and warnings
- Explicit approval using Mastra suspend/resume for the standalone workflow,
  or a durable pending-plan ID for Spin's conversational workflow
- Migration into canonical S3 paths
- Post-upload hash verification
- Canonical ZIP archive export
- Canonical archive re-import
- Round-trip verification

### Deferred

- Local repository import
- Automatic legacy-layout detection
- Repository-provided migration descriptors
- Git submodules
- Git LFS content download
- Incremental synchronization
- Export to Git branches or pull requests
- Scheduled Git backup
- Automatic content cleanup or link rewriting
- Brain Agent execution during import

## Mastra Structure

```text
src/mastra/
  brain/
    schemas/
      brain-descriptor.ts
      brain-manifest.ts
      brain-paths.ts
    services/
      brain-store.ts
      canonical-brain.ts
      git-source.ts
      import-planner.ts
      archive-exporter.ts
    migrations/
      legacy-layout.ts
  workflows/
    create-brain-workflow.ts
    import-git-brain-workflow.ts
    export-brain-archive-workflow.ts
    import-brain-archive-workflow.ts
```

Services contain Git, filesystem, hashing, archive, and S3 behavior. Workflows
orchestrate those services and expose lifecycle state. No general Git tool is
given to the Brain Agent.

## Git Import Workflow

Workflow ID: `import-git-brain`

```text
resolve-remote-ref
  -> fetch-source-snapshot
  -> build-import-plan
  -> suspend-for-approval
  -> validate-destination
  -> upload-canonical-brain
  -> verify-import
  -> write-descriptor-and-manifest
```

### Input

```ts
{
  repository: string
  ref: string
  bucket: string
  region: string
  brainId: string
  mappings: Array<{
    from: string
    to: 'knowledge' | 'sources' | 'skills'
  }>
  adaptedCharter: string
  exclude?: string[]
}
```

The first `ci-os` request uses:

```json
{
  "repository": "https://github.com/stjbrown/ci-os.git",
  "ref": "main",
  "brainId": "ci-os-import-test",
  "charterStrategy": "auto",
  "adaptedCharter": "# CI OS Brain Charter\n\nMaintain competitive intelligence...",
  "mappings": [
    { "from": "wiki", "to": "knowledge" },
    { "from": "ingest/raw", "to": "sources" },
    { "from": ".agents/skills", "to": "skills" }
  ]
}
```

### Planning Output

The approval plan must include:

- Repository URL, requested ref, and resolved commit SHA
- Proposed canonical mappings
- Included file count and total bytes by canonical section
- Excluded paths and reasons
- SHA-256 hash and byte count for every included file
- Warnings for missing Charter, empty required sections, oversized files,
  unsupported links, and path collisions
- Destination Brain location

Approval must include the expected resolved commit SHA. Execution fails if it
does not match the plan.

### Remote Source Handling

Use an isolated temporary directory only as implementation storage:

- Fetch from the remote repository after resolving the ref.
- Disable Git hooks and never run repository commands or scripts.
- Read only tracked files from the resolved commit.
- Delete temporary data after success or failure.
- Treat credentials as runtime secrets and never write them into manifests,
  logs, or workflow outputs.

## Archive Export Workflow

Workflow ID: `export-brain-archive`

```text
validate-brain
  -> snapshot-canonical-files
  -> build-export-plan
  -> create-archive
  -> verify-archive
```

The ZIP root contains the canonical Brain directly:

```text
.spinningbrain.yaml
.spinningbrain/import-manifest.json
AGENTS.md
knowledge/
sources/
skills/
```

The export must preserve file bytes and paths exactly. The export report records
the Brain ID, export timestamp, file count, total bytes, and archive hash.

## Canonical Archive Re-Import

Workflow ID: `import-brain-archive`

Canonical archive import requires no legacy mappings:

```text
validate-archive
  -> inspect-descriptor
  -> build-import-plan
  -> suspend-for-approval
  -> upload-canonical-brain
  -> verify-import
```

Archive extraction must reject absolute paths, `..` traversal, duplicate paths,
and files outside the canonical structure.

## Implementation Phases

### Phase 1: Canonical Format Foundation

- Define Zod schemas for descriptor, manifest, mappings, and file records.
- Centralize canonical Brain paths and validation.
- Extract S3 Brain Store behavior from the existing Create Brain workflow.
- Add hashing and collision detection helpers.
- Add focused unit tests for schema and path validation.

Acceptance gate:

- A valid canonical Brain descriptor and manifest round-trip through schemas.
- Invalid paths and mapping collisions are rejected.
- Existing Create Brain behavior still builds successfully.

### Phase 2: Remote Git Import Planning

- Implement remote ref resolution and isolated snapshot fetch.
- Read tracked files from the exact resolved commit.
- Implement explicit legacy mappings and exclusions.
- Produce a complete serializable import plan.
- Add the Mastra approval suspension step.

Acceptance gate:

- Planning `ci-os/main` produces stable totals and an immutable commit SHA.
- The plan reads no local repository.
- Re-running against the same commit produces the same file hashes.
- No destination Brain files are written before approval.

### Phase 3: Git Import Execution

- Validate that the destination Brain does not exist.
- Upload mapped files into canonical paths with bounded concurrency.
- Write `.spinningbrain.yaml` and the import manifest.
- Verify every uploaded file by byte count and SHA-256.
- Clean temporary data after success or failure.

Acceptance gate:

- `ci-os` imports successfully into `ci-os-import-test`.
- Imported knowledge, sources, skills, and Charter match the approved plan.
- Any mismatch fails the workflow with a useful report.
- The live remote repository remains unchanged.

### Phase 4: Real-Brain Validation

- Point the Brain Agent at the imported `ci-os` Brain.
- Run representative queries against existing CI knowledge.
- Run a read-only lint/maintenance assessment.
- Record navigation, source-reference, skill-loading, and scale failures.

Acceptance gate:

- The Brain Agent loads the imported Charter.
- It can navigate and answer from existing knowledge pages.
- Failures become concrete backlog items rather than silent import mutations.

### Phase 5: Canonical Archive Export

- Snapshot all canonical Brain files.
- Generate and verify a canonical ZIP archive.
- Produce an export report with archive hash.

Acceptance gate:

- Archive contents exactly match the S3 Brain snapshot.
- No storage-provider-specific paths or metadata are required to understand it.

Current implementation note: archive export is implemented and writes verified
archives to `_spinningbrain-exports/{brainId}/`. Canonical archive re-import
remains Phase 6 work.

### Phase 6: Round-Trip Proof

- Import the canonical archive into a fresh Brain ID.
- Compare descriptors, canonical paths, and file hashes.
- Exclude only explicitly instance-specific provenance fields from equality.

Acceptance gate:

- `remote ci-os -> imported Brain -> archive -> fresh Brain` preserves all
  canonical files byte-for-byte.

## Testing Strategy

### Unit Tests

- Descriptor and manifest schemas
- Canonical path validation
- Legacy mapping behavior
- Exclusion behavior
- Path collision detection
- SHA-256 hashing
- ZIP traversal and duplicate-path rejection

### Integration Tests

- Small fixture Git repository served from a remote test URL
- Import planning without destination writes
- Suspend/resume approval with exact commit validation
- S3-compatible test store or isolated test prefix
- Archive export and canonical re-import

### Real-Data Acceptance Test

Use the remote `ci-os` repository only. The test is observational during import:
no source cleanup, content rewriting, local-repository access, or imported skill
execution.

## Known Risks

- Large repositories may make per-file plans and workflow state too large.
  Store large plans as durable artifacts and pass only references if needed.
- S3 filesystem reads and writes may convert text unless Buffer handling is
  used consistently. Verify binary files explicitly.
- Private Git authentication must not leak through command arguments, logs, or
  manifests.
- Mutable refs can change during planning. Approval and execution must remain
  pinned to the resolved commit.
- Imported skills may reference legacy repository paths. Import them unchanged
  and report incompatibilities after import.
- Legacy wiki links may reference source paths that changed during migration.
  Report these as migration warnings; do not rewrite them in version one.

## Definition Of Done

This milestone is complete when Spinning Brain can:

1. Plan and approve an import from the remote `ci-os` Git repository.
2. Migrate the approved commit into a canonical S3 Brain.
3. Verify the imported Brain file-by-file.
4. Load and query the imported Brain with the Brain Agent.
5. Export the Brain as a canonical archive.
6. Re-import that archive into a fresh Brain without legacy mappings.
7. Prove canonical file equality across the export/re-import round trip.
