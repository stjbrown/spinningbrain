/**
 * Agent model. Configurable per deployment via SB_AGENT_MODEL (Mastra model-router string,
 * e.g. "openrouter/deepseek/deepseek-v4-flash" or "anthropic/claude-sonnet-4-6").
 */
export const DEFAULT_AGENT_MODEL =
  process.env.SB_AGENT_MODEL ?? 'openrouter/deepseek/deepseek-v4-flash'
