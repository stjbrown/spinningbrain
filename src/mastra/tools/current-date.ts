import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

/**
 * Gives the agent a reliable clock. LLMs do not know the current date and will otherwise guess
 * (producing wrong `timestamp` fields and log dates). Call this whenever a real date/time is needed.
 */
export const currentDateTool = createTool({
  id: 'current_date',
  description:
    "Returns the current date and time in UTC. Use whenever you need today's date — log entries, timestamp frontmatter, \"as of\" notes — instead of guessing.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    iso: z.string().describe('Full ISO 8601 timestamp, e.g. 2026-06-27T14:30:00.000Z'),
    date: z.string().describe('Date only, YYYY-MM-DD'),
  }),
  execute: async () => {
    const now = new Date()
    return { iso: now.toISOString(), date: now.toISOString().slice(0, 10) }
  },
})
