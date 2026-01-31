import ProcessosPageClient from '../../processos/ProcessosPageClient'
import { readdirSync, existsSync, statSync } from 'fs'
import { join, relative } from 'path'

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
}

function getProcessos(): ProcessoItem[] {
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
      if (pathParts.length > 1) {
        categoria = pathParts[0] // Nome da pasta
      }
      
      return {
        file: path,
        slug,
        nome: name.replace(/\.bpmn$/i, ''),
        categoria
      }
    }).sort((a, b) => a.nome.localeCompare(b.nome))
  } catch (error) {
    console.error('Erro ao buscar processos:', error)
    return []
  }
}

// Desabilitar cache para sempre buscar dados atualizados
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function ValeShopProcessosPage() {
  const processos = getProcessos()
  
  return <ProcessosPageClient processosIniciais={processos} basePath="/vale-shop" />
}
