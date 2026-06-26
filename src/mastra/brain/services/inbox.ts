import { S3Filesystem } from '@mastra/s3'

export const inboxRoot = 'inbox'

export function createRootStore(bucket: string, region: string): S3Filesystem {
  return new S3Filesystem({ id: 'spin-root-store', bucket, region })
}

export async function ensureInbox(bucket: string, region: string): Promise<void> {
  const store = createRootStore(bucket, region)
  if (await store.exists(`${inboxRoot}/.keep`)) {
    return
  }

  try {
    await store.writeFile(`${inboxRoot}/.keep`, '', {
      recursive: true,
      overwrite: false,
    })
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
      throw error
    }
  }
}
