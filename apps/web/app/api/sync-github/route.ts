import { NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Configuração do GitHub
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_OWNER = process.env.GITHUB_OWNER || '4isaque4';
const GITHUB_REPO = process.env.GITHUB_REPO_PROCESSOS || 'quaddra-processos';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

/**
 * GET /api/sync-github
 * Sincroniza processos do GitHub para arquivos locais
 */
export async function GET() {
  try {
    console.log('[SYNC-GITHUB] Iniciando sincronização...');

    const bpmnDir = join(process.cwd(), '..', 'api', 'storage', 'bpmn');
    
    // Criar diretório se não existir
    if (!existsSync(bpmnDir)) {
      mkdirSync(bpmnDir, { recursive: true });
    }

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

    // Filtrar pastas de processos
    const processosPastas = contents.filter(
      (item) => item.type === 'dir' && !item.name.startsWith('.')
    );

    console.log(`[SYNC-GITHUB] Encontradas ${processosPastas.length} pastas de processos`);

    let totalArquivos = 0;
    const resultados = [];

    // Para cada pasta de processo
    for (const pasta of processosPastas) {
      try {
        console.log(`[SYNC-GITHUB] Processando: ${pasta.name}`);

        // Listar conteúdo da pasta
        const { data: arquivos } = await octokit.repos.getContent({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          path: pasta.name,
          ref: GITHUB_BRANCH,
        });

        if (!Array.isArray(arquivos)) continue;

        // Criar pasta local
        const pastaLocal = join(bpmnDir, pasta.name);
        if (!existsSync(pastaLocal)) {
          mkdirSync(pastaLocal, { recursive: true });
        }

        // Processar arquivos BPMN principais
        const arquivosBpmn = arquivos.filter(
          (file) => file.type === 'file' && file.name.endsWith('.bpmn')
        );

        for (const arquivo of arquivosBpmn) {
          console.log(`[SYNC-GITHUB] Baixando: ${pasta.name}/${arquivo.name}`);

          // Buscar conteúdo do arquivo
          const { data: fileData } = await octokit.repos.getContent({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            path: `${pasta.name}/${arquivo.name}`,
            ref: GITHUB_BRANCH,
          });

          if ('content' in fileData && fileData.type === 'file') {
            // Decodificar Base64
            const content = Buffer.from(fileData.content, 'base64').toString('utf-8');

            // Salvar arquivo local
            const caminhoLocal = join(pastaLocal, arquivo.name);
            writeFileSync(caminhoLocal, content, 'utf-8');
            totalArquivos++;

            console.log(`[SYNC-GITHUB] ✓ Salvo: ${caminhoLocal}`);
          }
        }

        // Processar subdiagramas
        const pastaSubdiagramas = arquivos.find(
          (item) => item.type === 'dir' && item.name === 'subdiagramas'
        );

        if (pastaSubdiagramas) {
          console.log(`[SYNC-GITHUB] Processando subdiagramas de: ${pasta.name}`);

          const { data: subFiles } = await octokit.repos.getContent({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            path: `${pasta.name}/subdiagramas`,
            ref: GITHUB_BRANCH,
          });

          if (Array.isArray(subFiles)) {
            // Criar pasta de subdiagramas local
            const pastaSubLocal = join(pastaLocal, 'subdiagramas');
            if (!existsSync(pastaSubLocal)) {
              mkdirSync(pastaSubLocal, { recursive: true });
            }

            // Baixar cada subdiagrama
            for (const subFile of subFiles) {
              if (subFile.type === 'file' && subFile.name.endsWith('.bpmn')) {
                console.log(`[SYNC-GITHUB] Baixando subdiagrama: ${subFile.name}`);

                const { data: subData } = await octokit.repos.getContent({
                  owner: GITHUB_OWNER,
                  repo: GITHUB_REPO,
                  path: `${pasta.name}/subdiagramas/${subFile.name}`,
                  ref: GITHUB_BRANCH,
                });

                if ('content' in subData && subData.type === 'file') {
                  const content = Buffer.from(subData.content, 'base64').toString('utf-8');
                  const caminhoLocal = join(pastaSubLocal, subFile.name);
                  writeFileSync(caminhoLocal, content, 'utf-8');
                  totalArquivos++;

                  console.log(`[SYNC-GITHUB] ✓ Subdiagrama salvo: ${caminhoLocal}`);
                }
              }
            }
          }
        }

        // Processar documentos POP/IT
        const pastaPopIt = arquivos.find(
          (item) => item.type === 'dir' && item.name === 'pop-it'
        );

        if (pastaPopIt) {
          console.log(`[SYNC-GITHUB] Processando POP/IT de: ${pasta.name}`);

          const { data: popItFolders } = await octokit.repos.getContent({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            path: `${pasta.name}/pop-it`,
            ref: GITHUB_BRANCH,
          });

          if (Array.isArray(popItFolders)) {
            // Criar pasta pop-it local
            const pastaPopItLocal = join(pastaLocal, 'pop-it');
            if (!existsSync(pastaPopItLocal)) {
              mkdirSync(pastaPopItLocal, { recursive: true });
            }

            // Para cada pasta de atividade
            for (const atividadeFolder of popItFolders) {
              if (atividadeFolder.type === 'dir') {
                console.log(`[SYNC-GITHUB] Processando atividade: ${atividadeFolder.name}`);

                // Criar pasta da atividade
                const pastaAtividadeLocal = join(pastaPopItLocal, atividadeFolder.name);
                if (!existsSync(pastaAtividadeLocal)) {
                  mkdirSync(pastaAtividadeLocal, { recursive: true });
                }

                // Baixar documentos da atividade
                const { data: docs } = await octokit.repos.getContent({
                  owner: GITHUB_OWNER,
                  repo: GITHUB_REPO,
                  path: `${pasta.name}/pop-it/${atividadeFolder.name}`,
                  ref: GITHUB_BRANCH,
                });

                if (Array.isArray(docs)) {
                  for (const doc of docs) {
                    if (doc.type === 'file') {
                      console.log(`[SYNC-GITHUB] Baixando documento: ${doc.name}`);

                      const { data: docData } = await octokit.repos.getContent({
                        owner: GITHUB_OWNER,
                        repo: GITHUB_REPO,
                        path: `${pasta.name}/pop-it/${atividadeFolder.name}/${doc.name}`,
                        ref: GITHUB_BRANCH,
                      });

                      if ('content' in docData && docData.type === 'file') {
                        const buffer = Buffer.from(docData.content, 'base64');
                        const caminhoLocal = join(pastaAtividadeLocal, doc.name);
                        writeFileSync(caminhoLocal, buffer);
                        totalArquivos++;

                        console.log(`[SYNC-GITHUB] ✓ Documento salvo: ${caminhoLocal}`);
                      }
                    }
                  }
                }
              }
            }
          }
        }

        resultados.push({
          pasta: pasta.name,
          status: 'sucesso',
        });
      } catch (error: any) {
        console.error(`[SYNC-GITHUB] Erro ao processar ${pasta.name}:`, error);
        resultados.push({
          pasta: pasta.name,
          status: 'erro',
          erro: error.message,
        });
      }
    }

    console.log(`[SYNC-GITHUB] Sincronização concluída! Total de arquivos: ${totalArquivos}`);

    return NextResponse.json({
      success: true,
      message: 'Sincronização concluída',
      totalArquivos,
      totalPastas: processosPastas.length,
      resultados,
    });
  } catch (error: any) {
    console.error('[SYNC-GITHUB] Erro:', error);
    return NextResponse.json(
      {
        error: 'Erro ao sincronizar processos',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync-github
 * Webhook do GitHub para sincronização automática
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();

    console.log('[WEBHOOK] Recebido evento do GitHub:', payload.ref);

    // Verificar se é push na branch main
    if (payload.ref === `refs/heads/${GITHUB_BRANCH}`) {
      console.log('[WEBHOOK] Push detectado, iniciando sincronização...');

      // Chamar GET para fazer a sincronização
      const baseUrl = new URL(request.url).origin;
      const response = await fetch(`${baseUrl}/api/sync-github`, {
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
