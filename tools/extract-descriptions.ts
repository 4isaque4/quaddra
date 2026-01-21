import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve, relative } from 'path';

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

function getAllBpmnFiles(dir: string, baseDir: string, fileList: Array<{ path: string, name: string }> = []): Array<{ path: string, name: string }> {
  const files = readdirSync(dir);
  
  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllBpmnFiles(filePath, baseDir, fileList);
    } else if (file.toLowerCase().endsWith('.bpmn')) {
      const relativePath = relative(baseDir, filePath).replace(/\\/g, '/');
      fileList.push({
        path: relativePath,
        name: file
      });
    }
  });
  
  return fileList;
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
    
    const bpmnFiles = getAllBpmnFiles(bpmnDir, bpmnDir);
    console.log(`📋 Encontrados ${bpmnFiles.length} arquivos BPMN (recursivo)`);
    
    const allDescriptions: DescriptionsData = { processes: {} };
    
    bpmnFiles.forEach(({ path, name }) => {
      try {
        const filePath = join(bpmnDir, path.replace(/\//g, '\\'));
        console.log(`\n📖 Processando: ${path}`);
        
        const xmlContent = readFileSync(filePath, 'utf8');
        const processName = path.replace(/\.bpmn$/i, '');
        
        const elements = extractDescriptionsFromBpmn(xmlContent, path);
        allDescriptions.processes[processName] = { elements };
        
        console.log(`✅ Extraídos ${Object.keys(elements).length} elementos de ${processName}`);
        
      } catch (error) {
        console.error(`❌ Erro ao processar ${path}:`, error);
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
