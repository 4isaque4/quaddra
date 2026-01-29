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
    console.log('[UPLOAD] Current working directory:', process.cwd());

    const formData = await request.formData();

    // Extrair dados
    const nomeProcesso = formData.get('nomeProcesso') as string;
    const bpmnPrincipal = formData.get('bpmn') as File;
    const subdiagramas = formData.getAll('subdiagramas') as File[];
    const documentos = formData.getAll('documentos') as File[];

    if (!nomeProcesso || !bpmnPrincipal) {
      console.error('[UPLOAD] Erro: Dados obrigatórios faltando');
      return NextResponse.json(
        { error: 'Nome do processo e arquivo BPMN são obrigatórios' },
        { status: 400 }
      );
    }

    console.log(`[UPLOAD] Processo: ${nomeProcesso}`);
    console.log(`[UPLOAD] BPMN: ${bpmnPrincipal.name}`);
    console.log(`[UPLOAD] Subdiagramas: ${subdiagramas.length}`);
    console.log(`[UPLOAD] Documentos: ${documentos.length}`);

    // Criar estrutura local - usar caminho absoluto
    const bpmnDir = join(process.cwd(), '..', 'api', 'storage', 'bpmn', nomeProcesso);
    console.log('[UPLOAD] Criando diretório:', bpmnDir);
    
    try {
      if (!existsSync(bpmnDir)) {
        mkdirSync(bpmnDir, { recursive: true });
        console.log('[UPLOAD] ✓ Diretório criado com sucesso');
      } else {
        console.log('[UPLOAD] ✓ Diretório já existe');
      }
    } catch (dirError: any) {
      console.error('[UPLOAD] Erro ao criar diretório:', dirError);
      throw new Error(`Erro ao criar diretório: ${dirError.message}`);
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
    console.log('[UPLOAD] GitHub Config:', {
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      branch: GITHUB_BRANCH,
      hasToken: !!GITHUB_TOKEN
    });

    try {
      // Verificar se o token está configurado
      if (!GITHUB_TOKEN) {
        console.warn('[UPLOAD] ⚠️  GitHub token não configurado - pulando sincronização');
        return NextResponse.json({
          success: true,
          message: 'Processo salvo localmente (GitHub não configurado)',
          nomeProcesso,
          totalArquivos,
          githubSynced: false,
          arquivos: {
            bpmn: bpmnPrincipal.name,
            subdiagramas: subdiagramas.map((s) => s.name),
            documentos: documentos.map((d) => d.name),
          },
        });
      }

      // Obter SHA da branch principal
      const { data: ref } = await octokit.git.getRef({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        ref: `heads/${GITHUB_BRANCH}`,
      });

      const currentCommitSha = ref.object.sha;
      console.log('[UPLOAD] ✓ Referência obtida:', currentCommitSha);

      // Obter árvore do commit atual
      const { data: currentCommit } = await octokit.git.getCommit({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        commit_sha: currentCommitSha,
      });

      const currentTreeSha = currentCommit.tree.sha;

      // Criar blobs para cada arquivo
      console.log('[UPLOAD] Criando blobs para', arquivosGitHub.length, 'arquivos...');
      const blobs = await Promise.all(
        arquivosGitHub.map(async (arquivo, index) => {
          console.log(`[UPLOAD] Criando blob ${index + 1}/${arquivosGitHub.length}:`, arquivo.path);
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
      console.log('[UPLOAD] ✓ Todos os blobs criados');

      // Criar nova árvore
      console.log('[UPLOAD] Criando nova árvore...');
      const { data: newTree } = await octokit.git.createTree({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        base_tree: currentTreeSha,
        tree: blobs,
      });
      console.log('[UPLOAD] ✓ Árvore criada:', newTree.sha);

      // Criar commit
      console.log('[UPLOAD] Criando commit...');
      const { data: newCommit } = await octokit.git.createCommit({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        message: `feat: adicionar processo ${nomeProcesso} via upload web\n\n- ${totalArquivos} arquivo(s) adicionado(s)`,
        tree: newTree.sha,
        parents: [currentCommitSha],
      });
      console.log('[UPLOAD] ✓ Commit criado:', newCommit.sha);

      // Atualizar referência da branch
      console.log('[UPLOAD] Atualizando referência da branch...');
      await octokit.git.updateRef({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        ref: `heads/${GITHUB_BRANCH}`,
        sha: newCommit.sha,
      });

      console.log('[UPLOAD] ✓ Push para GitHub concluído!');
    } catch (gitError: any) {
      console.error('[UPLOAD] Erro ao fazer push no GitHub:', gitError);
      console.error('[UPLOAD] Detalhes do erro:', {
        message: gitError.message,
        status: gitError.status,
        response: gitError.response?.data
      });
      
      // Salvar localmente mesmo se o GitHub falhar
      console.log('[UPLOAD] Arquivos salvos localmente, mas GitHub falhou');
      return NextResponse.json({
        success: true,
        message: 'Processo salvo localmente (erro ao sincronizar com GitHub)',
        nomeProcesso,
        totalArquivos,
        githubSynced: false,
        githubError: gitError.message,
        arquivos: {
          bpmn: bpmnPrincipal.name,
          subdiagramas: subdiagramas.map((s) => s.name),
          documentos: documentos.map((d) => d.name),
        },
      });
    }

    console.log(`[UPLOAD] ✓ Upload concluído com sucesso! Total: ${totalArquivos} arquivos`);

    return NextResponse.json({
      success: true,
      message: 'Processo inserido e sincronizado com GitHub',
      nomeProcesso,
      totalArquivos,
      githubSynced: true,
      arquivos: {
        bpmn: bpmnPrincipal.name,
        subdiagramas: subdiagramas.map((s) => s.name),
        documentos: documentos.map((d) => d.name),
      },
    });
  } catch (error: any) {
    console.error('[UPLOAD] ❌ Erro fatal:', error);
    console.error('[UPLOAD] Stack:', error.stack);
    return NextResponse.json(
      {
        error: 'Erro ao fazer upload do processo',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
