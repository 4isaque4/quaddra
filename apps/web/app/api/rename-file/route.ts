import { NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { renameSync, existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, relative } from 'path';

// Configuração GitHub
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || '4isaque4';
const GITHUB_REPO = process.env.GITHUB_REPO_PROCESSOS || 'quaddra-processos';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

const octokit = new Octokit({ auth: GITHUB_TOKEN });

export async function POST(request: Request) {
  try {
    const { oldPath, newName } = await request.json();

    if (!oldPath || !newName) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos' },
        { status: 400 }
      );
    }

    // Validar nome do arquivo
    if (!newName.endsWith('.bpmn')) {
      return NextResponse.json(
        { error: 'O nome do arquivo deve terminar com .bpmn' },
        { status: 400 }
      );
    }

    // Validar caracteres permitidos
    const validNameRegex = /^[a-zA-Z0-9\s\-_.()]+\.bpmn$/;
    if (!validNameRegex.test(newName)) {
      return NextResponse.json(
        { error: 'O nome do arquivo contém caracteres inválidos' },
        { status: 400 }
      );
    }

    console.log('[RENAME] Iniciando renomeação:', oldPath, '->', newName);

    // 1. BUSCAR ARQUIVO DO GITHUB
    let fileContent: string;
    let sha: string;
    
    try {
      const response = await octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: oldPath,
        ref: GITHUB_BRANCH,
      });

      if (!('content' in response.data)) {
        throw new Error('Arquivo não encontrado no GitHub');
      }

      fileContent = Buffer.from(response.data.content, 'base64').toString('utf-8');
      sha = response.data.sha;
      console.log('[RENAME] Arquivo encontrado no GitHub');
    } catch (error: any) {
      console.error('[RENAME] Erro ao buscar arquivo do GitHub:', error);
      return NextResponse.json(
        { error: 'Arquivo original não encontrado no GitHub', details: error.message },
        { status: 404 }
      );
    }

    // 2. CRIAR ARQUIVO COM NOVO NOME NO GITHUB
    const newPath = join(dirname(oldPath), newName).replace(/\\/g, '/');
    
    try {
      await octokit.repos.createOrUpdateFileContents({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: newPath,
        message: `Renomear: ${basename(oldPath)} -> ${newName}`,
        content: Buffer.from(fileContent).toString('base64'),
        branch: GITHUB_BRANCH,
      });
      console.log('[RENAME] Novo arquivo criado no GitHub:', newPath);
    } catch (error: any) {
      console.error('[RENAME] Erro ao criar novo arquivo:', error);
      return NextResponse.json(
        { error: 'Erro ao criar arquivo com novo nome', details: error.message },
        { status: 500 }
      );
    }

    // 3. DELETAR ARQUIVO ANTIGO DO GITHUB
    try {
      await octokit.repos.deleteFile({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: oldPath,
        message: `Remover arquivo antigo: ${basename(oldPath)}`,
        sha: sha,
        branch: GITHUB_BRANCH,
      });
      console.log('[RENAME] Arquivo antigo removido do GitHub');
    } catch (error: any) {
      console.error('[RENAME] Erro ao deletar arquivo antigo:', error);
      // Não retornar erro aqui, pois o novo já foi criado
    }

    // 4. ATUALIZAR LOCALMENTE (se existir)
    const bpmnDir = join(process.cwd(), '..', 'api', 'storage', 'bpmn');
    const oldFilePath = join(bpmnDir, oldPath);
    const newFilePath = join(bpmnDir, newPath);

    if (existsSync(oldFilePath)) {
      try {
        // Criar diretório se não existir
        const newFileDir = dirname(newFilePath);
        if (!existsSync(newFileDir)) {
          mkdirSync(newFileDir, { recursive: true });
        }

        // Renomear arquivo local
        renameSync(oldFilePath, newFilePath);
        console.log('[RENAME] Arquivo local renomeado');

        // Também renomear pasta de documentos se existir
        const oldDocsPath = join(dirname(oldFilePath), 'docs');
        const newDocsPath = join(dirname(newFilePath), 'docs');
        
        if (existsSync(oldDocsPath)) {
          try {
            if (!existsSync(dirname(newDocsPath))) {
              mkdirSync(dirname(newDocsPath), { recursive: true });
            }
            renameSync(oldDocsPath, newDocsPath);
            console.log('[RENAME] Pasta docs renomeada localmente');
          } catch (error) {
            console.warn('[RENAME] Aviso: não foi possível renomear pasta docs:', error);
          }
        }
      } catch (error: any) {
        console.warn('[RENAME] Aviso: erro ao renomear localmente:', error);
        // Não retornar erro, pois o GitHub foi atualizado com sucesso
      }
    } else {
      console.log('[RENAME] Arquivo não existe localmente, apenas no GitHub');
    }

    return NextResponse.json({
      success: true,
      message: 'Arquivo renomeado com sucesso no GitHub e localmente',
      oldPath,
      newPath,
    });
  } catch (error: any) {
    console.error('[RENAME] Erro geral:', error);
    return NextResponse.json(
      { error: 'Erro ao renomear arquivo', details: error.message },
      { status: 500 }
    );
  }
}
