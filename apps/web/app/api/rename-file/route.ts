import { NextResponse } from 'next/server';
import { renameSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';

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

    // Construir caminhos
    const bpmnDir = join(process.cwd(), '..', 'api', 'storage', 'bpmn');
    const oldFilePath = join(bpmnDir, oldPath);
    const fileDir = dirname(oldFilePath);
    const newFilePath = join(fileDir, newName);

    // Verificar se arquivo antigo existe
    if (!existsSync(oldFilePath)) {
      return NextResponse.json(
        { error: 'Arquivo original não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se novo nome já existe
    if (existsSync(newFilePath) && oldFilePath !== newFilePath) {
      return NextResponse.json(
        { error: 'Já existe um arquivo com este nome' },
        { status: 409 }
      );
    }

    // Renomear arquivo
    renameSync(oldFilePath, newFilePath);

    // Também renomear pasta de documentos se existir
    const oldDocsPath = join(fileDir, 'docs', basename(oldPath, '.bpmn'));
    const newDocsPath = join(fileDir, 'docs', basename(newName, '.bpmn'));
    
    if (existsSync(oldDocsPath)) {
      try {
        renameSync(oldDocsPath, newDocsPath);
      } catch (error) {
        console.warn('Não foi possível renomear pasta de documentos:', error);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Arquivo renomeado com sucesso',
      oldPath,
      newPath: join(dirname(oldPath), newName).replace(/\\/g, '/')
    });
  } catch (error: any) {
    console.error('Erro ao renomear arquivo:', error);
    return NextResponse.json(
      { error: 'Erro ao renomear arquivo', details: error.message },
      { status: 500 }
    );
  }
}
