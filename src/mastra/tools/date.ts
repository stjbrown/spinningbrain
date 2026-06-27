import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

/**
 * A generic date/time tool. LLMs do not know the current date and are unreliable at date arithmetic,
 * so this resolves dates deterministically in JS. With no input it returns "now"; with `from` and/or
 * offsets it resolves a relative or absolute date ("45 days ago", "2 hours from a given time", etc.).
 *
 * For heavier work (filtering/aggregating many dated entries) the agent should use Code Mode and call
 * this as `external_date`; for a single date this tool alone is enough.
 */
export const dateTool = createTool({
  id: 'date',
  description:
    "Resolve a date/time deterministically. No input returns the current UTC date/time. Optionally pass `from` (ISO base; defaults to now) and/or `offsetDays`/`offsetHours`/`offsetMinutes` (negative = past) to compute a relative date — e.g. 45 days ago is { offsetDays: -45 }. Use this instead of guessing dates.",
  inputSchema: z.object({
    from: z.string().optional().describe('Base date/time as ISO 8601. Omit for the current time.'),
    offsetDays: z.number().optional().describe('Days to add (negative for the past).'),
    offsetHours: z.number().optional().describe('Hours to add (negative for the past).'),
    offsetMinutes: z.number().optional().describe('Minutes to add (negative for the past).'),
  }),
  outputSchema: z.object({
    iso: z.string().describe('Full ISO 8601 timestamp, e.g. 2026-06-27T14:30:00.000Z'),
    date: z.string().describe('Date only, YYYY-MM-DD'),
    weekday: z.string().describe('Day of week, e.g. Saturday'),
  }),
  execute: async ({ from, offsetDays, offsetHours, offsetMinutes }) => {
    const base = from ? new Date(from) : new Date()
    if (Number.isNaN(base.getTime())) {
      throw new Error(`Invalid 'from' date: ${from}`)
    }
    const ms =
      (offsetDays ?? 0) * 86_400_000 +
      (offsetHours ?? 0) * 3_600_000 +
      (offsetMinutes ?? 0) * 60_000
    const result = new Date(base.getTime() + ms)
    return {
      iso: result.toISOString(),
      date: result.toISOString().slice(0, 10),
      weekday: result.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
    }
  },
})
