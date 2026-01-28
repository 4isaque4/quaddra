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
 * POST /api/upload-processo
 * Faz upload de processo para GitHub e arquivos locais
 */
export async function POST(request: Request) {
  try {
    console.log('[UPLOAD] Iniciando upload de processo...');

    const formData = await request.formData();

    // Extrair dados
    const nomeProcesso = formData.get('nomeProcesso') as string;
    const bpmnPrincipal = formData.get('bpmn') as File;
    const subdiagramas = formData.getAll('subdiagramas') as File[];
    const documentos = formData.getAll('documentos') as File[];

    if (!nomeProcesso || !bpmnPrincipal) {
      return NextResponse.json(
        { error: 'Nome do processo e arquivo BPMN são obrigatórios' },
        { status: 400 }
      );
    }

    console.log(`[UPLOAD] Processo: ${nomeProcesso}`);
    console.log(`[UPLOAD] BPMN: ${bpmnPrincipal.name}`);
    console.log(`[UPLOAD] Subdiagramas: ${subdiagramas.length}`);
    console.log(`[UPLOAD] Documentos: ${documentos.length}`);

    // Criar estrutura local
    const bpmnDir = join(process.cwd(), '..', 'api', 'storage', 'bpmn', nomeProcesso);
    if (!existsSync(bpmnDir)) {
      mkdirSync(bpmnDir, { recursive: true });
    }

    let totalArquivos = 0;
    const arquivosGitHub: Array<{ path: string; content: string }> = [];

    // 1. Processar BPMN Principal
    const bpmnContent = await bpmnPrincipal.text();
    const bpmnPath = join(bpmnDir, bpmnPrincipal.name);
    writeFileSync(bpmnPath, bpmnContent, 'utf-8');
    totalArquivos++;

    // Adicionar ao GitHub
    arquivosGitHub.push({
      path: `${nomeProcesso}/${bpmnPrincipal.name}`,
      content: Buffer.from(bpmnContent).toString('base64'),
    });

    console.log(`[UPLOAD] ✓ BPMN salvo: ${bpmnPath}`);

    // 2. Processar Subdiagramas
    if (subdiagramas.length > 0) {
      const subDir = join(bpmnDir, 'subdiagramas');
      if (!existsSync(subDir)) {
        mkdirSync(subDir, { recursive: true });
      }

      for (const sub of subdiagramas) {
        const content = await sub.text();
        const subPath = join(subDir, sub.name);
        writeFileSync(subPath, content, 'utf-8');
        totalArquivos++;

        arquivosGitHub.push({
          path: `${nomeProcesso}/subdiagramas/${sub.name}`,
          content: Buffer.from(content).toString('base64'),
        });

        console.log(`[UPLOAD] ✓ Subdiagrama salvo: ${subPath}`);
      }
    }

    // 3. Processar Documentos POP/IT
    if (documentos.length > 0) {
      const popItDir = join(bpmnDir, 'pop-it', 'geral');
      if (!existsSync(popItDir)) {
        mkdirSync(popItDir, { recursive: true });
      }

      for (const doc of documentos) {
        const buffer = await doc.arrayBuffer();
        const docPath = join(popItDir, doc.name);
        writeFileSync(docPath, Buffer.from(buffer));
        totalArquivos++;

        arquivosGitHub.push({
          path: `${nomeProcesso}/pop-it/geral/${doc.name}`,
          content: Buffer.from(buffer).toString('base64'),
        });

        console.log(`[UPLOAD] ✓ Documento salvo: ${docPath}`);
      }
    }

    // 4. Fazer commit e push no GitHub
    console.log('[UPLOAD] Enviando para GitHub...');

    try {
      // Obter SHA da branch principal
      const { data: ref } = await octokit.git.getRef({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        ref: `heads/${GITHUB_BRANCH}`,
      });

      const currentCommitSha = ref.object.sha;

      // Obter árvore do commit atual
      const { data: currentCommit } = await octokit.git.getCommit({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        commit_sha: currentCommitSha,
      });

      const currentTreeSha = currentCommit.tree.sha;

      // Criar blobs para cada arquivo
      const blobs = await Promise.all(
        arquivosGitHub.map(async (arquivo) => {
          const { data: blob } = await octokit.git.createBlob({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            content: arquivo.content,
            encoding: 'base64',
          });

          return {
            path: arquivo.path,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: blob.sha,
          };
        })
      );

      // Criar nova árvore
      const { data: newTree } = await octokit.git.createTree({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        base_tree: currentTreeSha,
        tree: blobs,
      });

      // Criar commit
      const { data: newCommit } = await octokit.git.createCommit({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        message: `feat: adicionar processo ${nomeProcesso} via upload web\n\n- ${totalArquivos} arquivo(s) adicionado(s)`,
        tree: newTree.sha,
        parents: [currentCommitSha],
      });

      // Atualizar referência da branch
      await octokit.git.updateRef({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        ref: `heads/${GITHUB_BRANCH}`,
        sha: newCommit.sha,
      });

      console.log('[UPLOAD] ✅ Push para GitHub concluído!');
    } catch (gitError: any) {
      console.error('[UPLOAD] Erro ao fazer push no GitHub:', gitError);
      throw new Error(`Erro ao enviar para GitHub: ${gitError.message}`);
    }

    console.log(`[UPLOAD] Upload concluído! Total: ${totalArquivos} arquivos`);

    return NextResponse.json({
      success: true,
      message: 'Processo inserido com sucesso',
      nomeProcesso,
      totalArquivos,
      arquivos: {
        bpmn: bpmnPrincipal.name,
        subdiagramas: subdiagramas.map((s) => s.name),
        documentos: documentos.map((d) => d.name),
      },
    });
  } catch (error: any) {
    console.error('[UPLOAD] Erro:', error);
    return NextResponse.json(
      {
        error: 'Erro ao fazer upload do processo',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
