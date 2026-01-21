import { existsSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { notFound } from 'next/navigation'
import ProcessoPageClient from './ProcessoPageClient'

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

function normalizeSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .replace(/\s+/g, '-')
    .replace(/\//g, '-')
    .toLowerCase()
}

function getAllBpmnFiles(dir: string, baseDir: string, fileList: Array<{ path: string, name: string }> = []): Array<{ path: string, name: string }> {
  const files = readdirSync(dir)
  
  files.forEach(file => {
    const filePath = join(dir, file)
    const stat = statSync(filePath)
    
    if (stat.isDirectory()) {
      getAllBpmnFiles(filePath, baseDir, fileList)
    } else if (file.toLowerCase().endsWith('.bpmn')) {
      const relativePath = relative(baseDir, filePath).replace(/\\/g, '/')
      fileList.push({
        path: relativePath,
        name: file
      })
    }
  })
  
  return fileList
}

function toProcessoInfo(match: { path: string, name: string }, slug: string): ProcessoInfo {
  const pathParts = match.path.split('/')
  const categoria = pathParts.length > 1 ? pathParts[0] : 'Raiz'

  return {
    slug: normalizeSlug(match.path.replace(/\.bpmn$/i, '')),
    nome: match.name.replace(/\.bpmn$/i, ''),
    file: match.path,
    arquivo: match.path,
    categoria,
    bpmnUrl: `/api/bpmn/${encodeURIComponent(slug)}`,
    descriptionsUrl: '/api/descriptions',
    contentUrl: `/api/content/${encodeURIComponent(slug)}`
  }
}

function findProcesso(slug: string): { atual: ProcessoInfo, outros: ProcessoInfo[] } | null {
  const bpmnDir = join(process.cwd(), '..', 'api', 'storage', 'bpmn')

  if (!existsSync(bpmnDir)) {
    return null
  }

  const files = getAllBpmnFiles(bpmnDir, bpmnDir)

  const match = files.find(({ path }) => {
    const fileSlug = normalizeSlug(path.replace(/\.bpmn$/i, ''))
    return fileSlug === normalizeSlug(decodeURIComponent(slug))
  })

  if (!match) {
    return null
  }

  const caminhoPasta = match.path.includes('/') ? match.path.split('/')[0] : null
  const outros = files
    .filter(({ path }) => path !== match.path)
    .filter(({ path }) => caminhoPasta ? path.startsWith(`${caminhoPasta}/`) : false)
    .map((f) => toProcessoInfo(f, f.path.replace(/\.bpmn$/i, '')))

  return {
    atual: toProcessoInfo(match, slug),
    outros
  }
}

export default function ProcessoPage({ params }: { params: { slug: string } }) {
  const resultado = findProcesso(params.slug)

  if (!resultado) {
    notFound()
  }

  const { atual: processo, outros } = resultado

  return <ProcessoPageClient processo={processo} outros={outros} />
}
