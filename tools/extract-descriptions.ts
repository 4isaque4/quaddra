import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

interface BpmnElement {
  id: string;
  name?: string;
  description?: string;
  type?: string;
  processName?: string;
  file?: string;
}

interface ProcessData {
  [key: string]: BpmnElement;
}

interface DescriptionsData {
  processes: {
    [processName: string]: {
      elements: ProcessData;
    };
  };
}

function extractDescriptionsFromBpmn(xmlContent: string, filename: string): ProcessData {
  const elements: ProcessData = {};
  
  // Extrair elementos do processo
  const processMatch = xmlContent.match(/<process[^>]*id="([^"]*)"[^>]*>/);
  const processId = processMatch ? processMatch[1] : 'unknown';
  
  // Extrair tasks
  const taskRegex = /<task[^>]*id="([^"]*)"[^>]*name="([^"]*)"[^>]*>/g;
  let match;
  while ((match = taskRegex.exec(xmlContent)) !== null) {
    const [, id, name] = match;
    elements[id] = {
      id,
      name: name || id,
      type: 'task',
      processName: processId,
      file: filename
    };
  }
  
  // Extrair gateways
  const gatewayRegex = /<(exclusiveGateway|parallelGateway|inclusiveGateway)[^>]*id="([^"]*)"[^>]*name="([^"]*)"[^>]*>/g;
  while ((match = gatewayRegex.exec(xmlContent)) !== null) {
    const [, type, id, name] = match;
    elements[id] = {
      id,
      name: name || id,
      type,
      processName: processId,
      file: filename
    };
  }
  
  // Extrair eventos
  const eventRegex = /<(startEvent|endEvent|intermediateThrowEvent|intermediateCatchEvent)[^>]*id="([^"]*)"[^>]*name="([^"]*)"[^>]*>/g;
  while ((match = eventRegex.exec(xmlContent)) !== null) {
    const [, type, id, name] = match;
    elements[id] = {
      id,
      name: name || id,
      type,
      processName: processId,
      file: filename
    };
  }
  
  // Extrair pools e lanes
  const poolRegex = /<(pool|lane)[^>]*id="([^"]*)"[^>]*name="([^"]*)"[^>]*>/g;
  while ((match = poolRegex.exec(xmlContent)) !== null) {
    const [, type, id, name] = match;
    elements[id] = {
      id,
      name: name || id,
      type,
      processName: processId,
      file: filename
    };
  }
  
  return elements;
}

function main() {
  try {
    const currentDir = process.cwd();
    const bpmnDir = join(currentDir, 'apps', 'api', 'storage', 'bpmn');
    const outputFile = join(currentDir, 'apps', 'api', 'storage', 'descriptions.flat.json');
    
    console.log('📁 Diretório atual:', currentDir);
    console.log('📂 Diretório BPMN:', bpmnDir);
    console.log('💾 Arquivo de saída:', outputFile);
    
    if (!existsSync(bpmnDir)) {
      console.error('❌ Diretório BPMN não encontrado:', bpmnDir);
      process.exit(1);
    }
    
    const bpmnFiles = readdirSync(bpmnDir).filter(file => file.endsWith('.bpmn'));
    console.log(`📋 Encontrados ${bpmnFiles.length} arquivos BPMN:`, bpmnFiles);
    
    const allDescriptions: DescriptionsData = { processes: {} };
    
    bpmnFiles.forEach(filename => {
      try {
        const filePath = join(bpmnDir, filename);
        console.log(`\n📖 Processando: ${filename}`);
        
        const xmlContent = readFileSync(filePath, 'utf8');
        const processName = filename.replace('.bpmn', '');
        
        const elements = extractDescriptionsFromBpmn(xmlContent, filename);
        allDescriptions.processes[processName] = { elements };
        
        console.log(`✅ Extraídos ${Object.keys(elements).length} elementos de ${processName}`);
        
      } catch (error) {
        console.error(`❌ Erro ao processar ${filename}:`, error);
      }
    });
    
    // Salvar arquivo consolidado
    const jsonContent = JSON.stringify(allDescriptions, null, 2);
    writeFileSync(outputFile, jsonContent, 'utf8');
    
    console.log(`\n🎉 Processo concluído!`);
    console.log(`📊 Total de processos: ${Object.keys(allDescriptions.processes).length}`);
    console.log(`📊 Total de elementos: ${Object.values(allDescriptions.processes).reduce((acc, proc) => acc + Object.keys(proc.elements).length, 0)}`);
    console.log(`💾 Arquivo salvo em: ${outputFile}`);
    
  } catch (error) {
    console.error('❌ Erro durante a execução:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { extractDescriptionsFromBpmn, main };
