import { mkdirSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { LibSQLStore } from '@mastra/libsql'

const configuredPath = process.env.SB_MEMORY_PATH ?? '.mastra/spinningbrain.db'
const storagePath = isAbsolute(configuredPath)
  ? configuredPath
  : resolve(process.env.INIT_CWD ?? process.cwd(), configuredPath)

mkdirSync(dirname(storagePath), { recursive: true })

export const mastraStorage = new LibSQLStore({
  id: 'spinningbrain-storage',
  url: pathToFileURL(storagePath).href,
})
