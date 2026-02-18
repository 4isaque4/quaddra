import { notFound } from 'next/navigation'
import ValeShopProcessoPageClient from './ValeShopProcessoPageClient'
import {
  GITHUB_REPO_VALESHOP,
  listGithubBpmnFiles,
  listLocalBpmnFiles,
  normalizeIncomingSlug,
} from '@/lib/process-storage'

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

function isSlugMatch(candidate: string, requested: string): boolean {
  if (candidate === requested) return true
  const compactCandidate = candidate.replace(/-/g, '')
  const compactRequested = requested.replace(/-/g, '')
  return compactCandidate === compactRequested
}

async function findProcesso(slug: string): Promise<{ atual: ProcessoInfo; outros: ProcessoInfo[] } | null> {
  const normalizedSlug = normalizeIncomingSlug(slug)
  const githubFiles = await listGithubBpmnFiles(GITHUB_REPO_VALESHOP)
  const githubMatch = githubFiles.find((file) => isSlugMatch(file.slug, normalizedSlug))

  if (githubMatch) {
    const prefix = githubMatch.path.includes('/') ? `${githubMatch.path.split('/')[0]}/` : ''
    const outros = githubFiles
      .filter((item) => item.path !== githubMatch.path)
      .filter((item) => (prefix ? item.path.startsWith(prefix) : false))
      .map((item) => toProcessoInfo(item.path))

    return { atual: toProcessoInfo(githubMatch.path), outros }
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

export default async function ValeShopProcessoPage({ params }: { params: Promise<{ slug: string }> | { slug: string } }) {
  const resolvedParams = params instanceof Promise ? await params : params
  const resultado = await findProcesso(resolvedParams.slug)
  if (!resultado) notFound()

  return <ValeShopProcessoPageClient processo={resultado.atual} outros={resultado.outros} />
}
