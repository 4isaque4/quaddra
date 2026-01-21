import { readdirSync, copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Script para preparar arquivos .bpm para conversão
 * 
 * IMPORTANTE: Arquivos .bpm do Bizagi são binários proprietários e NÃO podem
 * ser convertidos automaticamente sem o Bizagi Process Modeler instalado.
 * 
 * Este script copia os arquivos .bpm para a pasta de BPMN e cria arquivos
 * placeholder .bpmn vazios que precisam ser preenchidos manualmente após
 * a exportação do Bizagi.
 */

function main() {
  try {
    const currentDir = process.cwd();
    const processosDir = join(currentDir, 'Processos');
    const bpmnDir = join(currentDir, 'apps', 'api', 'storage', 'bpmn');
    
    console.log('📁 Diretório de processos:', processosDir);
    console.log('📂 Diretório BPMN:', bpmnDir);
    
    if (!existsSync(processosDir)) {
      console.error('❌ Diretório Processos não encontrado:', processosDir);
      process.exit(1);
    }
    
    // Criar diretório BPMN se não existir
    if (!existsSync(bpmnDir)) {
      mkdirSync(bpmnDir, { recursive: true });
      console.log('✅ Diretório BPMN criado');
    }
    
    // Listar arquivos .bpm
    const bpmFiles = readdirSync(processosDir).filter(f => f.toLowerCase().endsWith('.bpm'));
    console.log(`\n📋 Encontrados ${bpmFiles.length} arquivos .bpm:`);
    
    if (bpmFiles.length === 0) {
      console.log('⚠️  Nenhum arquivo .bpm encontrado na pasta Processos/');
      return;
    }
    
    bpmFiles.forEach(file => {
      console.log(`  - ${file}`);
    });
    
    console.log('\n⚠️  ATENÇÃO: Arquivos .bpm do Bizagi são binários proprietários.');
    console.log('   Eles NÃO podem ser convertidos automaticamente sem o Bizagi Process Modeler.');
    console.log('\n📝 Para converter os arquivos:');
    console.log('   1. Abra cada arquivo .bpm no Bizagi Process Modeler');
    console.log('   2. Vá em File > Export > BPMN 2.0');
    console.log('   3. Salve o arquivo .bpmn na pasta: apps/api/storage/bpmn/');
    console.log('   4. Execute: npm run extract-bpmn');
    
    console.log('\n💡 Alternativa: Se você já tem os arquivos .bpmn convertidos,');
    console.log('   copie-os diretamente para: apps/api/storage/bpmn/');
    
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

main();







