import { posix } from 'node:path'
import type { GitImportPlan, ImportFile } from './schemas/brain-portability'

const canonicalRoots = new Set(['AGENTS.md', 'knowledge', 'sources', 'skills'])

export const platformPrefix = '._spinningbrain'
export const directoryKey = `${platformPrefix}/directory.json`

export function brainPrefix(brainId: string): string {
  return `brains/${brainId}`
}

export function brainMetadataPrefix(brainId: string): string {
  return `${platformPrefix}/brains/${brainId}`
}

export function brainDescriptorKey(brainId: string): string {
  return `${brainMetadataPrefix(brainId)}/descriptor.yaml`
}

export function brainCharterKey(brainId: string): string {
  return `${brainMetadataPrefix(brainId)}/charter.md`
}

export function brainImportManifestKey(brainId: string): string {
  return `${brainMetadataPrefix(brainId)}/import-manifest.json`
}

export function normalizeRepositoryPath(path: string): string {
  const normalized = posix.normalize(path.replaceAll('\\', '/')).replace(/^\.\/+/, '')

  if (
    !normalized ||
    normalized === '.' ||
    normalized.startsWith('/') ||
    normalized === '..' ||
    normalized.startsWith('../')
  ) {
    throw new Error(`Invalid repository path: ${path}`)
  }

  return normalized.replace(/\/+$/, '')
}

export function validateCanonicalPath(path: string): string {
  const normalized = normalizeRepositoryPath(path)
  const root = normalized.split('/')[0]

  if (!canonicalRoots.has(root)) {
    throw new Error(`Path is outside the canonical Brain structure: ${path}`)
  }

  if (root === 'AGENTS.md' && normalized !== 'AGENTS.md') {
    throw new Error(`AGENTS.md must be a file at the Brain root: ${path}`)
  }

  return normalized
}

export function mapDestinationPath(
  sourcePath: string,
  from: string,
  to: 'knowledge' | 'sources' | 'skills',
): string | undefined {
  const normalizedSource = normalizeRepositoryPath(sourcePath)
  const normalizedFrom = normalizeRepositoryPath(from)

  if (normalizedSource !== normalizedFrom && !normalizedSource.startsWith(`${normalizedFrom}/`)) {
    return undefined
  }

  const relative = normalizedSource.slice(normalizedFrom.length).replace(/^\/+/, '')
  if (!relative) {
    throw new Error(`Directory mapping must select files beneath ${from}`)
  }

  return validateCanonicalPath(`${to}/${relative}`)
}

export function assertNoDestinationCollisions(files: ImportFile[]): void {
  const seen = new Map<string, string>()

  for (const file of files) {
    const existing = seen.get(file.destinationPath)
    if (existing) {
      throw new Error(
        `Import path collision: ${existing} and ${file.sourcePath} both map to ${file.destinationPath}`,
      )
    }
    seen.set(file.destinationPath, file.sourcePath)
  }
}

export function createBrainDescriptor(brainId: string): string {
  return [
    'formatVersion: 1',
    'brain:',
    `  id: ${brainId}`,
    `  charter: ${brainCharterKey(brainId)}`,
    `  knowledge: ${brainPrefix(brainId)}/knowledge`,
    `  skills: ${brainPrefix(brainId)}/skills`,
    '  sharedInbox: inbox',
    '',
  ].join('\n')
}

export function createImportManifest(plan: GitImportPlan, importedAt: string): string {
  return `${JSON.stringify(
    {
      formatVersion: 1,
      importedAt,
      source: {
        type: 'git',
        repository: plan.repository,
        requestedRef: plan.ref,
        resolvedCommit: plan.resolvedCommit,
      },
      mappings: plan.mappings,
      charter: plan.charter,
      files: plan.files,
    },
    null,
    2,
  )}\n`
}
