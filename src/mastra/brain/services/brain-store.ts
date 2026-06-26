import { S3Filesystem } from '@mastra/s3'
import {
  brainCharterKey,
  brainDescriptorKey,
  brainImportManifestKey,
  brainPrefix,
  createBrainDescriptor,
  createImportManifest,
} from '../canonical-brain'
import type { GitImportPlan } from '../schemas/brain-portability'
import { fetchRemoteBranchSnapshot, readSnapshotFile, sha256 } from './git-source'
import { createRootStore } from './inbox'

export function createBrainStore(bucket: string, region: string, brainId: string): S3Filesystem {
  return new S3Filesystem({
    id: `brain-store-${brainId}`,
    bucket,
    region,
    prefix: brainPrefix(brainId),
  })
}

export async function importGitPlan(plan: GitImportPlan): Promise<void> {
  const filesystem = createBrainStore(plan.bucket, plan.region, plan.brainId)
  const rootFilesystem = createRootStore(plan.bucket, plan.region)
  const manifestKey = brainImportManifestKey(plan.brainId)
  const charterKey = brainCharterKey(plan.brainId)

  if (await rootFilesystem.exists(manifestKey)) {
    const existingManifest = await rootFilesystem.readFile(manifestKey, {
      encoding: 'utf-8',
    })
    const manifest = JSON.parse(existingManifest.toString()) as {
      source?: { repository?: string; resolvedCommit?: string }
    }
    if (
      manifest.source?.repository === plan.repository &&
      manifest.source?.resolvedCommit === plan.resolvedCommit
    ) {
      return
    }
    throw new Error(
      `Brain already contains a different Git import: s3://${plan.bucket}/${brainPrefix(plan.brainId)}`,
    )
  }

  if (await rootFilesystem.exists(charterKey)) {
    throw new Error(`Brain already exists: s3://${plan.bucket}/${brainPrefix(plan.brainId)}`)
  }

  const snapshot = await fetchRemoteBranchSnapshot(plan.repository, plan.ref, plan.resolvedCommit)

  try {
    for (const file of plan.files) {
      const content = await readSnapshotFile(snapshot.directory, file.sourcePath)
      const contentHash = sha256(content)

      if (content.byteLength !== file.bytes || contentHash !== file.sha256) {
        throw new Error(`Approved source file changed: ${file.sourcePath}`)
      }

      const destinationStore = file.destinationPath.startsWith('inbox/')
        ? rootFilesystem
        : filesystem
      await destinationStore.writeFile(file.destinationPath, content, {
        recursive: true,
        overwrite: false,
      })
    }

    const charterContent = Buffer.from(plan.charter.content)
    if (
      charterContent.byteLength !== plan.charter.bytes ||
      sha256(charterContent) !== plan.charter.sha256
    ) {
      throw new Error('Approved adapted Brain Charter changed.')
    }
    await rootFilesystem.writeFile(charterKey, charterContent, {
      recursive: true,
      overwrite: false,
    })

    for (const file of plan.files) {
      const destinationStore = file.destinationPath.startsWith('inbox/')
        ? rootFilesystem
        : filesystem
      const imported = await destinationStore.readFile(file.destinationPath)
      const content = Buffer.isBuffer(imported) ? imported : Buffer.from(imported)

      if (content.byteLength !== file.bytes || sha256(content) !== file.sha256) {
        throw new Error(`Import verification failed: ${file.destinationPath}`)
      }
    }
    const importedCharter = await rootFilesystem.readFile(charterKey)
    const verifiedCharter = Buffer.isBuffer(importedCharter)
      ? importedCharter
      : Buffer.from(importedCharter)
    if (
      verifiedCharter.byteLength !== plan.charter.bytes ||
      sha256(verifiedCharter) !== plan.charter.sha256
    ) {
      throw new Error(`Import verification failed: ${charterKey}`)
    }

    const importedAt = new Date().toISOString()
    await rootFilesystem.writeFile(brainDescriptorKey(plan.brainId), createBrainDescriptor(plan.brainId), {
      recursive: true,
      overwrite: false,
    })
    await rootFilesystem.writeFile(
      manifestKey,
      createImportManifest(plan, importedAt),
      { recursive: true, overwrite: false },
    )
  } finally {
    await snapshot.cleanup()
  }
}
