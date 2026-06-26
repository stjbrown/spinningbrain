import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const defaultGitTimeoutMs = 20_000

export interface RemoteGitSnapshot {
  directory: string
  commit: string
  files: string[]
  cleanup: () => Promise<void>
}

function gitEnvironment(repository: string): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
  }

  const token = process.env.SB_GIT_TOKEN ?? process.env.GITHUB_TOKEN
  if (token) {
    environment.GIT_CONFIG_COUNT = '1'
    environment.GIT_CONFIG_KEY_0 = 'http.extraHeader'
    environment.GIT_CONFIG_VALUE_0 = `Authorization: Bearer ${token}`
  } else if (new URL(repository).hostname === 'github.com') {
    // Useful for local development when GitHub CLI is already authenticated.
    // Hosted deployments should provide SB_GIT_TOKEN explicitly.
    environment.GIT_CONFIG_COUNT = '1'
    environment.GIT_CONFIG_KEY_0 = 'credential.helper'
    environment.GIT_CONFIG_VALUE_0 = '!gh auth git-credential'
  }

  return environment
}

function gitTimeoutMs(): number {
  const configured = Number(process.env.SB_GIT_TIMEOUT_MS)
  return Number.isFinite(configured) && configured > 0 ? configured : defaultGitTimeoutMs
}

export function describeGitSourceError(error: unknown, operation: string): Error {
  const details =
    error instanceof Error
      ? `${error.message} ${'stderr' in error && typeof error.stderr === 'string' ? error.stderr : ''}`
      : String(error)
  const normalized = details.toLowerCase()

  if (normalized.includes('timed out') || normalized.includes('etimedout')) {
    return new Error(
      `Remote Git ${operation} timed out after ${gitTimeoutMs() / 1000} seconds. Check network access to the repository and retry.`,
    )
  }
  if (
    normalized.includes("couldn't connect") ||
    normalized.includes('could not resolve host') ||
    normalized.includes('failed to connect')
  ) {
    return new Error(
      `Remote Git ${operation} could not reach the repository. Check GitHub/network access and retry.`,
    )
  }

  return new Error(`Remote Git ${operation} failed: ${error instanceof Error ? error.message : error}`)
}

async function runGit(
  args: string[],
  environment: NodeJS.ProcessEnv,
  operation: string,
  maxBuffer = 10 * 1024 * 1024,
): Promise<{ stdout: string | Buffer }> {
  try {
    return await execFileAsync('git', args, {
      env: environment,
      maxBuffer,
      timeout: gitTimeoutMs(),
    })
  } catch (error) {
    throw describeGitSourceError(error, operation)
  }
}

export async function fetchRemoteBranchSnapshot(
  repository: string,
  branch: string,
  expectedCommit?: string,
): Promise<RemoteGitSnapshot> {
  const directory = await mkdtemp(join(tmpdir(), 'spinningbrain-git-'))
  const cleanup = () => rm(directory, { recursive: true, force: true })

  try {
    const environment = gitEnvironment(repository)
    let commit = expectedCommit
    if (!commit) {
      const { stdout } = await runGit(
        ['ls-remote', '--exit-code', repository, `refs/heads/${branch}`],
        environment,
        `branch resolution for ${branch}`,
        1024 * 1024,
      )
      commit = stdout.toString().trim().split(/\s+/)[0]
    }

    if (!commit || !/^[a-f0-9]{40}$/.test(commit)) {
      throw new Error(`Could not resolve remote branch ${branch}`)
    }

    await runGit(['init', '--quiet', directory], environment, 'temporary repository setup')
    await runGit(
      ['-C', directory, 'remote', 'add', 'origin', repository],
      environment,
      'remote setup',
    )
    await runGit(
      ['-C', directory, 'fetch', '--quiet', '--depth=1', 'origin', commit],
      environment,
      'snapshot fetch',
    )
    await runGit(
      ['-C', directory, 'checkout', '--quiet', '--detach', 'FETCH_HEAD'],
      environment,
      'snapshot checkout',
    )

    const { stdout: treeOutput } = await runGit(
      ['-C', directory, 'ls-tree', '-r', '-z', '--full-tree', '--name-only', 'HEAD'],
      environment,
      'snapshot inventory',
      100 * 1024 * 1024,
    )
    const files = treeOutput
      .toString()
      .split('\0')
      .filter(Boolean)

    return { directory, commit, files, cleanup }
  } catch (error) {
    await cleanup()
    throw error
  }
}

export async function readSnapshotFile(snapshotDirectory: string, path: string): Promise<Buffer> {
  return readFile(join(snapshotDirectory, ...path.split('/')))
}

export function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}
