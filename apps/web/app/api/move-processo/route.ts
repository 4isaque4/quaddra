import { NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_OWNER = process.env.GITHUB_OWNER || '4isaque4';
const GITHUB_REPO_QUADDRA = process.env.GITHUB_REPO_QUADDRA || 'vale-shope-processos';
const GITHUB_REPO_VALESHOP = process.env.GITHUB_REPO_VALESHOP || 'vale-shope-processos';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Função para normalizar slug
function normalizeSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .replace(/\s+/g, '-')
    .replace(/\//g, '-')
    .toLowerCase();
}

// Função para buscar todos os arquivos BPMN recursivamente
function getAllBpmnFiles(dir: string, baseDir: string, fileList: Array<{ path: string, fullPath: string }> = []): Array<{ path: string, fullPath: string }> {
  const files = readdirSync(dir);
  
  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllBpmnFiles(filePath, baseDir, fileList);
    } else if (file.toLowerCase().endsWith('.bpmn')) {
      const relativePath = relative(baseDir, filePath).replace(/\\/g, '/');
      fileList.push({
        path: relativePath,
        fullPath: filePath
      });
    }
  });
  
  return fileList;
}

// Função para copiar diretório recursivamente
function copyDirectory(src: string, dest: string) {
  if (!existsSync(src)) return;
  
  mkdirSync(dest, { recursive: true });
  
  const entries = readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      const content = readFileSync(srcPath);
      writeFileSync(destPath, content);
    }
  }
}

export async function POST(request: Request) {
  try {
    const { processSlug, targetFolderPath, clientType = 'quaddra' } = await request.json();

    if (!processSlug) {
      return NextResponse.json({ error: 'Slug do processo é obrigatório' }, { status: 400 });
    }

    // Determinar repositório baseado no cliente
    const GITHUB_REPO = clientType === 'valeshop' ? GITHUB_REPO_VALESHOP : GITHUB_REPO_QUADDRA;

    console.log('[MOVE] Movendo processo:', processSlug, 'para:', targetFolderPath || 'raiz', '- Repositório:', GITHUB_REPO);

    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: 'GITHUB_TOKEN não configurado' }, { status: 500 });
    }

    // Buscar processo no GitHub primeiro
    let processPathInGitHub: string | null = null;
    let processFolderName: string | null = null;
    
    try {
      // Obter árvore completa do GitHub
      const { data: refData } = await octokit.git.getRef({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        ref: `heads/${GITHUB_BRANCH}`
      });

      const latestCommitSha = refData.object.sha;

      const { data: commitData } = await octokit.git.getCommit({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        commit_sha: latestCommitSha
      });

      const baseTreeSha = commitData.tree.sha;

      const { data: currentTree } = await octokit.git.getTree({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        tree_sha: baseTreeSha,
        recursive: 'true'
      });

      // Encontrar o processo pelo slug no GitHub
      for (const item of currentTree.tree || []) {
        if (item.type === 'blob' && item.path && item.path.toLowerCase().endsWith('.bpmn')) {
          const fileSlug = normalizeSlug(item.path.replace(/\.bpmn$/i, ''));
          
          if (fileSlug === processSlug) {
            processPathInGitHub = item.path;
            const pathParts = item.path.split('/');
            if (pathParts.length > 1) {
              processFolderName = pathParts[0];
            }
            break;
          }
        }
      }

      if (!processPathInGitHub) {
        return NextResponse.json({ error: 'Processo não encontrado no GitHub' }, { status: 404 });
      }

      console.log('[MOVE] Processo encontrado no GitHub:', processPathInGitHub);
    } catch (error: any) {
      console.error('[MOVE] Erro ao buscar processo no GitHub:', error);
      return NextResponse.json({ error: 'Erro ao buscar processo no GitHub', details: error.message }, { status: 500 });
    }

    // Trabalhar diretamente com GitHub
    try {
      // Obter referência do branch
      const { data: refData } = await octokit.git.getRef({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        ref: `heads/${GITHUB_BRANCH}`
      });

      const latestCommitSha = refData.object.sha;

      // Obter árvore do commit
      const { data: commitData } = await octokit.git.getCommit({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        commit_sha: latestCommitSha
      });

      const baseTreeSha = commitData.tree.sha;

      // Obter árvore completa recursivamente
      const { data: currentTree } = await octokit.git.getTree({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        tree_sha: baseTreeSha,
        recursive: 'true'
      });

      // Determinar novo caminho
      const fileName = processPathInGitHub.split('/').pop() || '';
      const newPath = targetFolderPath 
        ? `${targetFolderPath}/${fileName}`
        : fileName;

      // Verificar se já está no destino
      if (processPathInGitHub === newPath) {
        return NextResponse.json({ 
          success: true, 
          message: 'Processo já está na localização desejada' 
        });
      }

      // Encontrar todos os arquivos relacionados ao processo

      const filesToMove: Array<{ oldPath: string, newPath: string, content: string, sha: string }> = [];
      const filesToDelete: string[] = [];

      // Se o processo está em uma pasta, mover todos os arquivos da pasta (incluindo subpastas)
      if (processFolderName) {
        // Buscar todos os arquivos dentro da pasta do processo (incluindo subpastas recursivamente)
        for (const item of currentTree.tree || []) {
          // Verificar se o arquivo está dentro da pasta do processo (pode estar em subpastas)
          if (item.type === 'blob' && item.path && item.path.startsWith(processFolderName + '/')) {
            const relativePath = item.path.substring(processFolderName.length + 1);
            
            // Determinar novo caminho baseado no destino
            let newItemPath: string;
            if (targetFolderPath) {
              // Mover para pasta específica: targetFolderPath/processFolderName/relativePath
              newItemPath = `${targetFolderPath}/${processFolderName}/${relativePath}`;
            } else {
              // Mover para raiz: processFolderName/relativePath
              newItemPath = `${processFolderName}/${relativePath}`;
            }

            // Buscar conteúdo do arquivo
            try {
              const { data: fileData } = await octokit.repos.getContent({
                owner: GITHUB_OWNER,
                repo: GITHUB_REPO,
                path: item.path,
                ref: GITHUB_BRANCH
              });

              if ('content' in fileData && fileData.content) {
                const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
                filesToMove.push({
                  oldPath: item.path,
                  newPath: newItemPath,
                  content,
                  sha: item.sha!
                });
                // Adicionar à lista de arquivos para deletar
                filesToDelete.push(item.path);
                console.log('[MOVE] Arquivo marcado para mover:', item.path, '->', newItemPath);
              }
            } catch (error: any) {
              console.warn('[MOVE] Erro ao buscar arquivo do GitHub:', item.path, error.message);
            }
          }
        }
        
        // Também marcar todas as subpastas (trees) para remoção se necessário
        // Nota: GitHub remove trees automaticamente quando não há mais arquivos nelas
        console.log('[MOVE] Total de arquivos a mover:', filesToMove.length);
        console.log('[MOVE] Total de arquivos a deletar:', filesToDelete.length);
      } else {
        // Arquivo na raiz - mover apenas o arquivo
        const item = currentTree.tree.find(i => i.path === processPathInGitHub);
        if (item && item.type === 'blob') {
          try {
            const { data: fileData } = await octokit.repos.getContent({
              owner: GITHUB_OWNER,
              repo: GITHUB_REPO,
              path: processPathInGitHub,
              ref: GITHUB_BRANCH
            });

            if ('content' in fileData && fileData.content) {
              const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
              filesToMove.push({
                oldPath: processPathInGitHub,
                newPath,
                content,
                sha: item.sha!
              });
              filesToDelete.push(processPathInGitHub);
            }
          } catch (error: any) {
            console.error('[MOVE] Erro ao buscar arquivo do GitHub:', processPathInGitHub, error.message);
            throw error;
          }
        }
      }

      // Criar novos arquivos no GitHub
      const newTreeItems: Array<{ path: string; mode: '100644'; type: 'blob'; content: string }> = [];
      
      for (const fileInfo of filesToMove) {
        newTreeItems.push({
          path: fileInfo.newPath,
          mode: '100644',
          type: 'blob',
          content: fileInfo.content
        });
      }

      // Criar blobs para os novos arquivos
      const newBlobs = await Promise.all(
        newTreeItems.map(async (item) => {
          const { data: blob } = await octokit.git.createBlob({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            content: item.content,
            encoding: 'utf-8'
          });
          return {
            path: item.path,
            mode: item.mode,
            type: item.type,
            sha: blob.sha
          };
        })
      );

      // Filtrar arquivos antigos (garantir que todos os arquivos da pasta antiga sejam removidos)
      const updatedTree = currentTree.tree
        .filter(item => {
          // Remover arquivos que estão na lista de deletar
          if (item.type === 'blob' && item.path && filesToDelete.includes(item.path)) {
            console.log('[MOVE] Removendo arquivo antigo da árvore:', item.path);
            return false;
          }
          // Remover trees (pastas) que estão vazias após mover arquivos
          if (item.type === 'tree' && processFolderName && item.path && item.path.startsWith(processFolderName + '/')) {
            // Verificar se ainda há arquivos nesta pasta
            const hasFilesInFolder = currentTree.tree.some(
              otherItem => otherItem.type === 'blob' && 
                          otherItem.path && 
                          otherItem.path.startsWith(item.path + '/') &&
                          !filesToDelete.includes(otherItem.path)
            );
            if (!hasFilesInFolder) {
              console.log('[MOVE] Removendo pasta vazia da árvore:', item.path);
              return false;
            }
          }
          return true;
        })
        .map(item => ({
          path: item.path!,
          mode: item.mode as '100644' | '100755' | '040000' | '160000' | '120000',
          type: item.type as 'blob' | 'tree' | 'commit',
          sha: item.sha!
        }));

      // Adicionar novos arquivos
      updatedTree.push(...newBlobs);
      
      console.log('[MOVE] Árvore atualizada:', updatedTree.length, 'itens (removidos', filesToDelete.length, 'arquivos antigos)');

      // Criar nova árvore
      const { data: newTreeData } = await octokit.git.createTree({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        tree: updatedTree,
        base_tree: baseTreeSha
      });

      // Criar commit
      const { data: newCommit } = await octokit.git.createCommit({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        message: `chore: mover processo ${processSlug} para ${targetFolderPath || 'raiz'}`,
        tree: newTreeData.sha,
        parents: [latestCommitSha]
      });

      // Atualizar referência
      await octokit.git.updateRef({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        ref: `heads/${GITHUB_BRANCH}`,
        sha: newCommit.sha
      });

      console.log('[MOVE] Processo movido no GitHub com sucesso');
      
      // Sincronizar localmente após mover no GitHub (opcional)
      const bpmnDir = join(process.cwd(), '..', 'api', 'storage', 'bpmn');
      if (existsSync(bpmnDir)) {
        try {
          // Baixar arquivos movidos para manter sincronização local
          for (const fileInfo of filesToMove) {
            const localPath = join(bpmnDir, fileInfo.newPath);
            const localDir = dirname(localPath);
            
            if (!existsSync(localDir)) {
              mkdirSync(localDir, { recursive: true });
            }
            
            writeFileSync(localPath, fileInfo.content);
            
            // Deletar arquivo antigo se existir localmente
            const oldLocalPath = join(bpmnDir, fileInfo.oldPath);
            if (existsSync(oldLocalPath)) {
              rmSync(oldLocalPath, { force: true });
            }
          }
          
          // Deletar pasta antiga se estiver vazia
          if (processFolderName) {
            const oldFolderPath = join(bpmnDir, processFolderName);
            if (existsSync(oldFolderPath)) {
              try {
                const contents = readdirSync(oldFolderPath);
                if (contents.length === 0) {
                  rmSync(oldFolderPath, { recursive: true, force: true });
                }
              } catch (e) {
                // Ignorar erros ao verificar pasta
              }
            }
          }
        } catch (localError: any) {
          console.warn('[MOVE] Aviso: Erro ao sincronizar localmente:', localError.message);
          // Não falhar a operação se erro local
        }
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Processo movido com sucesso',
        newPath: targetFolderPath || 'raiz'
      });
    } catch (githubError: any) {
      console.error('[MOVE] Erro ao mover no GitHub:', githubError);
      return NextResponse.json({ 
        error: 'Erro ao mover processo no GitHub', 
        details: githubError.message 
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[MOVE] Erro:', error);
    console.error('[MOVE] Stack:', error.stack);
    return NextResponse.json({ 
      error: 'Erro ao mover processo', 
      details: error.message || 'Erro desconhecido'
    }, { status: 500 });
  }
}
