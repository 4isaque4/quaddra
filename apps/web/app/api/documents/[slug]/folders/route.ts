import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Função auxiliar para buscar pastas recursivamente
function findFoldersRecursive(dir: string, baseDir: string): string[] {
  const folders: string[] = [];
  
  if (!existsSync(dir)) return folders;
  
  try {
    const items = readdirSync(dir);
    
    for (const item of items) {
      // Filtrar arquivos ocultos
      if (item.startsWith('.')) {
        continue;
      }
      
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        const relativePath = join(baseDir, item).replace(/\\/g, '/');
        folders.push(item); // Apenas o nome da pasta, não o caminho completo
        
        // Buscar recursivamente em subpastas (opcional - pode limitar profundidade)
        const subFolders = findFoldersRecursive(fullPath, relativePath);
        folders.push(...subFolders.map(f => `${item}/${f}`));
      }
    }
  } catch (error) {
    console.error('Erro ao buscar pastas:', error);
  }
  
  return folders;
}

// GET: Listar pastas disponíveis em um processo
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
      return NextResponse.json({ folders: ['docs'] }, { status: 200 });
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

    let processDir: string;
    
    if (!processFolder) {
      // Arquivo na raiz - tentar encontrar pela slug
      processDir = join(bpmnDir, decodedSlug);
    } else {
      processDir = join(bpmnDir, processFolder);
    }

    // Buscar todas as pastas dentro do processo
    const availableFolders: string[] = ['docs']; // Sempre incluir docs como padrão
    
    if (existsSync(processDir)) {
      const processFolders = findFoldersRecursive(processDir, '');
      // Adicionar pastas encontradas (remover duplicatas)
      processFolders.forEach(folder => {
        // Normalizar caminho relativo
        const normalizedFolder = folder.replace(/\\/g, '/');
        if (!availableFolders.includes(normalizedFolder)) {
          availableFolders.push(normalizedFolder);
        }
      });
    }

    return NextResponse.json({ folders: availableFolders });
  } catch (error: any) {
    console.error('Erro ao listar pastas:', error);
    // Retornar pelo menos a pasta padrão
    return NextResponse.json({ folders: ['docs'] }, { status: 200 });
  }
}
