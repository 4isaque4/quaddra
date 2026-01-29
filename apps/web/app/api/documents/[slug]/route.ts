import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readdirSync, statSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join, relative } from 'path';
import { Octokit } from '@octokit/rest';

// Função auxiliar para buscar arquivos recursivamente
function findFilesRecursive(dir: string, baseDir: string): Array<{name: string, fullPath: string, relativePath: string}> {
  const results: Array<{name: string, fullPath: string, relativePath: string}> = [];
  
  if (!existsSync(dir)) return results;
  
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Buscar recursivamente em subpastas
      results.push(...findFilesRecursive(fullPath, baseDir));
    } else if (stat.isFile()) {
      const relativePath = relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push({
        name: item,
        fullPath,
        relativePath
      });
    }
  }
  
  return results;
}

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

    // Se não encontrou pasta, pode ser um arquivo na raiz - criar pasta com o nome do processo
    let processFolderName: string;
    
    if (!processFolder) {
      console.log(`[Documents API GET] Arquivo na raiz detectado: ${decodedSlug}`);
      processFolderName = decodedSlug;
    } else {
      console.log(`[Documents API GET] Pasta encontrada: ${processFolder}`);
      processFolderName = processFolder;
    }

    // Buscar em docs/ e pop-it/
    const docsDirs = [
      join(bpmnDir, processFolderName, 'docs'),
      join(bpmnDir, processFolderName, 'pop-it')
    ];

    console.log(`[Documents API GET] Buscando em:`, docsDirs);

    let allFiles: Array<{name: string, fullPath: string, relativePath: string}> = [];

    for (const docsDir of docsDirs) {
      if (existsSync(docsDir)) {
        const files = findFilesRecursive(docsDir, docsDir);
        allFiles.push(...files);
        console.log(`[Documents API GET] Encontrados ${files.length} arquivos em ${docsDir}`);
      }
    }

    const documents = allFiles.map(file => {
      const stats = statSync(file.fullPath);
      return {
        name: file.relativePath, // Nome com caminho relativo (ex: "geral/arquivo.pdf")
        size: stats.size,
        modified: stats.mtime.toISOString(),
        path: `/api/documents/${slug}/download/${encodeURIComponent(file.relativePath)}`
      };
    });

    console.log(`[Documents API GET] Total de documentos: ${documents.length}`);
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

    // Se não encontrou pasta, pode ser um arquivo na raiz - criar pasta com o nome do processo
    let docsDir: string;
    let githubPathPrefix: string;
    let processFolderName: string;
    
    if (!processFolder) {
      console.log(`[Documents API POST] Arquivo na raiz detectado: ${decodedSlug}`);
      // Criar pasta com o nome do processo diretamente na raiz, subpasta pop-it
      processFolderName = decodedSlug;
      docsDir = join(bpmnDir, processFolderName, 'pop-it');
      githubPathPrefix = `apps/api/storage/bpmn/${processFolderName}/pop-it`;
    } else {
      processFolderName = processFolder;
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
          message: `docs: adicionar documento ${file.name} ao processo ${processFolderName}`,
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

// DELETE: Remover documento
export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const decodedSlug = decodeURIComponent(slug);
    
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json({ error: 'Nome do arquivo não fornecido' }, { status: 400 });
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

    // Procurar o arquivo em docs/ ou pop-it/
    const processFolderName = processFolder || decodedSlug;
    
    const possiblePaths = [
      { dir: 'docs', path: join(bpmnDir, processFolderName, 'docs', filename), githubPrefix: `apps/api/storage/bpmn/${processFolderName}/docs` },
      { dir: 'pop-it', path: join(bpmnDir, processFolderName, 'pop-it', filename), githubPrefix: `apps/api/storage/bpmn/${processFolderName}/pop-it` }
    ];

    let filePath: string | null = null;
    let githubPathPrefix: string = '';
    
    for (const option of possiblePaths) {
      if (existsSync(option.path)) {
        filePath = option.path;
        githubPathPrefix = option.githubPrefix;
        console.log(`[Documents API DELETE] Arquivo encontrado em ${option.dir}:`, filePath);
        break;
      }
    }

    if (!filePath) {
      console.log(`[Documents API DELETE] Arquivo não encontrado: ${filename}`);
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
    }

    // Remover arquivo localmente
    unlinkSync(filePath);

    // Remover do GitHub
    let githubSynced = false;
    try {
      const token = process.env.GITHUB_TOKEN;
      const owner = process.env.GITHUB_OWNER || '4isaque4';
      const repo = process.env.GITHUB_REPO || process.env.GITHUB_REPO_PROCESSOS || 'quaddra';

      if (token) {
        const octokit = new Octokit({ auth: token });
        const githubPath = `${githubPathPrefix}/${filename}`;

        // Buscar SHA do arquivo
        try {
          const { data: existingFile } = await octokit.repos.getContent({
            owner,
            repo,
            path: githubPath,
          });

          if (!Array.isArray(existingFile) && existingFile.sha) {
            await octokit.repos.deleteFile({
              owner,
              repo,
              path: githubPath,
              message: `docs: remover documento ${filename} do processo ${processFolderName}`,
              sha: existingFile.sha,
            });

            githubSynced = true;
          }
        } catch {
          // Arquivo não existe no GitHub
        }
      }
    } catch (githubError) {
      console.error('Erro ao remover do GitHub:', githubError);
    }

    return NextResponse.json({ 
      success: true, 
      message: githubSynced 
        ? 'Arquivo removido e sincronizado com GitHub' 
        : 'Arquivo removido localmente',
      githubSynced
    });
  } catch (error) {
    console.error('Erro ao remover arquivo:', error);
    return NextResponse.json({ error: 'Erro ao remover arquivo' }, { status: 500 });
  }
}
