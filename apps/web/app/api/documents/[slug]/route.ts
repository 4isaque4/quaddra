import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Octokit } from '@octokit/rest';

// GET: Listar documentos de um processo
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const decodedSlug = decodeURIComponent(slug);
    
    // Encontrar a pasta do processo
    const bpmnDir = join(process.cwd(), '..', 'api', 'storage', 'bpmn');
    
    if (!existsSync(bpmnDir)) {
      return NextResponse.json({ error: 'Diretório BPMN não encontrado' }, { status: 404 });
    }

    // Buscar pasta do processo
    const folders = readdirSync(bpmnDir).filter(f => {
      const fullPath = join(bpmnDir, f);
      return statSync(fullPath).isDirectory();
    });

    // Normalizar slug para comparação
    const normalizeStr = (str: string) => str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ç/g, 'c')
      .replace(/Ç/g, 'C')
      .replace(/\s+/g, '-')
      .replace(/\//g, '-')
      .toLowerCase();

    const slugNormalized = normalizeStr(decodedSlug);

    const processFolder = folders.find(folder => {
      const folderNormalized = normalizeStr(folder);
      
      // Comparação direta
      if (folder === decodedSlug) return true;
      if (folderNormalized === slugNormalized) return true;
      
      // Comparação flexível (contém ou começa com)
      if (folderNormalized.includes(slugNormalized)) return true;
      if (slugNormalized.includes(folderNormalized)) return true;
      
      return false;
    });

    // Se não encontrou pasta, pode ser um arquivo na raiz
    let docsDir: string;
    if (!processFolder) {
      console.log(`[Documents API] Arquivo na raiz detectado: ${decodedSlug}`);
      // Usar pasta especial "_root_docs" para documentos de arquivos na raiz
      docsDir = join(bpmnDir, '_root_docs', decodedSlug);
    } else {
      docsDir = join(bpmnDir, processFolder, 'docs');
    }

    if (!existsSync(docsDir)) {
      return NextResponse.json({ documents: [] });
    }

    const files = readdirSync(docsDir).filter(f => {
      const fullPath = join(docsDir, f);
      return statSync(fullPath).isFile();
    });

    const documents = files.map(file => {
      const fullPath = join(docsDir, file);
      const stats = statSync(fullPath);
      return {
        name: file,
        size: stats.size,
        modified: stats.mtime.toISOString(),
        path: `/api/documents/${slug}/download/${encodeURIComponent(file)}`
      };
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Erro ao listar documentos:', error);
    return NextResponse.json({ error: 'Erro ao listar documentos' }, { status: 500 });
  }
}

// POST: Upload de documento
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const decodedSlug = decodeURIComponent(slug);
    
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    // Encontrar a pasta do processo
    const bpmnDir = join(process.cwd(), '..', 'api', 'storage', 'bpmn');
    
    if (!existsSync(bpmnDir)) {
      return NextResponse.json({ error: 'Diretório BPMN não encontrado' }, { status: 404 });
    }

    const folders = readdirSync(bpmnDir).filter(f => {
      const fullPath = join(bpmnDir, f);
      return statSync(fullPath).isDirectory();
    });

    // Normalizar slug para comparação
    const normalizeStr = (str: string) => str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ç/g, 'c')
      .replace(/Ç/g, 'C')
      .replace(/\s+/g, '-')
      .replace(/\//g, '-')
      .toLowerCase();

    const slugNormalized = normalizeStr(decodedSlug);

    const processFolder = folders.find(folder => {
      const folderNormalized = normalizeStr(folder);
      
      // Comparação direta
      if (folder === decodedSlug) return true;
      if (folderNormalized === slugNormalized) return true;
      
      // Comparação flexível (contém ou começa com)
      if (folderNormalized.includes(slugNormalized)) return true;
      if (slugNormalized.includes(folderNormalized)) return true;
      
      return false;
    });

    // Se não encontrou pasta, pode ser um arquivo na raiz
    let docsDir: string;
    let githubPathPrefix: string;
    
    if (!processFolder) {
      console.log(`[Documents API POST] Arquivo na raiz detectado: ${decodedSlug}`);
      // Usar pasta especial "_root_docs" para documentos de arquivos na raiz
      docsDir = join(bpmnDir, '_root_docs', decodedSlug);
      githubPathPrefix = `apps/api/storage/bpmn/_root_docs/${decodedSlug}`;
    } else {
      docsDir = join(bpmnDir, processFolder, 'docs');
      githubPathPrefix = `apps/api/storage/bpmn/${processFolder}/docs`;
    }

    // Criar pasta docs se não existir
    if (!existsSync(docsDir)) {
      mkdirSync(docsDir, { recursive: true });
    }

    // Salvar arquivo localmente
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = join(docsDir, file.name);
    
    writeFileSync(filePath, buffer);

    // Enviar para o GitHub
    let githubSynced = false;
    try {
      const token = process.env.GITHUB_TOKEN;
      const owner = process.env.GITHUB_OWNER || '4isaque4';
      const repo = process.env.GITHUB_REPO || process.env.GITHUB_REPO_PROCESSOS || 'quaddra';

      if (token) {
        const octokit = new Octokit({ auth: token });
        const githubPath = `${githubPathPrefix}/${file.name}`;
        const content = buffer.toString('base64');

        // Verificar se arquivo já existe
        let sha: string | undefined;
        try {
          const { data: existingFile } = await octokit.repos.getContent({
            owner,
            repo,
            path: githubPath,
          });
          if (!Array.isArray(existingFile) && existingFile.sha) {
            sha = existingFile.sha;
          }
        } catch {
          // Arquivo não existe, ok para criar
        }

        await octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: githubPath,
          message: `docs: adicionar documento ${file.name} ao processo ${processFolder || decodedSlug}`,
          content,
          sha,
        });

        githubSynced = true;
      }
    } catch (githubError) {
      console.error('Erro ao sincronizar com GitHub:', githubError);
    }

    return NextResponse.json({ 
      success: true, 
      message: githubSynced 
        ? 'Arquivo enviado e sincronizado com GitHub' 
        : 'Arquivo enviado localmente (GitHub não configurado)',
      file: {
        name: file.name,
        size: file.size
      },
      githubSynced
    });
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    return NextResponse.json({ error: 'Erro ao fazer upload' }, { status: 500 });
  }
}
