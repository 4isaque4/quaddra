import { redirect } from 'next/navigation'
import ProcessoPageClient from './ProcessoPageClient'
import {
  GITHUB_REPO_QUADDRA,
  listGithubBpmnFiles,
  listLocalBpmnFiles,
  normalizeIncomingSlug,
} from '@/lib/process-storage'

function compactSlug(value: string): string {
  return normalizeIncomingSlug(value).replace(/[^a-z0-9]/g, '')
}

function isSlugMatch(candidate: string, requested: string): boolean {
  const normalizedCandidate = normalizeIncomingSlug(candidate)
  const normalizedRequested = normalizeIncomingSlug(requested)

  if (normalizedCandidate === normalizedRequested) return true
  const compactCandidate = compactSlug(normalizedCandidate)
  const compactRequested = compactSlug(normalizedRequested)

  if (compactCandidate === compactRequested) return true

  return compactCandidate.endsWith(compactRequested) || compactRequested.endsWith(compactCandidate)
}

type ProcessoInfo = {
  slug: string
  nome: string
  file: string
  arquivo: string
  categoria: string
  bpmnUrl: string
  descriptionsUrl: string
  contentUrl: string
}

function toProcessoInfo(path: string): ProcessoInfo {
  const fileName = path.split('/').pop() || path
  const pathParts = path.split('/')
  const canonicalSlug = normalizeIncomingSlug(path.replace(/\.bpmn$/i, ''))

  return {
    slug: canonicalSlug,
    nome: fileName.replace(/\.bpmn$/i, ''),
    file: path,
    arquivo: path,
    categoria: pathParts.length > 1 ? pathParts[0] : 'Raiz',
    bpmnUrl: `/api/bpmn/${encodeURIComponent(canonicalSlug)}`,
    descriptionsUrl: '/api/descriptions',
    contentUrl: `/api/content/${encodeURIComponent(canonicalSlug)}`,
  }
}

function toFallbackProcessoInfo(slug: string): ProcessoInfo {
  const normalizedSlug = normalizeIncomingSlug(slug)
  const parts = normalizedSlug.split('-').filter(Boolean)
  const categoria = parts[0] ? `${parts[0].charAt(0).toUpperCase()}${parts[0].slice(1)}` : 'Raiz'
  const nome = parts.length > 1
    ? parts.slice(1).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ')
    : normalizedSlug

  return {
    slug: normalizedSlug,
    nome,
    file: `${categoria}/${nome}.bpmn`,
    arquivo: `${categoria}/${nome}.bpmn`,
    categoria,
    bpmnUrl: `/api/bpmn/${encodeURIComponent(normalizedSlug)}`,
    descriptionsUrl: '/api/descriptions',
    contentUrl: `/api/content/${encodeURIComponent(normalizedSlug)}`,
  }
}

async function findProcesso(slug: string): Promise<{ atual: ProcessoInfo; outros: ProcessoInfo[] } | null> {
  const normalizedSlug = normalizeIncomingSlug(slug)

  try {
    const githubFiles = await listGithubBpmnFiles(GITHUB_REPO_QUADDRA)
    const githubMatch = githubFiles.find((file) => isSlugMatch(file.slug, normalizedSlug))
    if (githubMatch) {
      const prefix = githubMatch.path.includes('/') ? `${githubMatch.path.split('/')[0]}/` : ''
      const outros = githubFiles
        .filter((item) => item.path !== githubMatch.path)
        .filter((item) => (prefix ? item.path.startsWith(prefix) : false))
        .map((item) => toProcessoInfo(item.path))

      return { atual: toProcessoInfo(githubMatch.path), outros }
    }
  } catch (error) {
    console.warn('[Processos] Falha ao consultar processos no GitHub. Aplicando fallback local.', error)
  }

  const localFiles = listLocalBpmnFiles()
  const localMatch = localFiles.find((file) => isSlugMatch(file.slug, normalizedSlug))
  if (!localMatch) return null

  const prefix = localMatch.path.includes('/') ? `${localMatch.path.split('/')[0]}/` : ''
  const outros = localFiles
    .filter((item) => item.path !== localMatch.path)
    .filter((item) => (prefix ? item.path.startsWith(prefix) : false))
    .map((item) => toProcessoInfo(item.path))

  return { atual: toProcessoInfo(localMatch.path), outros }
}

export default async function ProcessoPage({ params }: { params: Promise<{ slug: string }> | { slug: string } }) {
  const resolvedParams = params instanceof Promise ? await params : params

  let resultado: { atual: ProcessoInfo; outros: ProcessoInfo[] } | null = null
  try {
    resultado = await findProcesso(resolvedParams.slug)
  } catch (error) {
    console.error('[Processos] Erro ao carregar processo:', resolvedParams.slug, error)
    redirect('/processos?erro=processo-indisponivel')
  }

  if (!resultado) {
    console.warn('[Processos] Processo não localizado no índice. Tentando carregamento direto por slug:', resolvedParams.slug)
    resultado = {
      atual: toFallbackProcessoInfo(resolvedParams.slug),
      outros: [],
    }
  }

  return <ProcessoPageClient processo={resultado.atual} outros={resultado.outros} />
}
