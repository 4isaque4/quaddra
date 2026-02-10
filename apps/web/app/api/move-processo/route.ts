import { NextResponse } from 'next/server'
import {
  GITHUB_BRANCH,
  GITHUB_OWNER,
  GITHUB_REPO_QUADDRA,
  GITHUB_REPO_VALESHOP,
  listGithubBpmnFiles,
  normalizeIncomingSlug,
  octokit,
  syncLocalMove,
  withRetry,
} from '@/lib/process-storage'

function sanitizeTargetFolder(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/^\/+|\/+$/g, '')
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const slugParam = body?.processSlug
    const targetFolderPath = sanitizeTargetFolder(body?.targetFolderPath)
    const clientType = body?.clientType === 'valeshop' ? 'valeshop' : 'quaddra'

    if (!slugParam || typeof slugParam !== 'string') {
      return NextResponse.json({ error: 'Slug do processo é obrigatório' }, { status: 400 })
    }

    if (!octokit) {
      return NextResponse.json({ error: 'GITHUB_TOKEN não configurado' }, { status: 500 })
    }

    const repo = clientType === 'valeshop' ? GITHUB_REPO_VALESHOP : GITHUB_REPO_QUADDRA
    const slug = normalizeIncomingSlug(slugParam)
    const files = await listGithubBpmnFiles(repo)
    const match = files.find((file) => file.slug === slug)

    if (!match) {
      return NextResponse.json({ error: 'Processo não encontrado no GitHub' }, { status: 404 })
    }

    const fileName = match.path.split('/').pop() || match.name
    const targetPath = targetFolderPath ? `${targetFolderPath}/${fileName}` : fileName

    if (targetPath === match.path) {
      return NextResponse.json({ success: true, message: 'Processo já está no destino', newPath: targetPath })
    }

    const { data: sourceData } = await withRetry(
      () =>
        octokit!.repos.getContent({
          owner: GITHUB_OWNER,
          repo,
          path: match.path,
          ref: GITHUB_BRANCH,
        }),
      `move:getSource:${repo}:${match.path}`,
    )

    if (!('content' in sourceData) || sourceData.type !== 'file' || !sourceData.sha) {
      return NextResponse.json({ error: 'Arquivo fonte inválido no GitHub' }, { status: 500 })
    }

    const content = Buffer.from(sourceData.content, 'base64').toString('utf8')

    let destinationSha: string | undefined
    try {
      const { data: destData } = await octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo,
        path: targetPath,
        ref: GITHUB_BRANCH,
      })

      if ('sha' in destData && destData.sha) destinationSha = destData.sha
    } catch (error: any) {
      if (error?.status !== 404) throw error
    }

    await withRetry(
      () =>
        octokit!.repos.createOrUpdateFileContents({
          owner: GITHUB_OWNER,
          repo,
          path: targetPath,
          message: `chore: mover processo ${match.path} para ${targetPath}`,
          content: Buffer.from(content, 'utf8').toString('base64'),
          sha: destinationSha,
          branch: GITHUB_BRANCH,
        }),
      `move:createTarget:${repo}:${targetPath}`,
    )

    await withRetry(
      () =>
        octokit!.repos.deleteFile({
          owner: GITHUB_OWNER,
          repo,
          path: match.path,
          message: `chore: remover origem após mover ${match.path}`,
          sha: sourceData.sha,
          branch: GITHUB_BRANCH,
        }),
      `move:deleteSource:${repo}:${match.path}`,
    )

    syncLocalMove(match.path, targetPath, content)

    return NextResponse.json(
      {
        success: true,
        message: 'Processo movido com sucesso',
        oldPath: match.path,
        newPath: targetPath,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      },
    )
  } catch (error: any) {
    console.error('[MOVE] erro:', error?.message || error)
    return NextResponse.json(
      { error: 'Erro ao mover processo', details: error?.message || 'erro desconhecido' },
      { status: 500 },
    )
  }
}
