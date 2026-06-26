import {
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3'
import {
  brainDirectoryRecordSchema,
  brainDirectorySchema,
  type BrainDirectory,
  type BrainDirectoryRecord,
} from '../schemas/brain-directory'
import { directoryKey } from '../canonical-brain'

const maxWriteAttempts = 5

function createClient(region: string): S3Client {
  return new S3Client({ region })
}

function emptyDirectory(): BrainDirectory {
  return { formatVersion: 1, brains: {} }
}

function isMissingObject(error: unknown): boolean {
  return (
    error instanceof NoSuchKey ||
    (error instanceof S3ServiceException &&
      (error.$metadata.httpStatusCode === 404 || error.name === 'NoSuchKey'))
  )
}

function isConcurrentWrite(error: unknown): boolean {
  return (
    error instanceof S3ServiceException &&
    (error.$metadata.httpStatusCode === 409 || error.$metadata.httpStatusCode === 412)
  )
}

async function readDirectoryWithEtag(
  client: S3Client,
  bucket: string,
): Promise<{ directory: BrainDirectory; etag?: string }> {
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: directoryKey }))
    const content = await response.Body?.transformToString()
    if (!content) {
      throw new Error(`Customer Brain directory is empty: s3://${bucket}/${directoryKey}`)
    }

    return {
      directory: brainDirectorySchema.parse(JSON.parse(content)),
      etag: response.ETag,
    }
  } catch (error) {
    if (isMissingObject(error)) {
      return { directory: emptyDirectory() }
    }
    throw error
  }
}

async function updateDirectory(
  bucket: string,
  region: string,
  update: (directory: BrainDirectory) => BrainDirectory,
): Promise<BrainDirectory> {
  const client = createClient(region)

  try {
    for (let attempt = 1; attempt <= maxWriteAttempts; attempt++) {
      const current = await readDirectoryWithEtag(client, bucket)
      const next = brainDirectorySchema.parse(update(structuredClone(current.directory)))

      try {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: directoryKey,
            Body: `${JSON.stringify(next, null, 2)}\n`,
            ContentType: 'application/json',
            ...(current.etag ? { IfMatch: current.etag } : { IfNoneMatch: '*' }),
          }),
        )
        return next
      } catch (error) {
        if (isConcurrentWrite(error) && attempt < maxWriteAttempts) {
          continue
        }
        throw error
      }
    }
  } finally {
    client.destroy()
  }

  throw new Error(`Could not update s3://${bucket}/${directoryKey}`)
}

export async function listBrains(bucket: string, region: string): Promise<BrainDirectoryRecord[]> {
  const client = createClient(region)
  try {
    const { directory } = await readDirectoryWithEtag(client, bucket)
    return Object.values(directory.brains).sort((a, b) => a.brainId.localeCompare(b.brainId))
  } finally {
    client.destroy()
  }
}

export async function getBrain(
  bucket: string,
  region: string,
  brainId: string,
): Promise<BrainDirectoryRecord | undefined> {
  const client = createClient(region)
  try {
    const { directory } = await readDirectoryWithEtag(client, bucket)
    return directory.brains[brainId]
  } finally {
    client.destroy()
  }
}

export async function registerBrain(
  bucket: string,
  region: string,
  record: BrainDirectoryRecord,
): Promise<BrainDirectoryRecord> {
  const validated = brainDirectoryRecordSchema.parse(record)

  await updateDirectory(bucket, region, directory => {
    const existing = directory.brains[validated.brainId]
    if (existing) {
      if (
        existing.prefix === validated.prefix &&
        existing.status === validated.status &&
        JSON.stringify(existing.source) === JSON.stringify(validated.source)
      ) {
        return directory
      }
      if (
        existing.prefix === validated.prefix &&
        existing.status === 'ready' &&
        existing.source.type === 'created' &&
        validated.status === 'ready' &&
        validated.source.type === 'git'
      ) {
        directory.brains[validated.brainId] = {
          ...validated,
          createdAt: existing.createdAt,
        }
        return directory
      }
      throw new Error(`Brain is already registered: ${validated.brainId}`)
    }

    directory.brains[validated.brainId] = validated
    return directory
  })

  return validated
}

export async function updateBrainPrefix(
  bucket: string,
  region: string,
  brainId: string,
  prefix: string,
): Promise<BrainDirectoryRecord> {
  let updated: BrainDirectoryRecord | undefined

  await updateDirectory(bucket, region, directory => {
    const existing = directory.brains[brainId]
    if (!existing) {
      throw new Error(`Brain is not registered: ${brainId}`)
    }

    updated = brainDirectoryRecordSchema.parse({
      ...existing,
      prefix,
      updatedAt: new Date().toISOString(),
    })
    directory.brains[brainId] = updated
    return directory
  })

  return updated!
}
