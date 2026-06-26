import { Mastra } from '@mastra/core'
import { spinAgent } from './agents/spin-agent'
import { mastraStorage } from './storage'

// MVP: a single OKF agent over an R2-backed workspace. The legacy multi-collection lifecycle
// workflows (create, git-import, export-archive, list) are parked post-MVP and intentionally not
// registered here.
export const mastra = new Mastra({
  agents: { spinAgent },
  storage: mastraStorage,
})
