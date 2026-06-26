import { Memory } from '@mastra/memory'

export function createSpinMemory() {
  return new Memory({
    options: {
      observationalMemory: true,
    },
  })
}
