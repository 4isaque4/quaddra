import ProcessosPageClient from './ProcessosPageClient'
import { readdirSync, existsSync, statSync } from 'fs'
import { join, relative } from 'path'
import { Octokit } from '@octokit/rest'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''
const GITHUB_OWNER = process.env.GITHUB_OWNER || '4isaque4'
const GITHUB_REPO = process.env.GITHUB_REPO_PROCESSOS || 'quaddra-processos'
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

interface ProcessoItem {
  file: string
  slug: string
  nome: string
  categoria: string
  folderPath?: string
}

async function getProcessosFromGitHub(): Promise<ProcessoItem[]> {
  if (!octokit) {
    console.warn('[PROCESSOS] GITHUB_TOKEN não configurado')
    return []
  }

  try {
    console.log(`[PROCESSOS] Buscando processos do GitHub: ${GITHUB_OWNER}/${GITHUB_REPO} (branch: ${GITHUB_BRANCH})`)
    
    // Usar API de conteúdo para listar pastas primeiro (mais confiável)
    const { data: contents } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: '',
      ref: GITHUB_BRANCH
    })

    if (!Array.isArray(contents)) {
      console.error('[PROCESSOS] Conteúdo do repositório não é um array')
      return []
    }

    console.log(`[PROCESSOS] Encontradas ${contents.length} pastas/arquivos na raiz`)

    const processos: ProcessoItem[] = []

    // Processar cada pasta
    for (const item of contents) {
      if (item.type === 'dir' && !item.name.startsWith('.')) {
        try {
          // Listar conteúdo da pasta
          const { data: folderContents } = await octokit.repos.getContent({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            path: item.name,
            ref: GITHUB_BRANCH
          })

          if (!Array.isArray(folderContents)) continue

          // Buscar arquivos BPMN recursivamente
          const buscarBpmnRecursivo = async (path: string, folderPath: string = ''): Promise<void> => {
            const { data: folderItems } = await octokit.repos.getContent({
              owner: GITHUB_OWNER,
              repo: GITHUB_REPO,
              path,
              ref: GITHUB_BRANCH
            })

            if (!Array.isArray(folderItems)) return

            for (const fileItem of folderItems) {
              if (fileItem.type === 'file' && fileItem.name.toLowerCase().endsWith('.bpmn')) {
                const fullPath = folderPath ? `${folderPath}/${fileItem.name}` : fileItem.name
                const pathParts = fullPath.split('/')
                const fileName = pathParts[pathParts.length - 1]
                
                const slug = normalizeSlug(fullPath.replace(/\.bpmn$/i, ''))
                
                let categoria = 'Raiz'
                let folderPathFinal: string | undefined = undefined
                if (pathParts.length > 1) {
                  categoria = pathParts[0]
                  folderPathFinal = pathParts.slice(0, -1).join('/')
                }
                
                processos.push({
                  file: fullPath,
                  slug,
                  nome: fileName.replace(/\.bpmn$/i, ''),
                  categoria,
                  folderPath: folderPathFinal
                })
              } else if (fileItem.type === 'dir') {
                // Buscar recursivamente em subpastas
                const subPath = folderPath ? `${folderPath}/${fileItem.name}` : fileItem.name
                await buscarBpmnRecursivo(`${path}/${fileItem.name}`, subPath)
              }
            }
          }

          await buscarBpmnRecursivo(item.name, item.name)
        } catch (error: any) {
          console.warn(`[PROCESSOS] Erro ao processar pasta ${item.name}:`, error.message)
        }
      } else if (item.type === 'file' && item.name.toLowerCase().endsWith('.bpmn')) {
        // Arquivo BPMN na raiz
        const slug = normalizeSlug(item.name.replace(/\.bpmn$/i, ''))
        processos.push({
          file: item.name,
          slug,
          nome: item.name.replace(/\.bpmn$/i, ''),
          categoria: 'Raiz',
          folderPath: undefined
        })
      }
    }

    const processosOrdenados = processos.sort((a, b) => a.nome.localeCompare(b.nome))
    console.log(`[PROCESSOS] Total de processos encontrados: ${processosOrdenados.length}`)
    return processosOrdenados
  } catch (error: any) {
    console.error('[PROCESSOS] Erro ao buscar processos do GitHub:', error)
    console.error('[PROCESSOS] Detalhes do erro:', {
      message: error.message,
      status: error.status,
      response: error.response?.data
    })
    
    if (error.status === 404) {
      console.error(`[PROCESSOS] Repositório não encontrado: ${GITHUB_OWNER}/${GITHUB_REPO}`)
    }
    
    if (error.status === 401) {
      console.error('[PROCESSOS] Erro de autenticação - verifique o GITHUB_TOKEN')
    }
    
    return []
  }
}

function getProcessosFromLocal(): ProcessoItem[] {
  try {
    const bpmnDir = join(process.cwd(), '..', 'api', 'storage', 'bpmn')
    
    if (!existsSync(bpmnDir)) {
      return []
    }
    
    const files = getAllBpmnFiles(bpmnDir, bpmnDir)
    
    return files.map(({ path, name }) => {
      const slug = normalizeSlug(path.replace(/\.bpmn$/i, ''))
      const pathParts = path.split('/')
      
      // Determinar categoria (pasta ou "Raiz")
      let categoria = 'Raiz'
      let folderPath: string | undefined = undefined
      if (pathParts.length > 1) {
        categoria = pathParts[0] // Nome da pasta (primeiro nível)
        folderPath = pathParts.slice(0, -1).join('/') // Caminho completo da pasta
      }
      
      return {
        file: path,
        slug,
        nome: name.replace(/\.bpmn$/i, ''),
        categoria,
        folderPath
      }
    }).sort((a, b) => a.nome.localeCompare(b.nome))
  } catch (error) {
    console.error('[PROCESSOS] Erro ao buscar processos locais:', error)
    return []
  }
}

async function getProcessos(): Promise<ProcessoItem[]> {
  // Buscar do GitHub primeiro (fonte de verdade)
  const processosGitHub = await getProcessosFromGitHub()
  
  // Usar apenas processos do GitHub (não usar fallback local)
  // Se não houver token ou erro, retornar vazio
  if (processosGitHub.length > 0) {
    console.log(`[PROCESSOS] Encontrados ${processosGitHub.length} processos no GitHub`)
    
    // Limpar arquivos locais que não existem mais no GitHub
    if (octokit) {
      try {
        const processosLocal = getProcessosFromLocal()
        const slugsGitHub = new Set(processosGitHub.map(p => p.slug))
        
        // Encontrar arquivos locais que não estão no GitHub
        const arquivosParaRemover = processosLocal.filter(p => !slugsGitHub.has(p.slug))
        
        if (arquivosParaRemover.length > 0) {
          console.log(`[PROCESSOS] Removendo ${arquivosParaRemover.length} arquivos locais que não existem mais no GitHub`)
          
          const bpmnDir = join(process.cwd(), '..', 'api', 'storage', 'bpmn')
          const { rmSync, existsSync } = await import('fs')
          
          for (const processo of arquivosParaRemover) {
            try {
              const filePath = join(bpmnDir, processo.file)
              if (existsSync(filePath)) {
                rmSync(filePath, { force: true })
                console.log(`[PROCESSOS] Removido arquivo local: ${processo.file}`)
              }
              
              // Se o processo estava em uma pasta, verificar se a pasta está vazia
              if (processo.folderPath) {
                const folderPath = join(bpmnDir, processo.folderPath)
                if (existsSync(folderPath)) {
                  const { readdirSync } = await import('fs')
                  const contents = readdirSync(folderPath)
                  if (contents.length === 0) {
                    rmSync(folderPath, { recursive: true, force: true })
                    console.log(`[PROCESSOS] Removida pasta vazia: ${processo.folderPath}`)
                  }
                }
              }
            } catch (error: any) {
              console.warn(`[PROCESSOS] Erro ao remover arquivo local ${processo.file}:`, error.message)
            }
          }
        }
      } catch (error: any) {
        console.warn('[PROCESSOS] Erro ao limpar arquivos locais:', error.message)
      }
    }
    
    return processosGitHub
  }
  
  // Se não encontrou no GitHub e não há token, retornar vazio
  if (!octokit) {
    console.warn('[PROCESSOS] GITHUB_TOKEN não configurado - retornando vazio')
    return []
  }
  
  console.log('[PROCESSOS] Nenhum processo encontrado no GitHub')
  return []
}

// Desabilitar cache para sempre buscar dados atualizados
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ProcessosPage() {
  const processos = await getProcessos()
  
  return <ProcessosPageClient processosIniciais={processos} />
}
