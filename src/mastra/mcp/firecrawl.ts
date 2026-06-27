import { MCPClient } from '@mastra/mcp'

/**
 * Optional web-ingestion tools via the Firecrawl MCP server.
 *
 * Gated on a per-customer `FIRECRAWL_API_KEY`: when present we connect to Firecrawl's hosted MCP
 * endpoint and expose its full toolset (scrape / search / map / crawl / parse / extract / ...). When
 * absent (or if the connection fails), the agent simply has no web tools — web fetch is optional and
 * must never block boot. This module is the single seam for web tools; add more MCP servers here.
 */
type FirecrawlTools = Awaited<ReturnType<MCPClient['listTools']>>

const key = process.env.FIRECRAWL_API_KEY

let resolved = {} as FirecrawlTools
if (key) {
  try {
    const mcp = new MCPClient({
      id: 'firecrawl',
      servers: {
        firecrawl: { url: new URL(`https://mcp.firecrawl.dev/${key}/v2/mcp`) },
      },
    })
    resolved = await mcp.listTools()
  } catch (err) {
    console.warn('[firecrawl] MCP tools unavailable; continuing without web fetch:', err)
  }
}

export const firecrawlTools = resolved
