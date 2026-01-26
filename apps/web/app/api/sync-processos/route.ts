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
 * GET /api/sync-processos
 * Sincroniza processos do repositório GitHub
 */
export async function GET() {
  try {
    console.log('[SYNC] Iniciando sincronização de processos...');

    // Listar conteúdo do repositório
    const { data: contents } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: '',
      ref: GITHUB_BRANCH,
    });

    if (!Array.isArray(contents)) {
      return NextResponse.json({ error: 'Conteúdo inválido' }, { status: 500 });
    }

    // Filtrar apenas pastas de processos (ignorar arquivos raiz como README)
    const processosPastas = contents.filter(
      (item) => item.type === 'dir' && !item.name.startsWith('.')
    );

    console.log(`[SYNC] Encontradas ${processosPastas.length} pastas de processos`);

    // Buscar informações detalhadas de cada processo
    const processos = await Promise.all(
      processosPastas.map(async (pasta) => {
        try {
          const { data: arquivos } = await octokit.repos.getContent({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            path: pasta.name,
            ref: GITHUB_BRANCH,
          });

          if (!Array.isArray(arquivos)) return null;

          // Procurar arquivo BPMN principal
          const arquivoBpmn = arquivos.find(
            (file) => file.type === 'file' && file.name.endsWith('.bpmn')
          );

          if (!arquivoBpmn) {
            console.log(`[SYNC] Pasta ${pasta.name} não contém arquivo BPMN`);
            return null;
          }

          // Verificar se existe pasta de subdiagramas
          const pastaSubdiagramas = arquivos.find(
            (item) => item.type === 'dir' && item.name === 'subdiagramas'
          );

          let subdiagramas: string[] = [];
          if (pastaSubdiagramas) {
            const { data: subFiles } = await octokit.repos.getContent({
              owner: GITHUB_OWNER,
              repo: GITHUB_REPO,
              path: `${pasta.name}/subdiagramas`,
              ref: GITHUB_BRANCH,
            });

            if (Array.isArray(subFiles)) {
              subdiagramas = subFiles
                .filter((f) => f.type === 'file' && f.name.endsWith('.bpmn'))
                .map((f) => f.name.replace('.bpmn', ''));
            }
          }

          // Verificar pasta pop-it
          const pastaPopIt = arquivos.find(
            (item) => item.type === 'dir' && item.name === 'pop-it'
          );

          let documentos: Record<string, string[]> = {};
          if (pastaPopIt) {
            const { data: popItFolders } = await octokit.repos.getContent({
              owner: GITHUB_OWNER,
              repo: GITHUB_REPO,
              path: `${pasta.name}/pop-it`,
              ref: GITHUB_BRANCH,
            });

            if (Array.isArray(popItFolders)) {
              // Para cada atividade, listar documentos
              for (const atividadeFolder of popItFolders) {
                if (atividadeFolder.type === 'dir') {
                  const { data: docs } = await octokit.repos.getContent({
                    owner: GITHUB_OWNER,
                    repo: GITHUB_REPO,
                    path: `${pasta.name}/pop-it/${atividadeFolder.name}`,
                    ref: GITHUB_BRANCH,
                  });

                  if (Array.isArray(docs)) {
                    documentos[atividadeFolder.name] = docs
                      .filter((d) => d.type === 'file')
                      .map((d) => d.name);
                  }
                }
              }
            }
          }

          const slug = arquivoBpmn.name.replace('.bpmn', '');

          return {
            slug,
            nome: pasta.name,
            pasta: pasta.name,
            arquivo: arquivoBpmn.name,
            subdiagramas,
            documentos,
            downloadUrl: arquivoBpmn.download_url,
          };
        } catch (error) {
          console.error(`[SYNC] Erro ao processar pasta ${pasta.name}:`, error);
          return null;
        }
      })
    );

    // Filtrar processos válidos
    const processosValidos = processos.filter((p) => p !== null);

    console.log(`[SYNC] ${processosValidos.length} processos válidos encontrados`);

    return NextResponse.json({
      success: true,
      count: processosValidos.length,
      processos: processosValidos,
    });
  } catch (error: any) {
    console.error('[SYNC] Erro ao sincronizar processos:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao sincronizar processos', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync-processos
 * Webhook do GitHub para sincronização automática
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    console.log('[WEBHOOK] Recebido evento do GitHub:', payload.ref);

    // Verificar se é push na branch main
    if (payload.ref === `refs/heads/${GITHUB_BRANCH}`) {
      console.log('[WEBHOOK] Push detectado na branch main, sincronizando...');
      
      // Chamar GET para fazer a sincronização
      const response = await fetch(`${request.url}`, {
        method: 'GET',
      });
      
      const data = await response.json();
      
      return NextResponse.json({
        success: true,
        message: 'Sincronização iniciada via webhook',
        data,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Evento ignorado (não é push na branch main)',
    });
  } catch (error: any) {
    console.error('[WEBHOOK] Erro:', error);
    return NextResponse.json(
      { error: 'Erro no webhook', details: error.message },
      { status: 500 }
    );
  }
}
