import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    // Caminho correto: voltar 3 níveis para sair de apps/web/app/api e chegar em apps/api
    const filePath = join(process.cwd(), '..', 'api', 'storage', 'descriptions.flat.json')
    console.log('Tentando carregar descrições de:', filePath)
    
    if (!existsSync(filePath)) {
      console.error('Arquivo de descrições não existe:', filePath)
      return NextResponse.json(
        { error: 'Arquivo de descrições não encontrado' },
        { status: 404 }
      )
    }
    
    const fileContent = readFileSync(filePath, 'utf8')
    console.log('Descrições carregadas com sucesso, tamanho:', fileContent.length)
    
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache por 1 hora
      },
    })
  } catch (error) {
    console.error('Erro ao ler arquivo de descrições:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
