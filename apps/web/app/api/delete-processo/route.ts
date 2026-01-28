import { NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_OWNER = process.env.GITHUB_OWNER || '4isaque4';
const GITHUB_REPO = process.env.GITHUB_REPO_PROCESSOS || 'quaddra-processos';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

const octokit = new Octokit({ auth: GITHUB_TOKEN });

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'Slug é obrigatório' }, { status: 400 });
    }

    console.log('[DELETE] Iniciando deleção do processo:', slug);

    // 1. Deletar localmente
    const bpmnDir = join(process.cwd(), '..', 'api', 'storage', 'bpmn');
    
    // Tentar encontrar a pasta do processo
    const { readdirSync, statSync } = await import('fs');
    const folders = readdirSync(bpmnDir);
    
    let deletedLocal = false;
    for (const folder of folders) {
      const folderPath = join(bpmnDir, folder);
      const stat = statSync(folderPath);
      
      if (stat.isDirectory()) {
        // Verificar se algum arquivo BPMN dentro corresponde ao slug
        const files = readdirSync(folderPath);
        for (const file of files) {
          if (file.toLowerCase().endsWith('.bpmn')) {
            const fileSlug = `${folder}/${file}`.toLowerCase().replace(/\.bpmn$/i, '').replace(/\s+/g, '-').replace(/\//g, '-');
            
            if (fileSlug.includes(slug) || slug.includes(folder.toLowerCase().replace(/\s+/g, '-'))) {
              console.log('[DELETE] Deletando pasta local:', folderPath);
              if (existsSync(folderPath)) {
                rmSync(folderPath, { recursive: true, force: true });
                deletedLocal = true;
                console.log('[DELETE] Pasta local deletada com sucesso');
              }
              break;
            }
          }
        }
      }
      
      if (deletedLocal) break;
    }

    if (!deletedLocal) {
      console.warn('[DELETE] Pasta local não encontrada para o slug:', slug);
    }

    // 2. Deletar do GitHub
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

      // Listar conteúdo do repositório
      const { data: repoContents } = await octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: ''
      });

      // Encontrar pasta a deletar
      let folderToDelete = null;
      if (Array.isArray(repoContents)) {
        for (const item of repoContents) {
          if (item.type === 'dir') {
            const folderSlug = item.name.toLowerCase().replace(/\s+/g, '-');
            if (folderSlug.includes(slug) || slug.includes(folderSlug)) {
              folderToDelete = item.name;
              break;
            }
          }
        }
      }

      if (!folderToDelete) {
        console.warn('[DELETE] Pasta não encontrada no GitHub:', slug);
        return NextResponse.json({ 
          success: true, 
          message: 'Processo deletado localmente (não encontrado no GitHub)',
          deletedLocal 
        });
      }

      console.log('[DELETE] Deletando pasta do GitHub:', folderToDelete);

      // Criar nova árvore sem a pasta
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
      console.error('[DELETE] Erro ao deletar do GitHub:', githubError);
      return NextResponse.json({ 
        success: true, 
        message: 'Processo deletado localmente, mas erro ao deletar do GitHub',
        deletedLocal,
        githubError: githubError.message 
      });
    }

  } catch (error: any) {
    console.error('[DELETE] Erro:', error);
    return NextResponse.json({ 
      error: 'Erro ao deletar processo', 
      details: error.message 
    }, { status: 500 });
  }
}
