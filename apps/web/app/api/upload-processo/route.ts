import { NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { parseBizagiBpmn, convertToContentFormat, extractPerformers } from '@/../../apps/api/lib/bizagi-parser';
import { convertBpmToBpmn, validateBpmnXml } from '@/../../apps/api/lib/bpm-converter';

// Configuração do GitHub
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_OWNER = process.env.GITHUB_OWNER || '4isaque4';
const GITHUB_REPO = process.env.GITHUB_REPO_PROCESSOS || 'quaddra-processos';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

// Tipo para estrutura de pastas
interface FolderConfig {
  name: string;
  fileCount: number;
}

/**
 * POST /api/upload-processo
 * Faz upload de processo para GitHub e arquivos locais
 * Suporta arquivos .bpm (com conversão automática) e estrutura de pastas flexível
 */
export async function POST(request: Request) {
  try {
    console.log('[UPLOAD] Iniciando upload de processo');

    const formData = await request.formData();

    // Extrair dados básicos
    const processName = formData.get('processName') as string;
    const mainFile = formData.get('mainFile') as File;
    const mainFileName = formData.get('mainFileName') as string;
    let bpmnXml = formData.get('bpmnXml') as string | null;
    const folderStructureJson = formData.get('folderStructure') as string | null;
    const clientType = formData.get('clientType') as string | null; // 'valeshop' ou 'quaddra'

    // Determinar repositório baseado no cliente
    const REPO_NAME = clientType === 'valeshop' ? 'vale-shope-processos' : (GITHUB_REPO || 'quaddra-processos');
    
    console.log('[UPLOAD] Cliente:', clientType || 'quaddra', '- Repositório:', REPO_NAME);

    if (!processName || !mainFile) {
      console.error('[UPLOAD] Dados obrigatórios faltando');
      return NextResponse.json(
        { error: 'Nome do processo e arquivo principal são obrigatórios' },
        { status: 400 }
      );
    }

    // Parse da estrutura de pastas
    let folderStructure: FolderConfig[] = [];
    if (folderStructureJson) {
      try {
        folderStructure = JSON.parse(folderStructureJson);
        console.log('[UPLOAD] Estrutura:', folderStructure.length, 'pasta(s)');
      } catch (e) {
        console.error('[UPLOAD] Erro ao parsear estrutura:', e);
      }
    }

    console.log('[UPLOAD] Processo:', processName);
    console.log('[UPLOAD] Arquivo:', mainFileName);

    // Criar estrutura local
    const bpmnDir = join(process.cwd(), '..', 'api', 'storage', 'bpmn', processName);
    const contentDir = join(process.cwd(), '..', 'api', 'storage', 'content');

    try {
      if (!existsSync(bpmnDir)) {
        mkdirSync(bpmnDir, { recursive: true });
      }
      if (!existsSync(contentDir)) {
        mkdirSync(contentDir, { recursive: true });
      }
    } catch (dirError: any) {
      throw new Error(`Erro ao criar diretórios: ${dirError.message}`);
    }

    let totalFiles = 0;
    const githubFiles: Array<{ path: string; content: string }> = [];

    // Processar pastas personalizadas
    for (let i = 0; i < folderStructure.length; i++) {
      const folder = folderStructure[i];
      const isRootFolder = i === 0; // Primeira pasta é a raiz
      const folderFiles = formData.getAll(`folder_${folder.name}`) as File[];

      if (folderFiles.length === 0) {
        console.log('[UPLOAD] Pasta sem arquivos:', folder.name);
        continue;
      }

      console.log(`[UPLOAD] Processando pasta ${i + 1}:`, folder.name, '(', folderFiles.length, 'arquivos)', isRootFolder ? '(RAIZ)' : '');

      // Determinar diretório de destino
      const folderDir = isRootFolder ? bpmnDir : join(bpmnDir, folder.name);

      if (!existsSync(folderDir)) {
        mkdirSync(folderDir, { recursive: true });
      }

      // Processar cada arquivo
      for (const file of folderFiles) {
        const isText = file.name.endsWith('.bpmn') ||
          file.name.endsWith('.txt') ||
          file.name.endsWith('.json') ||
          file.name.endsWith('.xml');

        let content: Buffer;
        if (isText) {
          const text = await file.text();
          content = Buffer.from(text, 'utf-8');
        } else {
          const buffer = await file.arrayBuffer();
          content = Buffer.from(buffer);
        }

        // Salvar localmente
        const filePath = join(folderDir, file.name);
        writeFileSync(filePath, content);
        totalFiles++;

        // Adicionar ao GitHub (raiz ou subpasta)
        const githubPath = isRootFolder
          ? `${processName}/${file.name}`
          : `${processName}/${folder.name}/${file.name}`;

        githubFiles.push({
          path: githubPath,
          content: content.toString('base64'),
        });

        const displayPath = isRootFolder ? file.name : `${folder.name}/${file.name}`;
        console.log('[UPLOAD] Arquivo salvo:', displayPath);
      }
    }

    // 4. Fazer commit e push no GitHub
    console.log('[UPLOAD] Enviando para GitHub');

    try {
      // Verificar se o token está configurado
      if (!GITHUB_TOKEN) {
        console.warn('[UPLOAD] GitHub token não configurado');
        return NextResponse.json({
          success: true,
          message: 'Processo salvo localmente (GitHub não configurado)',
          processName,
          totalArquivos: totalFiles,
          githubSynced: false,
          folderStructure,
        });
      }

      // Obter SHA da branch principal
      const { data: ref } = await octokit.git.getRef({
        owner: GITHUB_OWNER,
        repo: REPO_NAME,
        ref: `heads/${GITHUB_BRANCH}`,
      });

      const currentCommitSha = ref.object.sha;
      console.log('[UPLOAD] Referência obtida');

      // Obter árvore do commit atual
      const { data: currentCommit } = await octokit.git.getCommit({
        owner: GITHUB_OWNER,
        repo: REPO_NAME,
        commit_sha: currentCommitSha,
      });

      const currentTreeSha = currentCommit.tree.sha;

      // Criar blobs para cada arquivo
      console.log('[UPLOAD] Criando blobs:', githubFiles.length, 'arquivos');
      const blobs = await Promise.all(
        githubFiles.map(async (file) => {
          const { data: blob } = await octokit.git.createBlob({
            owner: GITHUB_OWNER,
            repo: REPO_NAME,
            content: file.content,
            encoding: 'base64',
          });

          return {
            path: file.path,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: blob.sha,
          };
        })
      );
      console.log('[UPLOAD] Blobs criados');

      // Criar nova árvore
      console.log('[UPLOAD] Criando árvore');
      const { data: newTree } = await octokit.git.createTree({
        owner: GITHUB_OWNER,
        repo: REPO_NAME,
        base_tree: currentTreeSha,
        tree: blobs,
      });

      // Criar commit
      console.log('[UPLOAD] Criando commit');
      const { data: newCommit } = await octokit.git.createCommit({
        owner: GITHUB_OWNER,
        repo: REPO_NAME,
        message: `feat: adicionar processo ${processName}\n\n- ${totalFiles} arquivo(s) adicionado(s)`,
        tree: newTree.sha,
        parents: [currentCommitSha],
      });

      // Atualizar referência da branch
      console.log('[UPLOAD] Atualizando branch');
      await octokit.git.updateRef({
        owner: GITHUB_OWNER,
        repo: REPO_NAME,
        ref: `heads/${GITHUB_BRANCH}`,
        sha: newCommit.sha,
      });

      console.log('[UPLOAD] Push concluído');
    } catch (gitError: any) {
      console.error('[UPLOAD] Erro no GitHub:', gitError.message);

      // Salvar localmente mesmo se o GitHub falhar
      console.log('[UPLOAD] Arquivos salvos localmente');
      return NextResponse.json({
        success: true,
        message: 'Processo salvo localmente (erro ao sincronizar com GitHub)',
        processName,
        totalArquivos: totalFiles,
        githubSynced: false,
        githubError: gitError.message,
        folderStructure,
      });
    }

    console.log('[UPLOAD] Upload concluído');
    console.log('[UPLOAD] Total:', totalFiles, 'arquivos');

    return NextResponse.json({
      success: true,
      message: 'Processo inserido e sincronizado com GitHub',
      processName,
      totalArquivos: totalFiles,
      githubSynced: true,
      folderStructure,
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
