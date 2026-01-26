import { NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_OWNER = process.env.GITHUB_OWNER || '4isaque4';
const GITHUB_REPO = process.env.GITHUB_REPO_PROCESSOS || 'quaddra-processos';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

/**
 * GET /api/popit/[processo]/[atividade]
 * Lista documentos POP/IT de uma atividade específica
 */
export async function GET(
  request: Request,
  { params }: { params: { processo: string; atividade: string } }
) {
  try {
    const { processo, atividade } = params;
    
    console.log(`[POP/IT] Buscando documentos: ${processo}/${atividade}`);

    const path = `${processo}/pop-it/${atividade}`;

    const { data: arquivos } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path,
      ref: GITHUB_BRANCH,
    });

    if (!Array.isArray(arquivos)) {
      return NextResponse.json({ error: 'Pasta não encontrada' }, { status: 404 });
    }

    const documentos = arquivos
      .filter((file) => file.type === 'file')
      .map((file) => ({
        nome: file.name,
        tamanho: file.size,
        downloadUrl: file.download_url,
        htmlUrl: file.html_url,
      }));

    return NextResponse.json({
      processo,
      atividade,
      documentos,
    });
  } catch (error: any) {
    console.error('[POP/IT] Erro:', error);
    
    if (error.status === 404) {
      return NextResponse.json({
        processo: params.processo,
        atividade: params.atividade,
        documentos: [],
      });
    }

    return NextResponse.json(
      { error: 'Erro ao buscar documentos', details: error.message },
      { status: 500 }
    );
  }
}
