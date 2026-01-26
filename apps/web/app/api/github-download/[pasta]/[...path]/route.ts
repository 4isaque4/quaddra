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
 * GET /api/github-download/[pasta]/[...path]
 * Faz download de um documento do repositório GitHub
 */
export async function GET(
  request: Request,
  { params }: { params: { pasta: string; path: string[] } }
) {
  try {
    const { pasta, path } = params;
    const pathCompleto = `${pasta}/${path.join('/')}`;

    console.log(`[GITHUB-DOWNLOAD] Fazendo download de: ${pathCompleto}`);

    // Buscar arquivo do GitHub
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: pathCompleto,
      ref: GITHUB_BRANCH,
    });

    if (Array.isArray(data) || data.type !== 'file') {
      return NextResponse.json(
        { error: 'Arquivo não encontrado' },
        { status: 404 }
      );
    }

    // Decodificar conteúdo Base64
    const buffer = Buffer.from(data.content, 'base64');

    // Detectar tipo de arquivo
    const filename = path[path.length - 1];
    const ext = filename.split('.').pop()?.toLowerCase();
    
    let contentType = 'application/octet-stream';
    if (ext === 'pdf') contentType = 'application/pdf';
    else if (ext === 'docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext === 'doc') contentType = 'application/msword';
    else if (ext === 'xlsx') contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    else if (ext === 'xls') contentType = 'application/vnd.ms-excel';
    else if (ext === 'txt') contentType = 'text/plain';
    else if (ext === 'png') contentType = 'image/png';
    else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'public, max-age=3600', // Cache de 1 hora
      },
    });
  } catch (error: any) {
    console.error('[GITHUB-DOWNLOAD] Erro:', error);
    
    if (error.status === 404) {
      return NextResponse.json(
        { error: 'Arquivo não encontrado no repositório' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: 'Erro ao fazer download do arquivo',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
