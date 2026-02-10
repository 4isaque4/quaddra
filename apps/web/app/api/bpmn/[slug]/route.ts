import { NextResponse } from 'next/server'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { Octokit } from '@octokit/rest'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''
const GITHUB_OWNER = process.env.GITHUB_OWNER || '4isaque4'
const GITHUB_REPO_QUADDRA = process.env.GITHUB_REPO_QUADDRA || 'vale-shope-processos'
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

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    // Normalizar o slug recebido (pode vir com caracteres especiais da URL)
    const normalizedSlug = normalizeSlug(decodeURIComponent(params.slug))
    const bpmnDir = join(process.cwd(), '..', 'api', 'storage', 'bpmn')
    
    if (!existsSync(bpmnDir)) {
      return NextResponse.json(
        { error: 'Diretório BPMN não encontrado' },
        { status: 404 }
      )
    }
    
    // Listar todos os arquivos BPMN recursivamente
    const files = getAllBpmnFiles(bpmnDir, bpmnDir)
    
    // Tentar encontrar o arquivo correspondente ao slug
    const matchingFile = files.find(({ path }) => {
      const fileSlug = normalizeSlug(path.replace(/\.bpmn$/i, ''))
      return fileSlug === normalizedSlug
    })
    
    if (!matchingFile) {
      console.log('[BPMN API] Arquivo não encontrado localmente para slug:', normalizedSlug)
      console.log('[BPMN API] Arquivos disponíveis localmente:', files.map(f => normalizeSlug(f.path.replace(/\.bpmn$/i, ''))))
      
      // Tentar buscar no GitHub se não encontrou localmente
      if (octokit) {
        console.log('[BPMN API] Tentando buscar no GitHub...')
        try {
          // Obter árvore completa do GitHub (tentar ambos os repositórios)
          const reposToTry = [GITHUB_REPO_VALESHOP, GITHUB_REPO_QUADDRA]
          
          for (const repo of reposToTry) {
            try {
              const { data: refData } = await octokit.git.getRef({
                owner: GITHUB_OWNER,
                repo: repo,
                ref: `heads/${GITHUB_BRANCH}`
              })

              const latestCommitSha = refData.object.sha
              const { data: currentTree } = await octokit.git.getTree({
                owner: GITHUB_OWNER,
                repo: repo,
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
                console.log('[BPMN API] ✅ Arquivo encontrado no GitHub:', githubFile.path, '(repo:', repo, ')')
                
                // Buscar conteúdo do arquivo no GitHub
                const { data: fileData } = await octokit.repos.getContent({
                  owner: GITHUB_OWNER,
                  repo: repo,
                  path: githubFile.path,
                  ref: GITHUB_BRANCH,
                })

                if ('content' in fileData && fileData.type === 'file') {
                  // Decodificar Base64
                  const fileContent = Buffer.from(fileData.content, 'base64').toString('utf-8')
                  const fileName = githubFile.path.split('/').pop() || 'processo.bpmn'
                  
                  return new NextResponse(fileContent, {
                    headers: {
                      'Content-Type': 'application/xml',
                      'Content-Disposition': `inline; filename="${fileName}"`,
                      'Cache-Control': 'public, max-age=3600',
                    },
                  })
                }
              }
            } catch (repoError: any) {
              console.warn(`[BPMN API] Erro ao buscar no repositório ${repo}:`, repoError.message)
              continue
            }
          }
        } catch (error: any) {
          console.warn('[BPMN API] Erro ao buscar no GitHub:', error.message)
        }
      }
      
      return NextResponse.json(
        { error: `Arquivo BPMN não encontrado para slug: ${normalizedSlug}` },
        { status: 404 }
      )
    }
    
    // Usar join corretamente sem forçar separadores
    const pathParts = matchingFile.path.split('/')
    const filePath = join(bpmnDir, ...pathParts)
    
    console.log('[BPMN API] Tentando ler arquivo:', filePath)
    console.log('[BPMN API] Arquivo existe?', existsSync(filePath))
    
    const fileContent = readFileSync(filePath, 'utf8')
    
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `inline; filename="${matchingFile.name}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Erro ao ler arquivo BPMN:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

