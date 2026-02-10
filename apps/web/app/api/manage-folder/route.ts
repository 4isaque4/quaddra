import { NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { existsSync, mkdirSync, rmSync, renameSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_OWNER = process.env.GITHUB_OWNER || '4isaque4';
const GITHUB_REPO = process.env.GITHUB_REPO_PROCESSOS || process.env.GITHUB_REPO_QUADDRA || 'vale-shope-processos';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

const octokit = new Octokit({ auth: GITHUB_TOKEN });

export async function POST(request: Request) {
  try {
    const { action, folderPath, newName, parentPath } = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'Ação é obrigatória' }, { status: 400 });
    }

    // Para criar pasta, folderPath pode ser vazio ou null
    if (action !== 'create' && !folderPath) {
      return NextResponse.json({ error: 'Caminho da pasta é obrigatório para esta ação' }, { status: 400 });
    }

    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: 'GITHUB_TOKEN não configurado' }, { status: 500 });
    }

    const bpmnDir = join(process.cwd(), '..', 'api', 'storage', 'bpmn');
    const fullFolderPath = folderPath ? join(bpmnDir, folderPath) : null;

    switch (action) {
      case 'create': {
        if (!newName) {
          return NextResponse.json({ error: 'Nome da pasta é obrigatório para criar' }, { status: 400 });
        }

        const newFolderPath = parentPath ? `${parentPath}/${newName}` : newName;

        // Verificar se já existe no GitHub
        try {
          const { data: refData } = await octokit.git.getRef({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            ref: `heads/${GITHUB_BRANCH}`
          });

          const { data: currentTree } = await octokit.git.getTree({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            tree_sha: refData.object.sha,
            recursive: 'true'
          });

          const folderExists = currentTree.tree.some(item => 
            item.path && (item.path === newFolderPath || item.path.startsWith(newFolderPath + '/'))
          );

          if (folderExists) {
            return NextResponse.json({ error: 'Pasta já existe' }, { status: 400 });
          }
        } catch (error: any) {
          console.warn('[FOLDER] Erro ao verificar pasta no GitHub:', error.message);
        }

        // Criar localmente se o diretório existir
        if (existsSync(bpmnDir)) {
          const localParentDir = parentPath ? join(bpmnDir, parentPath) : bpmnDir;
          const localNewFolderPath = join(localParentDir, newName);
          
          if (!existsSync(localNewFolderPath)) {
            mkdirSync(localNewFolderPath, { recursive: true });
            console.log('[FOLDER] Pasta criada localmente:', localNewFolderPath);
          }
        }

        // No GitHub, pastas são criadas automaticamente quando arquivos são adicionados
        return NextResponse.json({ 
          success: true, 
          message: 'Pasta criada com sucesso',
          path: newFolderPath
        });
      }

      case 'rename': {
        if (!newName) {
          return NextResponse.json({ error: 'Novo nome da pasta é obrigatório' }, { status: 400 });
        }

        // Buscar pasta no GitHub primeiro
        let folderExistsInGitHub = false;
        try {
          const { data: refData } = await octokit.git.getRef({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            ref: `heads/${GITHUB_BRANCH}`
          });

          const { data: currentTree } = await octokit.git.getTree({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            tree_sha: refData.object.sha,
            recursive: 'true'
          });

          folderExistsInGitHub = currentTree.tree.some(item => 
            item.path && item.path.startsWith(folderPath + '/')
          );

          if (!folderExistsInGitHub) {
            return NextResponse.json({ error: 'Pasta não encontrada no GitHub' }, { status: 404 });
          }

          // Verificar se novo nome já existe
          const parentPath = folderPath.includes('/') 
            ? folderPath.substring(0, folderPath.lastIndexOf('/'))
            : '';
          const newFolderPath = parentPath ? `${parentPath}/${newName}` : newName;
          
          const newFolderExists = currentTree.tree.some(item => 
            item.path && (item.path === newFolderPath || item.path.startsWith(newFolderPath + '/'))
          );

          if (newFolderExists) {
            return NextResponse.json({ error: 'Já existe uma pasta com este nome' }, { status: 400 });
          }
        } catch (error: any) {
          console.error('[FOLDER] Erro ao verificar pasta no GitHub:', error);
          return NextResponse.json({ error: 'Erro ao verificar pasta no GitHub', details: error.message }, { status: 500 });
        }

        // Renomear localmente se existir
        if (fullFolderPath && existsSync(fullFolderPath)) {
          const parentDir = join(fullFolderPath, '..');
          const localNewFolderPath = join(parentDir, newName);
          
          if (!existsSync(localNewFolderPath)) {
            renameSync(fullFolderPath, localNewFolderPath);
            console.log('[FOLDER] Pasta renomeada localmente de', fullFolderPath, 'para', localNewFolderPath);
          }
        }

        // Sincronizar com GitHub
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

          // Encontrar todos os arquivos na pasta antiga
          const filesToMove: Array<{ oldPath: string, newPath: string, content: string, sha: string }> = [];

          for (const item of currentTree.tree || []) {
            if (item.type === 'blob' && item.path && item.path.startsWith(folderPath + '/')) {
              const relativePath = item.path.substring(folderPath.length + 1);
              const newPath = folderPath.includes('/') 
                ? `${folderPath.substring(0, folderPath.lastIndexOf('/'))}/${newName}/${relativePath}`
                : `${newName}/${relativePath}`;

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
                    newPath,
                    content,
                    sha: item.sha!
                  });
                }
              } catch (error) {
                console.warn('[FOLDER] Erro ao buscar arquivo do GitHub:', item.path);
              }
            }
          }

          // Criar novos arquivos e remover antigos
          const newBlobs = await Promise.all(
            filesToMove.map(async (fileInfo) => {
              const { data: blob } = await octokit.git.createBlob({
                owner: GITHUB_OWNER,
                repo: GITHUB_REPO,
                content: fileInfo.content,
                encoding: 'utf-8'
              });
              return {
                path: fileInfo.newPath,
                mode: '100644' as const,
                type: 'blob' as const,
                sha: blob.sha
              };
            })
          );

          const updatedTree = currentTree.tree
            .filter(item => !item.path?.startsWith(folderPath + '/'))
            .map(item => ({
              path: item.path!,
              mode: item.mode as '100644' | '100755' | '040000' | '160000' | '120000',
              type: item.type as 'blob' | 'tree' | 'commit',
              sha: item.sha!
            }));

          updatedTree.push(...newBlobs);

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
            message: `chore: renomear pasta ${folderPath} para ${newName}`,
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

          console.log('[FOLDER] Pasta renomeada no GitHub com sucesso');
        } catch (githubError: any) {
          console.error('[FOLDER] Erro ao renomear no GitHub:', githubError);
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Pasta renomeada com sucesso',
          newPath: folderPath.includes('/') 
            ? `${folderPath.substring(0, folderPath.lastIndexOf('/'))}/${newName}`
            : newName
        });
      }

      case 'delete': {
        // Verificar no GitHub se a pasta está vazia
        try {
          const { data: refData } = await octokit.git.getRef({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            ref: `heads/${GITHUB_BRANCH}`
          });

          const { data: currentTree } = await octokit.git.getTree({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            tree_sha: refData.object.sha,
            recursive: 'true'
          });

          const folderFiles = currentTree.tree.filter(item => 
            item.path && item.path.startsWith(folderPath + '/')
          );

          if (folderFiles.length > 0) {
            return NextResponse.json({ 
              error: 'Pasta não está vazia. Remova os processos antes de deletar a pasta.' 
            }, { status: 400 });
          }
        } catch (error: any) {
          console.error('[FOLDER] Erro ao verificar pasta no GitHub:', error);
          return NextResponse.json({ 
            error: 'Erro ao verificar pasta no GitHub', 
            details: error.message 
          }, { status: 500 });
        }

        // Deletar localmente se existir
        if (fullFolderPath && existsSync(fullFolderPath)) {
          try {
            const contents = readdirSync(fullFolderPath);
            if (contents.length === 0) {
              rmSync(fullFolderPath, { recursive: true, force: true });
              console.log('[FOLDER] Pasta deletada localmente:', fullFolderPath);
            }
          } catch (e) {
            // Ignorar erros locais
          }
        }

        // No GitHub, pastas vazias não precisam ser deletadas explicitamente
        return NextResponse.json({ 
          success: true, 
          message: 'Pasta deletada com sucesso'
        });
      }

      default:
        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('[FOLDER] Erro:', error);
    return NextResponse.json({ 
      error: 'Erro ao gerenciar pasta', 
      details: error.message 
    }, { status: 500 });
  }
}
