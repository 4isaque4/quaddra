import { NextResponse } from 'next/server'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import {
  GITHUB_OWNER,
  GITHUB_REPO_QUADDRA,
  GITHUB_REPO_VALESHOP,
  GITHUB_BRANCH,
  listGithubBpmnFiles,
  listLocalBpmnFiles,
  normalizeIncomingSlug,
  octokit,
  withRetry,
} from '@/lib/process-storage'

function bpmnResponse(content: string, filename: string): NextResponse {
  return new NextResponse(content, {
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    const normalizedSlug = normalizeIncomingSlug(params.slug)

    if (octokit) {
      for (const repo of [GITHUB_REPO_VALESHOP, GITHUB_REPO_QUADDRA]) {
        const files = await listGithubBpmnFiles(repo)
        const match = files.find((item) => item.slug === normalizedSlug)

        if (!match) continue

        const { data } = await withRetry(
          () =>
            octokit!.repos.getContent({
              owner: GITHUB_OWNER,
              repo,
              path: match.path,
              ref: GITHUB_BRANCH,
            }),
          `getContent:${repo}:${match.path}`,
        )

        if ('content' in data && data.type === 'file') {
          const content = Buffer.from(data.content, 'base64').toString('utf8')
          return bpmnResponse(content, match.name)
        }
      }
    }

    const localMatch = listLocalBpmnFiles().find((item) => item.slug === normalizedSlug)
    if (localMatch) {
      const fullPath = join(process.cwd(), '..', 'api', 'storage', 'bpmn', ...localMatch.path.split('/'))
      if (existsSync(fullPath)) {
        return bpmnResponse(readFileSync(fullPath, 'utf8'), localMatch.name)
      }
    }

    return NextResponse.json({ error: `Arquivo BPMN não encontrado para slug: ${normalizedSlug}` }, { status: 404 })
  } catch (error: any) {
    console.error('[BPMN API] erro ao buscar arquivo:', error?.message || error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
