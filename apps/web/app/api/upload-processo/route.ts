import { NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { parseBizagiBpmn, convertToContentFormat, extractPerformers } from '@/../../apps/api/lib/bizagi-parser';
import { convertBpmToBpmn, validateBpmnXml } from '@/../../apps/api/lib/bpm-converter';

// Configuração do GitHub
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_OWNER = process.env.GITHUB_OWNER || '4isaque4';
const GITHUB_REPO_QUADDRA = process.env.GITHUB_REPO_QUADDRA || 'vale-shope-processos';
const GITHUB_REPO_VALESHOP = process.env.GITHUB_REPO_VALESHOP || 'vale-shope-processos';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

// Tipo para estrutura de pastas
interface FolderConfig {
  name: string;
  fileCount: number;
}

// Configuração para aumentar limite de tamanho do body (10MB)
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 segundos

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
    // bpmnXml removido - não é necessário enviar, o arquivo já está no FormData
    const folderStructureJson = formData.get('folderStructure') as string | null;
    const clientType = formData.get('clientType') as string | null; // 'valeshop' ou 'quaddra'

    // Determinar repositório baseado no cliente
    const REPO_NAME = clientType === 'valeshop' ? GITHUB_REPO_VALESHOP : GITHUB_REPO_QUADDRA;
    
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

    // Processar pastas personalizadas (agora suporta hierarquia completa + arquivos na raiz)
    for (let i = 0; i < folderStructure.length; i++) {
      const folder = folderStructure[i];
      const folderPath = folder.name; // Caminho completo da pasta (ex: "PastaRaiz/Subpasta1") ou "root" para raiz
      const isRootFiles = folderPath === 'root'; // Arquivos diretamente na raiz
      const isRootFolder = !isRootFiles && !folderPath.includes('/'); // Pasta raiz não tem "/"
      const folderFiles = formData.getAll(`folder_${folderPath}`) as File[];

      if (folderFiles.length === 0) {
        console.log('[UPLOAD] Pasta sem arquivos:', folderPath);
        continue;
      }

      console.log(`[UPLOAD] Processando pasta ${i + 1}:`, folderPath, '(', folderFiles.length, 'arquivos)', isRootFiles ? '(ARQUIVOS NA RAIZ)' : isRootFolder ? '(PASTA RAIZ)' : '');

      // Determinar diretório de destino
      let folderDir: string;
      if (isRootFiles) {
        // Arquivos diretamente na raiz do processo
        folderDir = bpmnDir;
      } else if (isRootFolder) {
        // Primeira pasta principal
        folderDir = join(bpmnDir, folderPath);
      } else {
        // Subpastas
        folderDir = join(bpmnDir, folderPath);
      }

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

        // Adicionar ao GitHub
        let githubPath: string;
        if (isRootFiles) {
          // Arquivos na raiz: processName/arquivo.ext
          githubPath = `${processName}/${file.name}`;
        } else if (isRootFolder) {
          // Primeira pasta: processName/PastaRaiz/arquivo.ext
          githubPath = `${processName}/${folderPath}/${file.name}`;
        } else {
          // Subpastas: processName/PastaRaiz/Subpasta/arquivo.ext
          githubPath = `${processName}/${folderPath}/${file.name}`;
        }

        githubFiles.push({
          path: githubPath,
          content: content.toString('base64'),
        });

        const displayPath = isRootFiles ? file.name : `${folderPath}/${file.name}`;
        console.log('[UPLOAD] Arquivo salvo:', displayPath);
      }
    }

    // 4. Fazer commit e push no GitHub
    console.log('[UPLOAD] Enviando para GitHub');
    console.log('[UPLOAD] Token configurado:', GITHUB_TOKEN ? 'SIM' : 'NÃO');
    console.log('[UPLOAD] Repositório:', REPO_NAME);
    console.log('[UPLOAD] Owner:', GITHUB_OWNER);
    console.log('[UPLOAD] Branch:', GITHUB_BRANCH);
    console.log('[UPLOAD] Arquivos para enviar:', githubFiles.length);

    try {
      // Verificar se o token está configurado
      if (!GITHUB_TOKEN) {
        console.warn('[UPLOAD] ⚠️ GitHub token não configurado');
        return NextResponse.json({
          success: false,
          message: 'Processo salvo localmente, mas GitHub token não está configurado. Configure GITHUB_TOKEN no .env.local',
          processName,
          totalArquivos: totalFiles,
          githubSynced: false,
          githubError: 'Token não configurado',
          folderStructure,
        });
      }

      // Obter SHA da branch principal
      console.log('[UPLOAD] Obtendo referência da branch...');
      const { data: ref } = await octokit.git.getRef({
        owner: GITHUB_OWNER,
        repo: REPO_NAME,
        ref: `heads/${GITHUB_BRANCH}`,
      });

      const currentCommitSha = ref.object.sha;
      console.log('[UPLOAD] ✅ Referência obtida:', currentCommitSha.substring(0, 7));

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
        githubFiles.map(async (file, index) => {
          try {
            console.log(`[UPLOAD] Criando blob ${index + 1}/${githubFiles.length}: ${file.path}`);
            const { data: blob } = await octokit.git.createBlob({
              owner: GITHUB_OWNER,
              repo: REPO_NAME,
              content: file.content,
              encoding: 'base64',
            });
            console.log(`[UPLOAD] ✅ Blob criado: ${file.path} (${blob.sha.substring(0, 7)})`);
            return {
              path: file.path,
              mode: '100644' as const,
              type: 'blob' as const,
              sha: blob.sha,
            };
          } catch (blobError: any) {
            console.error(`[UPLOAD] ❌ Erro ao criar blob ${file.path}:`, blobError.message);
            throw new Error(`Erro ao criar blob para ${file.path}: ${blobError.message}`);
          }
        })
      );
      console.log('[UPLOAD] ✅ Todos os blobs criados:', blobs.length);

      // Criar nova árvore
      console.log('[UPLOAD] Criando árvore com', blobs.length, 'arquivos...');
      const { data: newTree } = await octokit.git.createTree({
        owner: GITHUB_OWNER,
        repo: REPO_NAME,
        base_tree: currentTreeSha,
        tree: blobs,
      });
      console.log('[UPLOAD] ✅ Árvore criada:', newTree.sha.substring(0, 7));

      // Criar commit
      console.log('[UPLOAD] Criando commit...');
      const commitMessage = `feat: adicionar processo ${processName}\n\n- ${totalFiles} arquivo(s) adicionado(s)`;
      const { data: newCommit } = await octokit.git.createCommit({
        owner: GITHUB_OWNER,
        repo: REPO_NAME,
        message: commitMessage,
        tree: newTree.sha,
        parents: [currentCommitSha],
      });
      console.log('[UPLOAD] ✅ Commit criado:', newCommit.sha.substring(0, 7));

      // Atualizar referência da branch
      console.log('[UPLOAD] Atualizando branch', GITHUB_BRANCH, '...');
      await octokit.git.updateRef({
        owner: GITHUB_OWNER,
        repo: REPO_NAME,
        ref: `heads/${GITHUB_BRANCH}`,
        sha: newCommit.sha,
      });

      console.log('[UPLOAD] ✅ Push concluído com sucesso!');
    } catch (gitError: any) {
      console.error('[UPLOAD] ❌ Erro no GitHub:', gitError.message);
      console.error('[UPLOAD] Erro completo:', JSON.stringify(gitError, null, 2));
      console.error('[UPLOAD] Status:', gitError.status);
      console.error('[UPLOAD] Response:', gitError.response?.data);

      // Salvar localmente mesmo se o GitHub falhar
      console.log('[UPLOAD] Arquivos salvos localmente');
      return NextResponse.json({
        success: true,
        message: `Processo salvo localmente, mas falhou ao enviar para GitHub: ${gitError.message}`,
        processName,
        totalArquivos: totalFiles,
        githubSynced: false,
        githubError: gitError.message,
        githubErrorDetails: gitError.response?.data || gitError,
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
