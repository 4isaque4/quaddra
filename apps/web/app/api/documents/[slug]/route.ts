import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

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

    const docsDir = join(bpmnDir, processFolder, 'docs');

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

    const docsDir = join(bpmnDir, processFolder, 'docs');

    // Criar pasta docs se não existir
    if (!existsSync(docsDir)) {
      mkdirSync(docsDir, { recursive: true });
    }

    // Salvar arquivo
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = join(docsDir, file.name);
    
    writeFileSync(filePath, buffer);

    return NextResponse.json({ 
      success: true, 
      message: 'Arquivo enviado com sucesso',
      file: {
        name: file.name,
        size: file.size
      }
    });
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    return NextResponse.json({ error: 'Erro ao fazer upload' }, { status: 500 });
  }
}
