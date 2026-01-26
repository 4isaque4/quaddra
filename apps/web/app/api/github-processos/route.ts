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

type ProcessoGitHub = {
  slug: string;
  nome: string;
  pasta: string;
  arquivo: string;
  subdiagramas: string[];
  documentos: Record<string, string[]>;
  bpmnUrl: string;
  categoria: string;
};

/**
 * GET /api/github-processos
 * Busca todos os processos do repositório GitHub formatados para o site
 */
export async function GET() {
  try {
    console.log('[GITHUB-PROCESSOS] Buscando processos...');

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

    // Filtrar apenas pastas de processos
    const processosPastas = contents.filter(
      (item) => item.type === 'dir' && !item.name.startsWith('.')
    );

    console.log(`[GITHUB-PROCESSOS] Encontradas ${processosPastas.length} pastas`);

    // Buscar informações detalhadas de cada processo
    const processos: ProcessoGitHub[] = [];

    for (const pasta of processosPastas) {
      try {
        const { data: arquivos } = await octokit.repos.getContent({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          path: pasta.name,
          ref: GITHUB_BRANCH,
        });

        if (!Array.isArray(arquivos)) continue;

        // Procurar arquivo BPMN principal
        const arquivoBpmn = arquivos.find(
          (file) => file.type === 'file' && file.name.endsWith('.bpmn') && !file.name.includes('/')
        );

        if (!arquivoBpmn) {
          console.log(`[GITHUB-PROCESSOS] Pasta ${pasta.name} não contém BPMN principal`);
          continue;
        }

        // Buscar subdiagramas
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

        // Buscar documentos POP/IT
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

        const slug = arquivoBpmn.name.replace('.bpmn', '').toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/ç/g, 'c')
          .replace(/\s+/g, '-');

        processos.push({
          slug,
          nome: pasta.name,
          pasta: pasta.name,
          arquivo: arquivoBpmn.name,
          subdiagramas,
          documentos,
          bpmnUrl: `/api/github-bpmn/${pasta.name}/${arquivoBpmn.name}`,
          categoria: pasta.name,
        });
      } catch (error) {
        console.error(`[GITHUB-PROCESSOS] Erro ao processar ${pasta.name}:`, error);
      }
    }

    console.log(`[GITHUB-PROCESSOS] ${processos.length} processos carregados`);

    return NextResponse.json({
      success: true,
      count: processos.length,
      processos,
    });
  } catch (error: any) {
    console.error('[GITHUB-PROCESSOS] Erro:', error);
    return NextResponse.json(
      {
        error: 'Erro ao buscar processos',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
