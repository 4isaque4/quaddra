import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Para rotas de upload, aumentar headers de tamanho máximo
  if (request.nextUrl.pathname.startsWith('/api/upload-processo')) {
    const response = NextResponse.next()
    // Adicionar headers que podem ajudar com limites de tamanho
    response.headers.set('X-Accel-Buffering', 'no')
    return response
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
