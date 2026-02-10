import { notFound } from 'next/navigation'
import { existsSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { Octokit } from '@octokit/rest'
import ProcessoPageClient from '../../../processos/[slug]/ProcessoPageClient'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''
const GITHUB_OWNER = process.env.GITHUB_OWNER || '4isaque4'
const GITHUB_REPO_VALESHOP = process.env.GITHUB_REPO_VALESHOP || 'vale-shope-processos'
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main'

const octokit = GITHUB_TOKEN ? new Octokit({ auth: GITHUB_TOKEN }) : null

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

async function findProcesso(slug: string, githubRepo: string = GITHUB_REPO_VALESHOP): Promise<{ atual: ProcessoInfo, outros: ProcessoInfo[] } | null> {
  const bpmnDir = join(process.cwd(), '..', 'api', 'storage', 'bpmn')

  if (!existsSync(bpmnDir)) {
    console.log('[PROCESSO PAGE] Diretório BPMN não encontrado:', bpmnDir)
    return null
  }

  const files = getAllBpmnFiles(bpmnDir, bpmnDir)
  const decodedSlug = decodeURIComponent(slug)
  const normalizedSlug = normalizeSlug(decodedSlug)
  
  console.log('[PROCESSO PAGE] Buscando processo com slug:', slug)
  console.log('[PROCESSO PAGE] Slug decodificado:', decodedSlug)
  console.log('[PROCESSO PAGE] Slug normalizado:', normalizedSlug)
  console.log('[PROCESSO PAGE] Total de arquivos encontrados:', files.length)

  // Tentar encontrar o arquivo correspondente
  const match = files.find(({ path }) => {
    const filePathWithoutExt = path.replace(/\.bpmn$/i, '')
    const fileSlug = normalizeSlug(filePathWithoutExt)
    
    // Comparação exata
    if (fileSlug === normalizedSlug) {
      console.log('[PROCESSO PAGE] ✅ Arquivo encontrado (match exato):', path)
      return true
    }
    
    // Comparação flexível (caso haja pequenas diferenças)
    const fileSlugParts = fileSlug.split('-')
    const slugParts = normalizedSlug.split('-')
    
    // Verificar se todos os segmentos do slug estão no arquivo
    if (slugParts.every(part => fileSlugParts.includes(part))) {
      console.log('[PROCESSO PAGE] ✅ Arquivo encontrado (match flexível):', path)
      return true
    }
    
    return false
  })

  if (!match) {
    console.log('[PROCESSO PAGE] ❌ Arquivo não encontrado localmente para o slug:', normalizedSlug)
    console.log('[PROCESSO PAGE] Arquivos disponíveis localmente (primeiros 10):')
    files.slice(0, 10).forEach(({ path }) => {
      const fileSlug = normalizeSlug(path.replace(/\.bpmn$/i, ''))
      console.log(`  - ${path} -> slug: ${fileSlug}`)
    })
    
    // Tentar buscar no GitHub se não encontrou localmente
    if (octokit) {
      console.log('[PROCESSO PAGE] Tentando buscar no GitHub (repo:', githubRepo, ')...')
      try {
        // Obter árvore completa do GitHub
        const { data: refData } = await octokit.git.getRef({
          owner: GITHUB_OWNER,
          repo: githubRepo,
          ref: `heads/${GITHUB_BRANCH}`
        })

        const latestCommitSha = refData.object.sha
        const { data: currentTree } = await octokit.git.getTree({
          owner: GITHUB_OWNER,
          repo: githubRepo,
          tree_sha: latestCommitSha,
          recursive: 'true'
        })

        // Buscar arquivo BPMN que corresponde ao slug
        const githubFile = currentTree.tree.find((item) => {
          if (item.type === 'blob' && item.path?.toLowerCase().endsWith('.bpmn')) {
            const filePathWithoutExt = item.path.replace(/\.bpmn$/i, '')
            const fileSlug = normalizeSlug(filePathWithoutExt)
            return fileSlug === normalizedSlug
          }
          return false
        })

        if (githubFile && githubFile.path) {
          console.log('[PROCESSO PAGE] ✅ Arquivo encontrado no GitHub:', githubFile.path)
          // Criar match a partir do arquivo do GitHub
          const pathParts = githubFile.path.split('/')
          const fileName = pathParts[pathParts.length - 1]
          
          const githubMatch = {
            path: githubFile.path,
            name: fileName
          }
          
          const caminhoPasta = githubMatch.path.includes('/') ? githubMatch.path.split('/')[0] : null
          const outros: ProcessoInfo[] = [] // Não buscar outros do GitHub por enquanto
          
          return {
            atual: toProcessoInfo(githubMatch, slug),
            outros
          }
        }
      } catch (error: any) {
        console.warn('[PROCESSO PAGE] Erro ao buscar no GitHub:', error.message)
      }
    }
    
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

export default async function ValeShopProcessoPage({ params }: { params: Promise<{ slug: string }> | { slug: string } }) {
  // Suportar tanto Next.js 14 (params direto) quanto Next.js 15+ (params como Promise)
  const resolvedParams = params instanceof Promise ? await params : params
  const slug = resolvedParams.slug
  
  console.log('[PROCESSO PAGE] Parâmetros recebidos (ValeShop):', resolvedParams)
  console.log('[PROCESSO PAGE] Slug:', slug)
  console.log('[PROCESSO PAGE] Repositório GitHub:', GITHUB_REPO_VALESHOP)
  
  const resultado = await findProcesso(slug, GITHUB_REPO_VALESHOP)

  if (!resultado) {
    console.log('[PROCESSO PAGE] ❌ Processo não encontrado, retornando 404')
    notFound()
  }

  const { atual: processo, outros } = resultado
  console.log('[PROCESSO PAGE] ✅ Processo encontrado:', processo.nome)

  return <ProcessoPageClient processo={processo} outros={outros} />
}
