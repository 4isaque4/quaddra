import { NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { rmSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_OWNER = process.env.GITHUB_OWNER || '4isaque4';
const GITHUB_REPO_QUADDRA = process.env.GITHUB_REPO_QUADDRA || 'vale-shope-processos';
const GITHUB_REPO_VALESHOP = process.env.GITHUB_REPO_VALESHOP || 'vale-shope-processos';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Função de normalização igual à usada na página de processos
function normalizeSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .replace(/\s+/g, '-')
    .replace(/\//g, '-')
    .toLowerCase();
}

// Função para buscar todos os arquivos BPMN recursivamente
function getAllBpmnFiles(dir: string, baseDir: string, fileList: Array<{ path: string, folder: string }> = []): Array<{ path: string, folder: string }> {
  const files = readdirSync(dir);
  
  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllBpmnFiles(filePath, baseDir, fileList);
    } else if (file.toLowerCase().endsWith('.bpmn')) {
      const relativePath = relative(baseDir, filePath).replace(/\\/g, '/');
      const folderPath = relative(baseDir, dir).replace(/\\/g, '/') || '.';
      fileList.push({
        path: relativePath,
        folder: folderPath === '.' ? '' : folderPath.split('/')[0] // Pega apenas a primeira pasta
      });
    }
  });
  
  return fileList;
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const clientType = searchParams.get('clientType') || 'quaddra'; // 'valeshop' ou 'quaddra'
    
    // Determinar repositório baseado no cliente
    const GITHUB_REPO = clientType === 'valeshop' ? GITHUB_REPO_VALESHOP : GITHUB_REPO_QUADDRA;

    if (!slug) {
      return NextResponse.json({ error: 'Slug é obrigatório' }, { status: 400 });
    }

    console.log('[DELETE] Iniciando deleção do processo:', slug);

    // 1. Deletar localmente
    const bpmnDir = join(process.cwd(), '..', 'api', 'storage', 'bpmn');
    
    if (!existsSync(bpmnDir)) {
      return NextResponse.json({ error: 'Diretório BPMN não encontrado' }, { status: 404 });
    }

    // Buscar todos os arquivos BPMN recursivamente
    const allFiles = getAllBpmnFiles(bpmnDir, bpmnDir);
    
    // Encontrar o arquivo que corresponde ao slug
    let folderToDelete: string | null = null;
    let filePathFound: string | null = null;
    
    for (const fileInfo of allFiles) {
      const fileSlug = normalizeSlug(fileInfo.path.replace(/\.bpmn$/i, ''));
      
      if (fileSlug === slug) {
        filePathFound = fileInfo.path;
        // Encontrar a pasta que contém este arquivo
        const pathParts = fileInfo.path.split('/');
        if (pathParts.length > 1) {
          folderToDelete = pathParts[0]; // Primeira pasta do caminho
        }
        break;
      }
    }
    
    // Se não encontrou, tentar buscar arquivo na raiz
    if (!folderToDelete && !filePathFound) {
      const rootFiles = readdirSync(bpmnDir).filter(f => {
        const fullPath = join(bpmnDir, f);
        return statSync(fullPath).isFile() && f.toLowerCase().endsWith('.bpmn');
      });
      
      for (const file of rootFiles) {
        const testSlug = normalizeSlug(file.replace(/\.bpmn$/i, ''));
        if (testSlug === slug) {
          filePathFound = file;
          // Arquivo na raiz, não há pasta para deletar
          break;
        }
      }
    }

    let deletedLocal = false;
    if (folderToDelete) {
      const folderPath = join(bpmnDir, folderToDelete);
      if (existsSync(folderPath)) {
        console.log('[DELETE] Deletando pasta local:', folderPath);
        rmSync(folderPath, { recursive: true, force: true });
        deletedLocal = true;
        console.log('[DELETE] Pasta local deletada com sucesso:', folderToDelete);
      }
    } else if (filePathFound) {
      // Arquivo na raiz encontrado
      const filePath = join(bpmnDir, filePathFound);
      if (existsSync(filePath)) {
        console.log('[DELETE] Deletando arquivo na raiz:', filePath);
        rmSync(filePath, { force: true });
        deletedLocal = true;
        console.log('[DELETE] Arquivo na raiz deletado:', filePathFound);
      }
    } else {
      console.warn('[DELETE] Arquivo não encontrado localmente para o slug:', slug);
    }

    // 2. Deletar do GitHub
    if (!GITHUB_TOKEN) {
      console.warn('[DELETE] ⚠️ GitHub token não configurado - deletando apenas localmente');
      return NextResponse.json({ 
        success: true, 
        message: 'Processo deletado localmente (GitHub token não configurado)',
        deletedLocal,
        deletedGitHub: false,
        githubError: 'Token não configurado'
      });
    }

    try {
      console.log('[DELETE] Iniciando deleção no GitHub...');
      console.log('[DELETE] Repositório:', GITHUB_REPO);
      console.log('[DELETE] Pasta encontrada localmente:', folderToDelete);
      console.log('[DELETE] Arquivo encontrado localmente:', filePathFound);
      
      // Variável para arquivo a deletar no GitHub
      let githubFileToDelete: string | null = null;
      
      // Se encontramos localmente, usar essa informação
      if (filePathFound && !folderToDelete) {
        // Arquivo na raiz encontrado localmente
        githubFileToDelete = filePathFound;
      } else if (!folderToDelete && !filePathFound) {
        // Não encontramos localmente, buscar no GitHub usando o slug completo
        console.log('[DELETE] Buscando processo no GitHub pelo slug:', slug);
        
        // Obter referência do branch
        const { data: refData } = await octokit.git.getRef({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          ref: `heads/${GITHUB_BRANCH}`
        });

        const latestCommitSha = refData.object.sha;

        // Obter árvore do commit recursivamente
        const { data: currentTree } = await octokit.git.getTree({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          tree_sha: latestCommitSha,
          recursive: 'true'
        });

        // Procurar arquivo BPMN que corresponde ao slug completo (caminho completo normalizado)
        for (const item of currentTree.tree || []) {
          if (item.type === 'blob' && item.path?.toLowerCase().endsWith('.bpmn')) {
            // Normalizar o caminho completo do arquivo (sem extensão) para comparar com o slug
            const filePathWithoutExt = item.path.replace(/\.bpmn$/i, '');
            const fileSlug = normalizeSlug(filePathWithoutExt);
            
            if (fileSlug === slug) {
              // Encontrar a pasta que contém este arquivo
              const pathParts = item.path.split('/');
              if (pathParts.length > 1) {
                folderToDelete = pathParts[0]; // Primeira pasta do caminho
                console.log('[DELETE] Pasta encontrada no GitHub:', folderToDelete, '(arquivo:', item.path, ')');
              } else {
                githubFileToDelete = item.path;
                console.log('[DELETE] Arquivo encontrado no GitHub (raiz):', githubFileToDelete);
              }
              break;
            }
          }
        }
        
        // Se ainda não encontrou, tentar buscar pela pasta diretamente (slug pode ser só o nome da pasta)
        if (!folderToDelete && !githubFileToDelete) {
          // Listar pastas na raiz do repositório
          const { data: contents } = await octokit.repos.getContent({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            path: '',
            ref: GITHUB_BRANCH
          });

          if (Array.isArray(contents)) {
            for (const item of contents) {
              if (item.type === 'dir' && !item.name.startsWith('.')) {
                const folderSlug = normalizeSlug(item.name);
                if (folderSlug === slug) {
                  folderToDelete = item.name;
                  console.log('[DELETE] Pasta encontrada no GitHub pelo nome:', folderToDelete);
                  break;
                }
              }
            }
          }
        }
      }

      // Se é arquivo na raiz, deletar apenas o arquivo
      if (githubFileToDelete && !folderToDelete) {
        console.log('[DELETE] Deletando arquivo do GitHub:', githubFileToDelete);
        
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

        // Filtrar arquivo específico
        const newTree = currentTree.tree
          .filter(item => item.path !== githubFileToDelete)
          .map(item => ({
            path: item.path!,
            mode: item.mode as '100644' | '100755' | '040000' | '160000' | '120000',
            type: item.type as 'blob' | 'tree' | 'commit',
            sha: item.sha!
          }));

        // Criar nova árvore
        const { data: newTreeData } = await octokit.git.createTree({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          tree: newTree,
          base_tree: baseTreeSha
        });

        // Criar commit
        const { data: newCommit } = await octokit.git.createCommit({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          message: `chore: deletar processo ${githubFileToDelete}`,
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

        console.log('[DELETE] Arquivo deletado do GitHub com sucesso');

        return NextResponse.json({ 
          success: true, 
          message: 'Processo deletado com sucesso',
          deletedLocal,
          deletedGitHub: true,
          file: githubFileToDelete
        });
      }

      // Verificar se encontramos algo para deletar no GitHub
      if (!folderToDelete && !githubFileToDelete) {
        console.warn('[DELETE] Processo não encontrado no GitHub para o slug:', slug);
        return NextResponse.json({ 
          success: true, 
          message: 'Processo deletado localmente (não encontrado no GitHub)',
          deletedLocal,
          deletedGitHub: false
        });
      }

      console.log('[DELETE] Deletando pasta do GitHub:', folderToDelete);

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

      // Filtrar arquivos que não estão na pasta a deletar
      const newTree = currentTree.tree
        .filter(item => !item.path?.startsWith(folderToDelete + '/'))
        .map(item => ({
          path: item.path!,
          mode: item.mode as '100644' | '100755' | '040000' | '160000' | '120000',
          type: item.type as 'blob' | 'tree' | 'commit',
          sha: item.sha!
        }));

      // Criar nova árvore
      const { data: newTreeData } = await octokit.git.createTree({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        tree: newTree,
        base_tree: baseTreeSha
      });

      // Criar commit
      const { data: newCommit } = await octokit.git.createCommit({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        message: `chore: deletar processo ${folderToDelete}`,
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

      console.log('[DELETE] Processo deletado do GitHub com sucesso');

      return NextResponse.json({ 
        success: true, 
        message: 'Processo deletado com sucesso',
        deletedLocal,
        deletedGitHub: true,
        folder: folderToDelete
      });

    } catch (githubError: any) {
      console.error('[DELETE] ❌ Erro ao deletar do GitHub:', githubError.message);
      console.error('[DELETE] Erro completo:', JSON.stringify(githubError, null, 2));
      console.error('[DELETE] Status:', githubError.status);
      console.error('[DELETE] Response:', githubError.response?.data);
      
      // Retornar erro para que o frontend saiba que falhou
      return NextResponse.json({ 
        success: false,
        error: 'Erro ao deletar processo do GitHub',
        message: `Processo deletado localmente, mas falhou ao deletar do GitHub: ${githubError.message}`,
        deletedLocal,
        deletedGitHub: false,
        githubError: githubError.message,
        githubErrorDetails: githubError.response?.data || githubError
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[DELETE] Erro:', error);
    return NextResponse.json({ 
      error: 'Erro ao deletar processo', 
      details: error.message 
    }, { status: 500 });
  }
}
