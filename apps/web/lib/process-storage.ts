import { Octokit } from '@octokit/rest'
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join, relative } from 'path'

export type BpmnFile = { path: string; name: string; slug: string }

/** Token do GitHub: GITHUB_TOKEN ou DEPLOY_TOKEN_QUADRRA (segredo no repositório). */
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.DEPLOY_TOKEN_QUADRRA || ''
export const GITHUB_OWNER = process.env.GITHUB_OWNER || '4isaque4'
export const GITHUB_REPO_QUADDRA = process.env.GITHUB_REPO_QUADDRA || 'vale-shope-processos'
export const GITHUB_REPO_VALESHOP = process.env.GITHUB_REPO_VALESHOP || 'vale-shope-processos'
export const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main'

export const octokit = GITHUB_TOKEN ? new Octokit({ auth: GITHUB_TOKEN }) : null

export function normalizeSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .replace(/[\s/]+/g, '-')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

export function normalizeIncomingSlug(slug: string): string {
  return normalizeSlug(decodeURIComponent(slug || '').replace(/\.bpmn$/i, ''))
}

/** Colapsa hífens consecutivos para um (ex: "a---b" -> "a-b") para matching mais flexível */
export function slugCollapseDashes(slug: string): string {
  return slug.replace(/-+/g, '-').replace(/^-|-$/g, '')
}

export function getBpmnStorageDir(): string {
  return join(process.cwd(), '..', 'api', 'storage', 'bpmn')
}

export function listLocalBpmnFiles(dir = getBpmnStorageDir(), baseDir = dir, out: BpmnFile[] = []): BpmnFile[] {
  if (!existsSync(dir)) return out

  for (const file of readdirSync(dir)) {
    const filePath = join(dir, file)
    const stat = statSync(filePath)

    if (stat.isDirectory()) {
      listLocalBpmnFiles(filePath, baseDir, out)
      continue
    }

    if (!file.toLowerCase().endsWith('.bpmn')) continue

    const relativePath = relative(baseDir, filePath).replace(/\\/g, '/')
    out.push({
      path: relativePath,
      name: file,
      slug: normalizeSlug(relativePath.replace(/\.bpmn$/i, '')),
    })
  }

  return out
}

export async function withRetry<T>(operation: () => Promise<T>, label: string, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (i === attempts) break
      console.warn(`[RETRY] ${label} falhou na tentativa ${i}/${attempts}; tentando novamente...`)
      await new Promise((resolve) => setTimeout(resolve, i * 250))
    }
  }
  throw lastError
}

export async function listGithubBpmnFiles(repo: string): Promise<BpmnFile[]> {
  if (!octokit) return []

  const { data: refData } = await withRetry(
    () => octokit!.git.getRef({ owner: GITHUB_OWNER, repo, ref: `heads/${GITHUB_BRANCH}` }),
    `getRef:${repo}`,
  )

  const { data: treeData } = await withRetry(
    () =>
      octokit!.git.getTree({
        owner: GITHUB_OWNER,
        repo,
        tree_sha: refData.object.sha,
        recursive: 'true',
      }),
    `getTree:${repo}`,
  )

  return (treeData.tree || [])
    .filter((item) => item.type === 'blob' && item.path?.toLowerCase().endsWith('.bpmn'))
    .map((item) => {
      const path = item.path!
      return {
        path,
        name: path.split('/').pop() || path,
        slug: normalizeSlug(path.replace(/\.bpmn$/i, '')),
      }
    })
}

/** Lista todos os caminhos de pasta do repositório (incluindo pastas vazias / só com .gitkeep). */
export async function listGithubFolderPaths(repo: string): Promise<string[]> {
  if (!octokit) return []

  const { data: refData } = await withRetry(
    () => octokit!.git.getRef({ owner: GITHUB_OWNER, repo, ref: `heads/${GITHUB_BRANCH}` }),
    `getRef:${repo}`,
  )

  const { data: treeData } = await withRetry(
    () =>
      octokit!.git.getTree({
        owner: GITHUB_OWNER,
        repo,
        tree_sha: refData.object.sha,
        recursive: 'true',
      }),
    `getTree:${repo}`,
  )

  const folderSet = new Set<string>()
  for (const item of treeData.tree || []) {
    const path = item.path
    if (!path) continue
    const parts = path.split('/')
    if (parts.length <= 1) continue
    for (let i = 1; i < parts.length; i++) {
      folderSet.add(parts.slice(0, i).join('/'))
    }
  }
  return Array.from(folderSet).sort()
}

export function removeEmptyParents(startPath: string, stopPath: string): void {
  let current = dirname(startPath)

  while (current.startsWith(stopPath) && current !== stopPath) {
    if (!existsSync(current)) break
    if (readdirSync(current).length > 0) break
    rmSync(current, { recursive: true, force: true })
    current = dirname(current)
  }
}

export function syncLocalDelete(relativePath: string): boolean {
  const storageDir = getBpmnStorageDir()
  const fullPath = join(storageDir, ...relativePath.split('/'))

  if (!existsSync(fullPath)) return false
  rmSync(fullPath, { force: true })
  removeEmptyParents(fullPath, storageDir)
  return true
}

export function syncLocalMove(fromPath: string, toPath: string, content?: string): void {
  const storageDir = getBpmnStorageDir()
  const fromFull = join(storageDir, ...fromPath.split('/'))
  const toFull = join(storageDir, ...toPath.split('/'))

  mkdirSync(dirname(toFull), { recursive: true })

  if (typeof content === 'string') {
    writeFileSync(toFull, content, 'utf8')
  } else if (existsSync(fromFull)) {
    const fileContent = readFileSync(fromFull)
    writeFileSync(toFull, fileContent)
  }

  if (existsSync(fromFull)) {
    rmSync(fromFull, { force: true })
    removeEmptyParents(fromFull, storageDir)
  }
}
