import { NextResponse } from 'next/server'
import { existsSync, readFileSync } from 'fs'
import { basename, join } from 'path'
import {
  GITHUB_BRANCH,
  GITHUB_OWNER,
  GITHUB_REPO_QUADDRA,
  GITHUB_REPO_VALESHOP,
  listGithubBpmnFiles,
  listLocalBpmnFiles,
  normalizeIncomingSlug,
  octokit,
  slugCollapseDashes,
  withRetry,
} from '@/lib/process-storage'

type SlugFile = { slug: string; path: string; name: string }

function compactSlug(value: string): string {
  return slugCollapseDashes(value).replace(/[^a-z0-9]/g, '')
}

/** Match exato, colapsado ou compacto. Sem endsWith para evitar falsos positivos. */
function matchesSlugStrict(candidate: string, requested: string): boolean {
  const nc = normalizeIncomingSlug(candidate)
  const nr = normalizeIncomingSlug(requested)
  if (nc === nr) return true
  if (slugCollapseDashes(nc) === slugCollapseDashes(nr)) return true
  if (compactSlug(nc) === compactSlug(nr)) return true
  return false
}

/** Match flexível (inclui endsWith para path completo). */
function matchesSlug(candidate: string, requested: string): boolean {
  if (matchesSlugStrict(candidate, requested)) return true
  const cc = compactSlug(normalizeIncomingSlug(candidate))
  const cr = compactSlug(normalizeIncomingSlug(requested))
  const minLen = Math.min(cc.length, cr.length)
  return minLen >= 10 && (cc.endsWith(cr) || cr.endsWith(cc))
}

function findMatchBySlug<T extends SlugFile>(files: T[], normalizedSlug: string): T | undefined {
  const direct = files.find((item) => matchesSlug(item.slug, normalizedSlug))
  if (direct) return direct

  return files.find((item) => {
    const normalizedPathSlug = normalizeIncomingSlug(item.path.replace(/\.bpmn$/i, ''))
    if (matchesSlug(normalizedPathSlug, normalizedSlug)) return true

    const fileBaseSlug = normalizeIncomingSlug(basename(item.path).replace(/\.bpmn$/i, ''))
    return matchesSlugStrict(fileBaseSlug, normalizedSlug)
  })
}

function bpmnResponse(content: string, filename: string): NextResponse {
  return new NextResponse(content, {
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}

/** Variações com acento comuns em português (slug -> nomes possíveis) */
const ACCENT_VARIANTS: Record<string, string[]> = {
  renovavel: ['Renovável', 'Renovavel'],
  acumulativo: ['Acumulativo'],
  geral: ['Geral'],
}

/** Gera candidatos de path a partir do slug para tentativa no GitHub */
function slugToPathCandidates(slug: string): string[] {
  const parts = slug.split('-').filter(Boolean)
  if (parts.length === 0) return []
  const categoria = parts[0] ? `${parts[0].charAt(0).toUpperCase()}${parts[0].slice(1)}` : ''
  const nomePartes = parts.length > 1 ? parts.slice(1) : parts
  const nomeBase = nomePartes.map((p) => `${p.charAt(0).toUpperCase()}${p.slice(1)}`).join(' ')
  const nomeSoPrimeira = nomePartes.length ? `${nomePartes[0].charAt(0).toUpperCase()}${nomePartes[0].slice(1)}` : ''
  const candidates: string[] = []

  const nomeVariantes = [nomeBase]
  const ultimaParte = nomePartes[nomePartes.length - 1]?.toLowerCase() ?? ''
  if (ACCENT_VARIANTS[ultimaParte]) {
    for (const v of ACCENT_VARIANTS[ultimaParte]) {
      const resto = nomePartes.slice(0, -1).map((p) => `${p.charAt(0).toUpperCase()}${p.slice(1)}`).join(' ')
      nomeVariantes.push(resto ? `${resto} ${v}` : v)
    }
  }

  for (const nome of nomeVariantes) {
    if (categoria && nome) {
      candidates.push(`${categoria}/${nome}.bpmn`)
    }
    candidates.push(`${nome}.bpmn`)
  }
  if (categoria && nomeSoPrimeira) candidates.push(`${categoria}/${nomeSoPrimeira}.bpmn`)
  if (categoria && nomeBase) candidates.push(`${categoria} ${nomeBase}.bpmn`)

  return [...new Set(candidates)]
}

async function fetchGithubFile(repo: string, path: string, useRetry = false): Promise<NextResponse | null> {
  try {
    const getData = () =>
      octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo,
        path,
        ref: GITHUB_BRANCH,
      })
    const { data } = useRetry ? await withRetry(getData, `getContent:${repo}:${path}`) : await getData()
    if ('content' in data && data.type === 'file') {
      const content = Buffer.from(data.content, 'base64').toString('utf8')
      return bpmnResponse(content, path.split('/').pop() || path)
    }
  } catch {
    // arquivo não existe ou erro de rede
  }
  return null
}

/** Lista conteúdo de uma pasta no GitHub e retorna paths de arquivos .bpmn (recursivo) */
async function listGithubFolder(repo: string, folder: string): Promise<string[]> {
  try {
    const pathParam = folder === '' ? '.' : folder
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo,
      path: pathParam,
      ref: GITHUB_BRANCH,
    })
    if (!Array.isArray(data)) return []
    const paths: string[] = []
    for (const item of data) {
      if (item.type === 'file' && item.name?.toLowerCase().endsWith('.bpmn')) {
        paths.push(folder ? `${folder}/${item.name}` : item.name)
      }
      if (item.type === 'dir' && item.name) {
        const sub = await listGithubFolder(repo, folder ? `${folder}/${item.name}` : item.name)
        paths.push(...sub)
      }
    }
    return paths
  } catch {
    return []
  }
}

async function getGithubBpmnBySlug(normalizedSlug: string): Promise<NextResponse | null> {
  if (!octokit) return null

  const repos = [GITHUB_REPO_VALESHOP, GITHUB_REPO_QUADDRA]

  for (const repo of repos) {
    const files = await listGithubBpmnFiles(repo)
    const match = findMatchBySlug(files, normalizedSlug)
    if (match) {
      const res = await fetchGithubFile(repo, match.path, true)
      if (res) return res
    }
  }

  const candidates = slugToPathCandidates(normalizedSlug)
  for (const repo of repos) {
    for (const path of candidates) {
      const res = await fetchGithubFile(repo, path, false)
      if (res) return res
    }
  }

  const slugCompact = compactSlug(normalizedSlug)
  const folderVariants = (firstPart: string) => [
    `${firstPart.charAt(0).toUpperCase()}${firstPart.slice(1)}`,
    firstPart,
    firstPart.toLowerCase(),
  ]
  const firstPart = normalizedSlug.split('-')[0] ?? ''
  const folders = firstPart ? folderVariants(firstPart) : ['']

  for (const repo of repos) {
    for (const folder of folders) {
      const paths = await listGithubFolder(repo, folder)
      for (const path of paths) {
        const pathSlug = normalizeIncomingSlug(path.replace(/\.bpmn$/i, ''))
        const baseSlug = normalizeIncomingSlug(basename(path).replace(/\.bpmn$/i, ''))
        const match =
          matchesSlugStrict(pathSlug, normalizedSlug) ||
          compactSlug(pathSlug) === slugCompact ||
          matchesSlugStrict(baseSlug, normalizedSlug)
        if (match) {
          const res = await fetchGithubFile(repo, path, false)
          if (res) return res
        }
      }
    }
  }

  return null
}

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  try {
    const normalizedSlug = normalizeIncomingSlug(params.slug)
    const url = new URL(request.url)
    const debug = url.searchParams.get('debug') === '1'

    const githubResponse = await getGithubBpmnBySlug(normalizedSlug)
    if (githubResponse) return githubResponse

    const localMatch = findMatchBySlug(listLocalBpmnFiles(), normalizedSlug)
    if (localMatch) {
      const fullPath = join(process.cwd(), '..', 'api', 'storage', 'bpmn', ...localMatch.path.split('/'))
      if (existsSync(fullPath)) {
        return bpmnResponse(readFileSync(fullPath, 'utf8'), localMatch.name)
      }
    }

    if (debug && octokit) {
      const repos = [GITHUB_REPO_VALESHOP, GITHUB_REPO_QUADDRA]
      const debugInfo: { repo: string; files: { path: string; slug: string }[]; folderContents: string[] }[] = []
      for (const repo of repos) {
        const files = await listGithubBpmnFiles(repo)
        const folderPaths = await listGithubFolder(repo, 'Financeiro')
        const financeiroLower = await listGithubFolder(repo, 'financeiro')
        debugInfo.push({
          repo,
          files: files.slice(0, 50).map((f) => ({ path: f.path, slug: f.slug })),
          folderContents: [...folderPaths, ...financeiroLower],
        })
      }
      return NextResponse.json({
        error: `Arquivo BPMN não encontrado para slug: ${normalizedSlug}`,
        debug: debugInfo,
        candidates: slugToPathCandidates(normalizedSlug),
      }, { status: 404 })
    }

    return NextResponse.json({ error: `Arquivo BPMN não encontrado para slug: ${normalizedSlug}` }, { status: 404 })
  } catch (error: any) {
    console.error('[BPMN API] erro ao buscar arquivo:', error?.message || error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
