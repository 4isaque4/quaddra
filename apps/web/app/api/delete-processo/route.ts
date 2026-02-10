import { NextResponse } from 'next/server'
import {
  GITHUB_BRANCH,
  GITHUB_OWNER,
  GITHUB_REPO_QUADDRA,
  GITHUB_REPO_VALESHOP,
  listGithubBpmnFiles,
  normalizeIncomingSlug,
  octokit,
  syncLocalDelete,
  withRetry,
} from '@/lib/process-storage'

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const slugParam = searchParams.get('slug')
    const clientType = searchParams.get('clientType') || 'quaddra'

    if (!slugParam) {
      return NextResponse.json({ error: 'Slug é obrigatório' }, { status: 400 })
    }

    const slug = normalizeIncomingSlug(slugParam)
    const repo = clientType === 'valeshop' ? GITHUB_REPO_VALESHOP : GITHUB_REPO_QUADDRA

    const githubFiles = octokit ? await listGithubBpmnFiles(repo) : []
    const githubMatch = githubFiles.find((file) => file.slug === slug)

    let deletedGitHub = false
    if (octokit && githubMatch) {
      const { data: fileData } = await withRetry(
        () =>
          octokit!.repos.getContent({
            owner: GITHUB_OWNER,
            repo,
            path: githubMatch.path,
            ref: GITHUB_BRANCH,
          }),
        `delete:getContent:${repo}:${githubMatch.path}`,
      )

      if (!('sha' in fileData) || !fileData.sha) {
        return NextResponse.json({ error: 'Arquivo GitHub sem SHA para deleção' }, { status: 500 })
      }

      await withRetry(
        () =>
          octokit!.repos.deleteFile({
            owner: GITHUB_OWNER,
            repo,
            path: githubMatch.path,
            message: `chore: deletar processo ${githubMatch.path}`,
            sha: fileData.sha,
            branch: GITHUB_BRANCH,
          }),
        `delete:file:${repo}:${githubMatch.path}`,
      )

      deletedGitHub = true
    }

    const deletedLocal = githubMatch ? syncLocalDelete(githubMatch.path) : false

    return NextResponse.json(
      {
        success: true,
        slug,
        deletedGitHub,
        deletedLocal,
        path: githubMatch?.path,
        message:
          deletedGitHub || deletedLocal
            ? 'Processo deletado com sucesso'
            : 'Processo não encontrado para deleção',
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
    console.error('[DELETE] erro:', error?.message || error)
    return NextResponse.json(
      { success: false, error: 'Erro ao deletar processo', details: error?.message || 'erro desconhecido' },
      { status: 500 },
    )
  }
}
