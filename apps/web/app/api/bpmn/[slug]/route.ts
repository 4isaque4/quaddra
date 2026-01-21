import { NextResponse } from 'next/server'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
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
      return NextResponse.json(
        { error: `Arquivo BPMN não encontrado para slug: ${normalizedSlug}` },
        { status: 404 }
      )
    }
    
    const filePath = join(bpmnDir, matchingFile.path.replace(/\//g, '\\'))
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

