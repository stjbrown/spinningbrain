import { lstat } from 'node:fs/promises'
import { join } from 'node:path'
import {
  assertNoDestinationCollisions,
  mapDestinationPath,
  normalizeRepositoryPath,
} from '../canonical-brain'
import type {
  CharterResolution,
  CharterStrategy,
  GitImportPlan,
  GitImportRequest,
  ImportFile,
} from '../schemas/brain-portability'
import { fetchRemoteBranchSnapshot, readSnapshotFile, sha256 } from './git-source'

const defaultExclusions = ['.git', '.env', 'node_modules', '.mastra', 'artifacts']

function isExcluded(path: string, exclusions: string[]): boolean {
  return exclusions.some(exclusion => {
    const normalized = normalizeRepositoryPath(exclusion.replace(/\/\*\*$/, ''))
    return path === normalized || path.startsWith(`${normalized}/`)
  })
}

export function destinationForSource(
  sourcePath: string,
  request: GitImportRequest,
): string | undefined {
  const matches = request.mappings
    .map(mapping => {
      const destination = mapDestinationPath(sourcePath, mapping.from, mapping.to)
      if (!destination || mapping.to !== 'sources') {
        return destination
      }
      return `inbox/imports/${request.brainId}/${destination.slice('sources/'.length)}`
    })
    .filter((destination): destination is string => Boolean(destination))

  if (matches.length > 1) {
    throw new Error(`Source path matches multiple mappings: ${sourcePath}`)
  }

  return matches[0]
}

export function selectDiscoveredCharterStrategy(
  requestedStrategy: CharterStrategy,
  hasAgents: boolean,
  hasClaude: boolean,
): 'agents' | 'claude' | 'merged' | 'missing' {
  if (!hasAgents && !hasClaude) {
    return 'missing'
  }
  if (requestedStrategy === 'merge' || (requestedStrategy === 'auto' && hasAgents && hasClaude)) {
    return hasAgents && hasClaude ? 'merged' : hasAgents ? 'agents' : 'claude'
  }
  if (requestedStrategy === 'prefer-claude') {
    return hasClaude ? 'claude' : 'agents'
  }
  return hasAgents ? 'agents' : 'claude'
}

function selectCharterSourcePaths(
  request: GitImportRequest,
  snapshotFiles: string[],
): string[] {
  const hasAgents = snapshotFiles.includes('AGENTS.md')
  const hasClaude = snapshotFiles.includes('CLAUDE.md')
  const strategy = selectDiscoveredCharterStrategy(request.charterStrategy, hasAgents, hasClaude)

  return strategy === 'missing'
    ? []
    : strategy === 'merged'
      ? ['AGENTS.md', 'CLAUDE.md']
      : [strategy === 'agents' ? 'AGENTS.md' : 'CLAUDE.md']
}

export function createAdaptedCharterResolution(
  request: GitImportRequest,
  snapshotFiles: string[],
): CharterResolution {
  const adaptedCharter = Buffer.from(request.adaptedCharter)

  return {
    requestedStrategy: request.charterStrategy,
    appliedStrategy: 'adapted',
    sourcePaths: selectCharterSourcePaths(request, snapshotFiles),
    content: request.adaptedCharter,
    bytes: adaptedCharter.byteLength,
    sha256: sha256(adaptedCharter),
  }
}

export async function buildGitImportPlan(request: GitImportRequest): Promise<GitImportPlan> {
  const snapshot = await fetchRemoteBranchSnapshot(request.repository, request.ref)

  try {
    const files: ImportFile[] = []
    const excludedPaths: string[] = []
    const warnings: string[] = []
    const exclusions = [...defaultExclusions, ...request.exclude]

    for (const sourcePath of snapshot.files) {
      if (isExcluded(sourcePath, exclusions)) {
        excludedPaths.push(sourcePath)
        continue
      }

      const destinationPath = destinationForSource(sourcePath, request)
      if (!destinationPath) {
        excludedPaths.push(sourcePath)
        continue
      }

      const info = await lstat(join(snapshot.directory, ...sourcePath.split('/')))
      if (info.isSymbolicLink()) {
        throw new Error(`Symlinks are not supported in Brain imports: ${sourcePath}`)
      }
      if (!info.isFile()) {
        continue
      }

      const content = await readSnapshotFile(snapshot.directory, sourcePath)
      files.push({
        sourcePath,
        destinationPath,
        bytes: content.byteLength,
        sha256: sha256(content),
      })
    }

    assertNoDestinationCollisions(files)

    const charter = createAdaptedCharterResolution(request, snapshot.files)

    if (charter.sourcePaths.length === 0) {
      warnings.push('The adapted Brain Charter was created without a root AGENTS.md or CLAUDE.md source.')
    }
    for (const section of ['knowledge', 'inbox', 'skills']) {
      if (!files.some(file => file.destinationPath.startsWith(`${section}/`))) {
        warnings.push(`The import does not contain any ${section}/ files.`)
      }
    }

    const bySection: Record<string, { files: number; bytes: number }> = {}
    for (const file of files) {
      const section = file.destinationPath.split('/')[0]
      bySection[section] ??= { files: 0, bytes: 0 }
      bySection[section].files++
      bySection[section].bytes += file.bytes
    }
    bySection['AGENTS.md'] = { files: 1, bytes: charter.bytes }

    const effectiveExcludedPaths = excludedPaths.filter(path => !charter.sourcePaths.includes(path))

    return {
      ...request,
      resolvedCommit: snapshot.commit,
      files,
      charter,
      excludedPaths: effectiveExcludedPaths,
      warnings,
      totals: {
        files: files.length + 1,
        bytes: files.reduce((sum, file) => sum + file.bytes, 0) + charter.bytes,
        bySection,
      },
    }
  } finally {
    await snapshot.cleanup()
  }
}
