import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string, filename: string } }
) {
  try {
    const { slug, filename } = params;
    const decodedSlug = decodeURIComponent(slug);
    const decodedFilename = decodeURIComponent(filename);
    
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
    let filePath: string;
    
    if (!processFolder) {
      // Arquivo na raiz - usar pop-it/
      filePath = join(bpmnDir, decodedSlug, 'pop-it', decodedFilename);
    } else {
      // Arquivo em pasta - usar docs/
      filePath = join(bpmnDir, processFolder, 'docs', decodedFilename);
    }

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
    }

    const fileBuffer = readFileSync(filePath);
    
    // Determinar o tipo MIME baseado na extensão
    const extension = decodedFilename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'doc': 'application/msword',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel',
      'txt': 'text/plain',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg'
    };

    const mimeType = mimeTypes[extension || ''] || 'application/octet-stream';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${decodedFilename}"`
      }
    });
  } catch (error) {
    console.error('Erro ao fazer download:', error);
    return NextResponse.json({ error: 'Erro ao fazer download' }, { status: 500 });
  }
}
