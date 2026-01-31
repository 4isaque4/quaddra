/**
 * Parser específico para arquivos BPMN exportados do Bizagi
 * Extrai todas as propriedades e extensões específicas do Bizagi
 */

import { DOMParser } from '@xmldom/xmldom';

export interface BizagiElement {
  id: string;
  name: string;
  type: string;
  description?: string;
  documentation?: string;
  performer?: string; // Ator/Responsável
  bgColor?: string;
  borderColor?: string;
  textColor?: string;
  // Propriedades customizadas do Bizagi
  customProperties?: Record<string, string>;
  // Dados de formulário
  formFields?: Array<{
    name: string;
    type: string;
    required?: boolean;
  }>;
  // Regras de negócio
  businessRules?: string[];
}

export interface BizagiProcess {
  id: string;
  name: string;
  elements: Record<string, BizagiElement>;
  pools?: Array<{ id: string; name: string }>;
  lanes?: Array<{ id: string; name: string; poolId?: string }>;
}

export interface BizagiParseResult {
  processes: Record<string, BizagiProcess>;
  errors: string[];
  warnings: string[];
}

/**
 * Extrai propriedades Bizagi de um elemento
 */
function extractBizagiProperties(element: Element): Record<string, string> {
  const properties: Record<string, string> = {};
  
  // Procurar por extensões Bizagi
  const extensionElements = element.getElementsByTagName('extensionElements');
  
  for (let i = 0; i < extensionElements.length; i++) {
    const extElement = extensionElements[i];
    
    // Buscar BizagiExtensions
    const bizagiExtensions = extElement.getElementsByTagNameNS(
      'http://www.bizagi.com/bpmn20',
      'BizagiExtensions'
    );
    
    for (let j = 0; j < bizagiExtensions.length; j++) {
      const bizagiExt = bizagiExtensions[j];
      
      // Buscar BizagiProperties
      const bizagiProps = bizagiExt.getElementsByTagNameNS(
        'http://www.bizagi.com/bpmn20',
        'BizagiProperties'
      );
      
      for (let k = 0; k < bizagiProps.length; k++) {
        const propsElement = bizagiProps[k];
        
        // Buscar BizagiProperty
        const bizagiProperty = propsElement.getElementsByTagNameNS(
          'http://www.bizagi.com/bpmn20',
          'BizagiProperty'
        );
        
        for (let l = 0; l < bizagiProperty.length; l++) {
          const prop = bizagiProperty[l];
          const name = prop.getAttribute('name');
          const value = prop.getAttribute('value');
          
          if (name && value) {
            properties[name] = value;
          }
        }
      }
    }
  }
  
  return properties;
}

/**
 * Extrai documentação de um elemento
 */
function extractDocumentation(element: Element): string {
  const docElements = element.getElementsByTagName('documentation');
  
  if (docElements.length > 0) {
    return docElements[0].textContent?.trim() || '';
  }
  
  return '';
}

/**
 * Extrai performer/ator de um elemento (User Task)
 */
function extractPerformer(element: Element): string | undefined {
  // Tentar extrair das propriedades Bizagi primeiro
  const bizagiProps = extractBizagiProperties(element);
  if (bizagiProps.performer) {
    return bizagiProps.performer;
  }
  
  // Tentar extrair de resourceRole
  const resourceRoles = element.getElementsByTagName('resourceRole');
  if (resourceRoles.length > 0) {
    const name = resourceRoles[0].getAttribute('name');
    if (name) return name;
  }
  
  // Tentar extrair de potentialOwner
  const potentialOwners = element.getElementsByTagName('potentialOwner');
  if (potentialOwners.length > 0) {
    const resourceRef = potentialOwners[0].getElementsByTagName('resourceRef');
    if (resourceRef.length > 0) {
      return resourceRef[0].textContent?.trim();
    }
  }
  
  return undefined;
}

/**
 * Parse de arquivo BPMN do Bizagi
 */
export function parseBizagiBpmn(xmlContent: string): BizagiParseResult {
  const result: BizagiParseResult = {
    processes: {},
    errors: [],
    warnings: []
  };
  
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
    
    // Verificar erros de parsing
    const parserErrors = xmlDoc.getElementsByTagName('parsererror');
    if (parserErrors.length > 0) {
      result.errors.push('Erro ao fazer parse do XML: ' + parserErrors[0].textContent);
      return result;
    }
    
    // Extrair processos
    const processes = xmlDoc.getElementsByTagName('process');
    
    for (let i = 0; i < processes.length; i++) {
      const processElement = processes[i];
      const processId = processElement.getAttribute('id') || `process_${i}`;
      const processName = processElement.getAttribute('name') || processId;
      
      const bizagiProcess: BizagiProcess = {
        id: processId,
        name: processName,
        elements: {},
        pools: [],
        lanes: []
      };
      
      // Extrair elementos do processo
      const elementTypes = [
        'task',
        'userTask',
        'serviceTask',
        'scriptTask',
        'manualTask',
        'businessRuleTask',
        'sendTask',
        'receiveTask',
        'exclusiveGateway',
        'parallelGateway',
        'inclusiveGateway',
        'eventBasedGateway',
        'startEvent',
        'endEvent',
        'intermediateThrowEvent',
        'intermediateCatchEvent',
        'boundaryEvent',
        'subProcess',
        'callActivity'
      ];
      
      elementTypes.forEach(elementType => {
        const elements = processElement.getElementsByTagName(elementType);
        
        for (let j = 0; j < elements.length; j++) {
          const element = elements[j];
          const elementId = element.getAttribute('id');
          const elementName = element.getAttribute('name') || elementId || 'Sem nome';
          
          if (!elementId) continue;
          
          const bizagiProps = extractBizagiProperties(element);
          const documentation = extractDocumentation(element);
          const performer = extractPerformer(element);
          
          bizagiProcess.elements[elementId] = {
            id: elementId,
            name: elementName,
            type: elementType,
            description: documentation,
            documentation: documentation,
            performer: performer,
            bgColor: bizagiProps.bgColor,
            borderColor: bizagiProps.borderColor,
            textColor: bizagiProps.textColor,
            customProperties: bizagiProps
          };
        }
      });
      
      result.processes[processId] = bizagiProcess;
    }
    
    // Extrair Pools
    const collaborations = xmlDoc.getElementsByTagName('collaboration');
    for (let i = 0; i < collaborations.length; i++) {
      const collaboration = collaborations[i];
      const participants = collaboration.getElementsByTagName('participant');
      
      for (let j = 0; j < participants.length; j++) {
        const participant = participants[j];
        const participantId = participant.getAttribute('id');
        const participantName = participant.getAttribute('name');
        const processRef = participant.getAttribute('processRef');
        
        if (participantId && participantName && processRef && result.processes[processRef]) {
          if (!result.processes[processRef].pools) {
            result.processes[processRef].pools = [];
          }
          result.processes[processRef].pools!.push({
            id: participantId,
            name: participantName
          });
        }
      }
    }
    
    // Extrair Lanes
    for (const processId in result.processes) {
      const processElement = Array.from(processes).find(
        p => p.getAttribute('id') === processId
      );
      
      if (processElement) {
        const laneSet = processElement.getElementsByTagName('laneSet');
        for (let i = 0; i < laneSet.length; i++) {
          const lanes = laneSet[i].getElementsByTagName('lane');
          
          for (let j = 0; j < lanes.length; j++) {
            const lane = lanes[j];
            const laneId = lane.getAttribute('id');
            const laneName = lane.getAttribute('name');
            
            if (laneId && laneName) {
              if (!result.processes[processId].lanes) {
                result.processes[processId].lanes = [];
              }
              result.processes[processId].lanes!.push({
                id: laneId,
                name: laneName
              });
            }
          }
        }
      }
    }
    
    // Verificar se encontrou processos
    if (Object.keys(result.processes).length === 0) {
      result.warnings.push('Nenhum processo encontrado no arquivo BPMN');
    }
    
  } catch (error) {
    result.errors.push(`Erro ao processar BPMN: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
  
  return result;
}

/**
 * Converte resultado do parser para formato de conteúdo do sistema
 */
export function convertToContentFormat(parseResult: BizagiParseResult): Record<string, any> {
  const content: Record<string, any> = {};
  
  for (const processId in parseResult.processes) {
    const process = parseResult.processes[processId];
    
    for (const elementId in process.elements) {
      const element = process.elements[elementId];
      
      content[elementId] = {
        id: elementId,
        nome: element.name,
        tipo: element.type,
        ator: element.performer || '',
        descricao: element.description || element.documentation || '',
        // Arrays vazios que podem ser preenchidos depois
        entradas: [],
        saidas: [],
        ferramentas: [],
        passoAPasso: element.description ? [element.description] : [],
        popItReferencia: [],
        observacoes: element.customProperties ? 
          Object.entries(element.customProperties)
            .filter(([key]) => !['bgColor', 'borderColor', 'textColor'].includes(key))
            .map(([key, value]) => `${key}: ${value}`)
          : []
      };
    }
  }
  
  return content;
}

/**
 * Extrai lista de atores/performers únicos do processo
 */
export function extractPerformers(parseResult: BizagiParseResult): string[] {
  const performers = new Set<string>();
  
  for (const processId in parseResult.processes) {
    const process = parseResult.processes[processId];
    
    // Adicionar lanes como performers
    if (process.lanes) {
      process.lanes.forEach(lane => performers.add(lane.name));
    }
    
    // Adicionar performers dos elementos
    for (const elementId in process.elements) {
      const element = process.elements[elementId];
      if (element.performer) {
        performers.add(element.performer);
      }
    }
  }
  
  return Array.from(performers).sort();
}
