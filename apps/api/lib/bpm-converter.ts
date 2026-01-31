/**
 * Conversor de arquivos .bpm (Bizagi) para .bpmn
 * Arquivos .bpm do Bizagi podem ser arquivos ZIP contendo XMLs
 */

import { unzipSync } from 'fflate';

export interface BpmConversionResult {
  success: boolean;
  bpmnXml?: string;
  bpmnFileName?: string;
  error?: string;
  warnings?: string[];
}

/**
 * Tenta converter arquivo .bpm para .bpmn
 * Primeiro tenta descompactar como ZIP, senão tenta ler como XML direto
 */
export async function convertBpmToBpmn(
  bpmBuffer: Buffer,
  originalFileName: string
): Promise<BpmConversionResult> {
  const result: BpmConversionResult = {
    success: false,
    warnings: []
  };

  try {
    // Tentar descompactar como ZIP primeiro
    try {
      const unzipped = unzipSync(new Uint8Array(bpmBuffer));

      // Listar todos os arquivos encontrados no ZIP
      const allFiles = Object.keys(unzipped);
      console.log('[BPM-CONVERTER] Arquivos encontrados no ZIP:', allFiles);

      // Procurar por arquivos .bpmn, .xml ou .diag dentro do ZIP
      const xmlFiles = allFiles.filter(name =>
        name.toLowerCase().endsWith('.bpmn') ||
        name.toLowerCase().endsWith('.xml') ||
        name.toLowerCase().endsWith('.diag')
      );

      console.log('[BPM-CONVERTER] Arquivos XML/DIAG encontrados:', xmlFiles);

      if (xmlFiles.length > 0) {
        // Tentar encontrar o arquivo BPMN correto
        // 1. Priorizar arquivos que contenham "definitions" e "process" (elementos BPMN)
        // 2. Ignorar arquivos de metadata como ModelInfo.xml
        let selectedFile = null;
        let selectedXml = '';

        for (const fileName of xmlFiles) {
          console.log('[BPM-CONVERTER] Analisando arquivo:', fileName);

          // Ignorar arquivos de metadata conhecidos
          if (fileName.toLowerCase().includes('modelinfo') ||
            fileName.toLowerCase().includes('metadata')) {
            console.log('[BPM-CONVERTER] Ignorando arquivo de metadata:', fileName);
            continue;
          }

          const content = unzipped[fileName];

          // Se for .diag, tentar descompactar como ZIP
          if (fileName.toLowerCase().endsWith('.diag')) {
            console.log('[BPM-CONVERTER] Arquivo .diag detectado, tentando descompactar...');
            try {
              const diagUnzipped = unzipSync(content);
              const diagFiles = Object.keys(diagUnzipped);
              console.log('[BPM-CONVERTER] Arquivos dentro do .diag:', diagFiles);

              // Procurar por arquivos BPMN dentro do .diag
              for (const diagFile of diagFiles) {
                console.log('[BPM-CONVERTER] Analisando arquivo dentro do .diag:', diagFile);
                const diagContent = diagUnzipped[diagFile];
                const diagXml = new TextDecoder().decode(diagContent);

                // Log do preview para debug
                const diagPreview = diagXml.substring(0, 800);
                console.log('[BPM-CONVERTER] Preview:', diagPreview);

                // Verificar se é BPMN ou XPDL
                const hasBpmnDefinitions = diagXml.includes('<definitions') || diagXml.includes('<bpmn:definitions') || diagXml.includes('<bpmn2:definitions');
                const hasBpmnProcess = diagXml.includes('<process') || diagXml.includes('<bpmn:process') || diagXml.includes('<bpmn2:process');
                const hasXpdlPackage = diagXml.includes('<Package') && diagXml.includes('XPDL');
                const hasXpdlProcess = diagXml.includes('<WorkflowProcess') || diagXml.includes('WorkflowProcesses');

                console.log('[BPM-CONVERTER] Tem <definitions> (BPMN)?', hasBpmnDefinitions);
                console.log('[BPM-CONVERTER] Tem <process> (BPMN)?', hasBpmnProcess);
                console.log('[BPM-CONVERTER] Tem <Package> (XPDL)?', hasXpdlPackage);

                // Aceitar tanto BPMN quanto XPDL
                if ((hasBpmnDefinitions && hasBpmnProcess) || (hasXpdlPackage && diagFile.toLowerCase() === 'diagram.xml')) {
                  selectedFile = `${fileName}/${diagFile}`;
                  selectedXml = diagXml;
                  const format = hasBpmnDefinitions ? 'BPMN' : 'XPDL';
                  console.log(`[BPM-CONVERTER] ✓ Arquivo ${format} encontrado dentro do .diag:`, diagFile);

                  if (format === 'XPDL') {
                    result.warnings?.push('Arquivo .bpm usa formato XPDL (Bizagi). Exportado como XML do diagrama.');
                  }
                  break;
                }
              }

              if (selectedFile) break;
              continue;
            } catch (diagError) {
              console.log('[BPM-CONVERTER] Erro ao descompactar .diag:', diagError);
              // Tentar ler como XML direto
            }
          }

          const xml = new TextDecoder().decode(content);

          // Log do início do XML para debug
          const xmlPreview = xml.substring(0, 500);
          console.log('[BPM-CONVERTER] Preview do XML:', xmlPreview);

          // Verificar se contém elementos BPMN válidos
          const hasDefinitions = xml.includes('<definitions') || xml.includes('<bpmn:definitions') || xml.includes('<bpmn2:definitions');
          const hasProcess = xml.includes('<process') || xml.includes('<bpmn:process') || xml.includes('<bpmn2:process');

          console.log('[BPM-CONVERTER] Tem <definitions>?', hasDefinitions);
          console.log('[BPM-CONVERTER] Tem <process>?', hasProcess);

          if (hasDefinitions && hasProcess) {
            selectedFile = fileName;
            selectedXml = xml;
            console.log('[BPM-CONVERTER] ✓ Arquivo BPMN válido encontrado:', fileName);
            break; // Encontrou o arquivo correto
          }
        }

        // Se não encontrou um arquivo com <definitions> e <process>, tentar qualquer XML válido
        if (!selectedFile) {
          for (const fileName of xmlFiles) {
            if (fileName.toLowerCase().includes('modelinfo') ||
              fileName.toLowerCase().includes('metadata')) {
              continue;
            }

            const content = unzipped[fileName];
            const xml = new TextDecoder().decode(content);

            if (xml.includes('<?xml') && xml.includes('<definitions')) {
              selectedFile = fileName;
              selectedXml = xml;
              break;
            }
          }
        }

        if (selectedFile && selectedXml) {
          result.success = true;
          result.bpmnXml = selectedXml;
          result.bpmnFileName = originalFileName.replace(/\.bpm$/i, '.bpmn');

          if (xmlFiles.length > 1) {
            result.warnings?.push(
              `Múltiplos arquivos encontrados no .bpm. Usando: ${selectedFile}`
            );
          }

          return result;
        }
      }

      result.error = 'Arquivo .bpm não contém arquivos BPMN válidos';
      return result;

    } catch (zipError) {
      // Não é um ZIP, tentar ler como XML direto
      const content = bpmBuffer.toString('utf-8');

      if (content.includes('<?xml') || content.includes('<definitions')) {
        // É XML válido
        result.success = true;
        result.bpmnXml = content;
        result.bpmnFileName = originalFileName.replace(/\.bpm$/i, '.bpmn');
        result.warnings?.push('Arquivo .bpm lido como XML direto (não é ZIP)');
        return result;
      }

      // Tentar com encoding latin1
      const contentLatin1 = bpmBuffer.toString('latin1');
      if (contentLatin1.includes('<?xml') || contentLatin1.includes('<definitions')) {
        result.success = true;
        result.bpmnXml = contentLatin1;
        result.bpmnFileName = originalFileName.replace(/\.bpm$/i, '.bpmn');
        result.warnings?.push('Arquivo .bpm convertido usando encoding latin1');
        return result;
      }

      result.error =
        'Arquivo .bpm não pôde ser convertido. ' +
        'Formato binário proprietário do Bizagi detectado. ' +
        'Por favor, exporte o arquivo como BPMN 2.0 no Bizagi Modeler.';
      return result;
    }

  } catch (error) {
    result.error = `Erro ao processar arquivo .bpm: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
    return result;
  }
}

/**
 * Valida se o XML BPMN/XPDL extraído é válido
 */
export function validateBpmnXml(xml: string): { valid: boolean; error?: string } {
  if (!xml || xml.trim().length === 0) {
    return { valid: false, error: 'XML vazio' };
  }

  if (!xml.includes('<?xml')) {
    return { valid: false, error: 'Não é um arquivo XML válido' };
  }

  // Aceitar tanto BPMN quanto XPDL (formato do Bizagi)
  const isBpmn = xml.includes('bpmn') || xml.includes('BPMN') || xml.includes('<definitions');
  const isXpdl = xml.includes('XPDL') || xml.includes('<Package');

  if (!isBpmn && !isXpdl) {
    return { valid: false, error: 'XML não contém elementos BPMN ou XPDL' };
  }

  return { valid: true };
}
