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

    const processFolder = folders.find(folder => {
      const normalized = folder
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ç/g, 'c')
        .replace(/Ç/g, 'C')
        .replace(/\s+/g, '-')
        .replace(/\//g, '-')
        .toLowerCase();
      
      return normalized === decodedSlug.toLowerCase() || 
             folder === decodedSlug ||
             decodedSlug.includes(normalized);
    });

    if (!processFolder) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 });
    }

    const filePath = join(bpmnDir, processFolder, 'docs', decodedFilename);

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
