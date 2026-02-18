import { NextResponse } from 'next/server'
import { GITHUB_REPO_QUADDRA, GITHUB_REPO_VALESHOP, listGithubFolderPaths } from '@/lib/process-storage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientType = (searchParams.get('clientType') || 'quaddra').toLowerCase()
    const repo = clientType === 'valeshop' ? GITHUB_REPO_VALESHOP : GITHUB_REPO_QUADDRA

    const folders = await listGithubFolderPaths(repo)
    return NextResponse.json({ folders })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao listar pastas'
    console.error('[api/folders]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
