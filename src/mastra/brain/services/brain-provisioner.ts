import { bootstrapCharter } from '../bootstrap-charter'
import {
  brainCharterKey,
  brainDescriptorKey,
  brainPrefix,
  createBrainDescriptor,
} from '../canonical-brain'
import { registerBrain } from './brain-directory'
import { createBrainStore } from './brain-store'
import { createRootStore } from './inbox'
import { upsertSpinBrainSection } from './spin-charter'

export async function provisionBrain(input: {
  bucket: string
  region: string
  brainId: string
}): Promise<string[]> {
  const filesystem = createBrainStore(input.bucket, input.region, input.brainId)
  const rootFilesystem = createRootStore(input.bucket, input.region)
  const charterKey = brainCharterKey(input.brainId)

  if (await rootFilesystem.exists(charterKey)) {
    throw new Error(`Brain already exists: s3://${input.bucket}/${brainPrefix(input.brainId)}`)
  }

  const files = [
    { path: 'knowledge/.keep', content: '' },
    { path: 'skills/.keep', content: '' },
  ]

  for (const file of files) {
    await filesystem.writeFile(file.path, file.content, { recursive: true })
  }
  await rootFilesystem.writeFile(charterKey, bootstrapCharter, { recursive: true, overwrite: false })
  await rootFilesystem.writeFile(brainDescriptorKey(input.brainId), createBrainDescriptor(input.brainId), {
    recursive: true,
    overwrite: false,
  })

  const now = new Date().toISOString()
  await registerBrain(input.bucket, input.region, {
    brainId: input.brainId,
    prefix: brainPrefix(input.brainId),
    status: 'ready',
    createdAt: now,
    updatedAt: now,
    source: { type: 'created' },
  })
  await upsertSpinBrainSection(input.bucket, input.region, input.brainId, bootstrapCharter)

  return [
    ...files.map(file => `${brainPrefix(input.brainId)}/${file.path}`),
    charterKey,
    brainDescriptorKey(input.brainId),
  ]
}
