import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    const filename = 'Comercial v2.0.bpmn'
    console.log('Tentando carregar arquivo:', filename)
    
    // Caminho correto: voltar 3 níveis para sair de apps/web/app/api e chegar em apps/api
    const filePath = join(process.cwd(), '..', 'api', 'storage', 'bpmn', filename)
    console.log('Caminho completo:', filePath)
    
    if (!existsSync(filePath)) {
      console.error('Arquivo não existe:', filePath)
      return NextResponse.json(
        { error: `Arquivo não encontrado: ${filename}` },
        { status: 404 }
      )
    }
    
    const fileContent = readFileSync(filePath, 'utf8')
    console.log('Arquivo carregado com sucesso, tamanho:', fileContent.length)
    
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `inline; filename="${filename}"`,
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
