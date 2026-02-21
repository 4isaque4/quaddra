import ProcessosPageClient from './ProcessosPageClient'
import {
  GITHUB_REPO_QUADDRA,
  listGithubBpmnFiles,
  listLocalBpmnFiles,
  octokit,
  syncLocalDelete,
} from '@/lib/process-storage'

interface ProcessoItem {
  file: string
  slug: string
  nome: string
  categoria: string
  folderPath?: string
}

function toProcessoItem(path: string, slug: string, name: string): ProcessoItem {
  const pathParts = path.split('/')

  return {
    file: path,
    slug,
    nome: name.replace(/\.bpmn$/i, ''),
    categoria: pathParts.length > 1 ? pathParts[0] : 'Raiz',
    folderPath: pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : undefined,
  }
}

async function getProcessos(): Promise<ProcessoItem[]> {
  if (!octokit) {
    console.warn('[PROCESSOS] GITHUB_TOKEN não configurado')
    return listLocalBpmnFiles()
      .map((file) => toProcessoItem(file.path, file.slug, file.name))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }

  try {
    const files = await listGithubBpmnFiles(GITHUB_REPO_QUADDRA)

    const seen = new Set<string>()
    const deduped = files.filter((file) => {
      if (seen.has(file.slug)) {
        console.warn(`[PROCESSOS] slug duplicado detectado no GitHub: ${file.slug} (${file.path})`)
        return false
      }
      seen.add(file.slug)
      return true
    })

    const processos = deduped
      .map((file) => toProcessoItem(file.path, file.slug, file.name))
      .sort((a, b) => a.nome.localeCompare(b.nome))

    const slugSet = new Set(processos.map((item) => item.slug))
    for (const localFile of listLocalBpmnFiles()) {
      if (!slugSet.has(localFile.slug)) {
        syncLocalDelete(localFile.path)
      }
    }

    return processos
  } catch (error: any) {
    console.error('[PROCESSOS] erro ao buscar processos:', error?.message || error)
    return listLocalBpmnFiles()
      .map((file) => toProcessoItem(file.path, file.slug, file.name))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ProcessosPage() {
  const processos = await getProcessos()
  return <ProcessosPageClient processosIniciais={processos} />
}
