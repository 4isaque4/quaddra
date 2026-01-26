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
 * GET /api/github-bpmn/[pasta]/subdiagramas/[arquivo]
 * Busca conteúdo de um subdiagrama BPMN do GitHub
 */
export async function GET(
  request: Request,
  { params }: { params: { pasta: string; arquivo: string } }
) {
  try {
    const { pasta, arquivo } = params;
    const arquivoCompleto = arquivo.endsWith('.bpmn') ? arquivo : `${arquivo}.bpmn`;
    const path = `${pasta}/subdiagramas/${arquivoCompleto}`;

    console.log(`[GITHUB-SUBDIAGRAMA] Buscando: ${path}`);

    // Buscar arquivo do GitHub
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path,
      ref: GITHUB_BRANCH,
    });

    if (Array.isArray(data) || data.type !== 'file') {
      return NextResponse.json(
        { error: 'Subdiagrama não encontrado' },
        { status: 404 }
      );
    }

    // Decodificar conteúdo Base64
    const content = Buffer.from(data.content, 'base64').toString('utf-8');

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `inline; filename="${arquivoCompleto}"`,
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error: any) {
    console.error('[GITHUB-SUBDIAGRAMA] Erro:', error);
    
    if (error.status === 404) {
      return NextResponse.json(
        { error: 'Subdiagrama não encontrado no repositório' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: 'Erro ao buscar subdiagrama',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
