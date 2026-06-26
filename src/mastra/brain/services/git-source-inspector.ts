import type { GitSourceInspection } from '../schemas/brain-portability'
import { fetchRemoteBranchSnapshot, readSnapshotFile } from './git-source'

const charterPreviewBytes = 50_000

const mappingCandidates = [
  { from: 'wiki', to: 'knowledge' },
  { from: 'knowledge', to: 'knowledge' },
  { from: 'ingest/raw', to: 'sources' },
  { from: 'raw_ingests', to: 'sources' },
  { from: 'sources', to: 'sources' },
  { from: '.agents/skills', to: 'skills' },
  { from: '.skills', to: 'skills' },
  { from: 'skills', to: 'skills' },
] as const

function containsPath(files: string[], path: string): boolean {
  return files.some(file => file === path || file.startsWith(`${path}/`))
}

export function suggestGitImportMappings(files: string[]): GitSourceInspection['suggestedMappings'] {
  return mappingCandidates
    .filter(mapping => containsPath(files, mapping.from))
    .map(mapping => ({ ...mapping }))
}

export async function inspectGitSource(
  repository: string,
  ref: string,
): Promise<GitSourceInspection> {
  const snapshot = await fetchRemoteBranchSnapshot(repository, ref)

  try {
    const topLevelPaths = [...new Set(snapshot.files.map(path => path.split('/')[0]))].sort()
    const suggestedMappings = suggestGitImportMappings(snapshot.files)
    const charters: GitSourceInspection['charters'] = []

    for (const path of ['AGENTS.md', 'CLAUDE.md'] as const) {
      if (!snapshot.files.includes(path)) {
        continue
      }
      const content = await readSnapshotFile(snapshot.directory, path)
      charters.push({
        path,
        content: content.subarray(0, charterPreviewBytes).toString('utf8'),
        bytes: content.byteLength,
        truncated: content.byteLength > charterPreviewBytes,
      })
    }

    const warnings: string[] = []
    if (charters.length === 0) {
      warnings.push('No root AGENTS.md or CLAUDE.md instruction file was found.')
    }
    if (suggestedMappings.length === 0) {
      warnings.push('No conventional Brain content paths were detected.')
    }

    return {
      repository,
      ref,
      resolvedCommit: snapshot.commit,
      files: snapshot.files.length,
      topLevelPaths,
      suggestedMappings,
      charters,
      warnings,
    }
  } finally {
    await snapshot.cleanup()
  }
}
