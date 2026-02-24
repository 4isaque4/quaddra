import {
  GITHUB_REPO_QUADDRA,
  GITHUB_REPO_VALESHOP,
  listGithubBpmnFiles,
  listLocalBpmnFiles,
  octokit,
  syncLocalDelete,
} from '@/lib/process-storage'

export interface ProcessoItem {
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

export async function getProcessosByClientType(clientType: 'quaddra' | 'valeshop'): Promise<ProcessoItem[]> {
  const isValeShop = clientType === 'valeshop'
  const repo = isValeShop ? GITHUB_REPO_VALESHOP : GITHUB_REPO_QUADDRA
  const prefix = isValeShop ? '[VALESHOP]' : '[PROCESSOS]'

  if (!octokit) {
    console.warn(`${prefix} GITHUB_TOKEN não configurado`)
    return listLocalBpmnFiles()
      .map((file) => toProcessoItem(file.path, file.slug, file.name))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }

  try {
    const files = await listGithubBpmnFiles(repo)

    const seen = new Set<string>()
    const deduped = files.filter((file) => {
      if (seen.has(file.slug)) {
        console.warn(`${prefix} slug duplicado detectado no GitHub: ${file.slug} (${file.path})`)
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
    console.error(`${prefix} erro ao buscar processos:`, error?.message || error)
    return listLocalBpmnFiles()
      .map((file) => toProcessoItem(file.path, file.slug, file.name))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }
}
