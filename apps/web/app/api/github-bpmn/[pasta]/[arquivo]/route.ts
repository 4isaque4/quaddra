import { NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

// Configuração do GitHub
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_OWNER = process.env.GITHUB_OWNER || '4isaque4';
const GITHUB_REPO = process.env.GITHUB_REPO_PROCESSOS || 'quaddra-processos';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

/**
 * GET /api/github-bpmn/[pasta]/[arquivo]
 * Busca conteúdo de um arquivo BPMN do GitHub
 */
export async function GET(
  request: Request,
  { params }: { params: { pasta: string; arquivo: string } }
) {
  try {
    const { pasta, arquivo } = params;
    const path = `${pasta}/${arquivo}`;

    console.log(`[GITHUB-BPMN] Buscando: ${path}`);

    // Buscar arquivo do GitHub
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path,
      ref: GITHUB_BRANCH,
    });

    if (Array.isArray(data) || data.type !== 'file') {
      return NextResponse.json(
        { error: 'Arquivo não encontrado' },
        { status: 404 }
      );
    }

    // Decodificar conteúdo Base64
    const content = Buffer.from(data.content, 'base64').toString('utf-8');

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `inline; filename="${arquivo}"`,
        'Cache-Control': 'public, max-age=300', // Cache de 5 minutos
      },
    });
  } catch (error: any) {
    console.error('[GITHUB-BPMN] Erro:', error);
    
    if (error.status === 404) {
      return NextResponse.json(
        { error: 'Arquivo não encontrado no repositório' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: 'Erro ao buscar arquivo BPMN',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
