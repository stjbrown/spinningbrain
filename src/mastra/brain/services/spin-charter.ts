import { spinRootCharter } from '../spin-charter'
import { createRootStore, ensureInbox } from './inbox'

function brainSection(brainId: string, charter: string): string {
  return [
    `<!-- SPIN:BRAIN:${brainId}:START -->`,
    `## Brain: ${brainId}`,
    '',
    `Use \`brains/${brainId}/knowledge/\` for canonical knowledge. Cite shared evidence from \`inbox/\`.`,
    '',
    charter.trim(),
    `<!-- SPIN:BRAIN:${brainId}:END -->`,
  ].join('\n')
}

export async function readSpinCharter(bucket: string, region: string): Promise<string> {
  const store = createRootStore(bucket, region)
  await ensureInbox(bucket, region)
  if (!(await store.exists('AGENTS.md'))) {
    await store.writeFile('AGENTS.md', `${spinRootCharter.trim()}\n`, {
      recursive: true,
      overwrite: false,
    })
  }
  const content = await store.readFile('AGENTS.md', { encoding: 'utf-8' })
  const current = content.toString()
  const reconciled = reconcileSpinCharter(current)
  if (reconciled !== current) {
    await store.writeFile('AGENTS.md', reconciled, { recursive: true, overwrite: true })
  }
  return reconciled
}

export function reconcileSpinCharter(current: string): string {
  const firstBrainSection = current.indexOf('<!-- SPIN:BRAIN:')
  const managedSections =
    firstBrainSection >= 0
      ? current
          .slice(firstBrainSection)
          .trim()
          .replace(
            /Use `(?:brains\/)?([^`/]+)\/knowledge\/` for canonical knowledge and `(?:brains\/)?\1\/sources\/` for evidence\./g,
            (_, brainId: string) =>
              `Use \`brains/${brainId}/knowledge/\` for canonical knowledge. Cite shared evidence from \`inbox/\`.`,
          )
          .replace(
            /Use `(?:brains\/)?([^`/]+)\/knowledge\/` for canonical knowledge\. Cite shared evidence from `inbox\/`\./g,
            (_, brainId: string) =>
              `Use \`brains/${brainId}/knowledge/\` for canonical knowledge. Cite shared evidence from \`inbox/\`.`,
          )
      : ''
  return `${spinRootCharter.trim()}${managedSections ? `\n\n${managedSections}` : ''}\n`
}

export async function upsertSpinBrainSection(
  bucket: string,
  region: string,
  brainId: string,
  charter: string,
): Promise<void> {
  const store = createRootStore(bucket, region)
  const current = await readSpinCharter(bucket, region)
  const start = `<!-- SPIN:BRAIN:${brainId}:START -->`
  const end = `<!-- SPIN:BRAIN:${brainId}:END -->`
  const section = brainSection(brainId, charter)
  const startIndex = current.indexOf(start)
  const endIndex = current.indexOf(end)
  const next =
    startIndex >= 0 && endIndex >= startIndex
      ? `${current.slice(0, startIndex)}${section}${current.slice(endIndex + end.length)}`
      : `${current.trimEnd()}\n\n${section}\n`

  await store.writeFile('AGENTS.md', next, { recursive: true, overwrite: true })
}
