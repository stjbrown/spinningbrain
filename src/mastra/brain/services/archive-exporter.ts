import { ZipArchive } from 'archiver'
import { PassThrough } from 'node:stream'
import {
  brainCharterKey,
  brainDescriptorKey,
  brainImportManifestKey,
  brainPrefix,
  platformPrefix,
} from '../canonical-brain'
import { createBrainStore } from './brain-store'
import { createRootStore } from './inbox'
import { sha256 } from './git-source'

const exportableRoots = ['knowledge/', 'sources/', 'skills/']

function isExportable(path: string): boolean {
  return exportableRoots.some(root => path === root || path.startsWith(root))
}

async function createZip(files: Array<{ path: string; content: Buffer }>): Promise<Buffer> {
  const output = new PassThrough()
  const chunks: Buffer[] = []
  const zip = new ZipArchive({ zlib: { level: 9 } })

  output.on('data', chunk => chunks.push(Buffer.from(chunk)))
  const completed = new Promise<Buffer>((resolve, reject) => {
    output.on('end', () => resolve(Buffer.concat(chunks)))
    output.on('error', reject)
    zip.on('error', reject)
  })

  zip.pipe(output)
  for (const file of files.sort((a, b) => a.path.localeCompare(b.path))) {
    zip.append(file.content, { name: file.path, date: new Date('1980-01-01T00:00:00.000Z') })
  }
  await zip.finalize()

  return completed
}

export async function exportBrainArchive(input: {
  bucket: string
  region: string
  brainId: string
}): Promise<{
  archiveBucket: string
  archiveKey: string
  archiveBytes: number
  archiveSha256: string
  exportedFiles: number
  exportedBytes: number
}> {
  const brain = createBrainStore(input.bucket, input.region, input.brainId)
  const root = createRootStore(input.bucket, input.region)
  const entries = await brain.readdir('', { recursive: true })
  const paths = entries
    .filter(entry => entry.type === 'file' && isExportable(entry.name))
    .map(entry => entry.name)

  const descriptorKey = brainDescriptorKey(input.brainId)
  const charterKey = brainCharterKey(input.brainId)
  if (!(await root.exists(descriptorKey)) || !(await root.exists(charterKey))) {
    throw new Error(`Brain is not in canonical exportable form: ${input.brainId}`)
  }

  const files: Array<{ path: string; content: Buffer }> = []
  for (const path of paths) {
    const content = await brain.readFile(path)
    files.push({
      path: `${brainPrefix(input.brainId)}/${path}`,
      content: Buffer.isBuffer(content) ? content : Buffer.from(content),
    })
  }
  for (const key of [descriptorKey, charterKey, brainImportManifestKey(input.brainId)]) {
    if (!(await root.exists(key))) {
      continue
    }
    const content = await root.readFile(key)
    files.push({ path: key, content: Buffer.isBuffer(content) ? content : Buffer.from(content) })
  }

  const archive = await createZip(files)
  const archiveName = `${input.brainId}-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`
  const exportStore = createRootStore(input.bucket, input.region)
  const archiveKey = `${platformPrefix}/exports/${input.brainId}/${archiveName}`
  await exportStore.writeFile(archiveKey, archive, { recursive: true, overwrite: false })

  const written = await exportStore.readFile(archiveKey)
  const writtenBuffer = Buffer.isBuffer(written) ? written : Buffer.from(written)
  if (sha256(writtenBuffer) !== sha256(archive)) {
    throw new Error(`Archive verification failed: ${archiveName}`)
  }

  return {
    archiveBucket: input.bucket,
    archiveKey,
    archiveBytes: archive.byteLength,
    archiveSha256: sha256(archive),
    exportedFiles: files.length,
    exportedBytes: files.reduce((sum, file) => sum + file.content.byteLength, 0),
  }
}
