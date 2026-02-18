/**
 * Extração de texto formatado e textos de associação a partir de XML BPMN.
 * Suporta textAnnotation, association (ambas direções) e documentation em tasks.
 * Usado pelo BpmnViewer para exibir "Texto formatado (BPMN)" e "Textos de associação (BPMN)" no modal.
 */

export type BpmnTextByElement = Record<
  string,
  { textoFormatado?: string; textosAssociados?: string[] }
>;

/**
 * Extrai, por id de elemento, o texto formatado e os textos de associação
 * (textAnnotation ligadas por association ao elemento).
 */
export function extractBpmnTextFromXml(xml: string): BpmnTextByElement {
  const out: BpmnTextByElement = {};
  try {
    const annotations = extractTextAnnotations(xml);
    applyAssociations(xml, annotations, out);
    applyTaskDocumentation(xml, out);
  } catch (e) {
    console.warn('[BPMN] Falha ao extrair texto do XML:', e);
  }
  return out;
}

/**
 * Retorna o mapa id da textAnnotation -> texto (conteúdo de <text>).
 * Usado para injetar o texto formatado no diagrama após o import.
 */
export function getTextAnnotationsFromXml(xml: string): Record<string, string> {
  return extractTextAnnotations(xml);
}

function extractTextAnnotations(xml: string): Record<string, string> {
  const annotations: Record<string, string> = {};
  const textAnnotationStart = /<textAnnotation[\s>]/g;
  const textAnnotationStartBpmn = /<bpmn:textAnnotation[\s>]/gi;
  const startRegex = xml.includes('<textAnnotation') ? textAnnotationStart : textAnnotationStartBpmn;
  let startMatch: RegExpExecArray | null;

  while ((startMatch = startRegex.exec(xml)) !== null) {
    const openStart = startMatch.index;
    const openEnd = xml.indexOf('>', openStart);
    if (openEnd === -1) break;

    const openTag = xml.slice(openStart, openEnd + 1);
    const idMatch = openTag.match(/id="([^"]+)"/);
    const id = idMatch?.[1];
    if (!id) continue;

    const closeTag = xml.indexOf('</textAnnotation>', openEnd);
    const closeTagBpmn = xml.indexOf('</bpmn:textAnnotation>', openEnd);
    const closeEnd =
      closeTag === -1 ? closeTagBpmn : closeTagBpmn === -1 ? closeTag : Math.min(closeTag, closeTagBpmn);
    if (closeEnd === -1) continue;

    const block = xml.slice(openEnd + 1, closeEnd);
    const textOpen = block.indexOf('<text>');
    const textOpenBpmn = block.indexOf('<bpmn:text>');
    const textStart =
      textOpen === -1 ? textOpenBpmn : textOpenBpmn === -1 ? textOpen : Math.min(textOpen, textOpenBpmn);
    if (textStart === -1) continue;

    const afterTextOpen = block.slice(textStart, textStart + 12);
    const contentStart = textStart + (afterTextOpen.startsWith('<text>') ? 6 : 11);
    const textEndTag = block.indexOf('</text>', contentStart);
    const textEndBpmn = block.indexOf('</bpmn:text>', contentStart);
    const textEnd =
      textEndTag === -1 ? textEndBpmn : textEndBpmn === -1 ? textEndTag : Math.min(textEndTag, textEndBpmn);
    if (textEnd === -1) continue;

    const textContent = block.slice(contentStart, textEnd).trim();
    if (textContent) annotations[id] = textContent;
  }

  return annotations;
}

function applyAssociations(
  xml: string,
  annotations: Record<string, string>,
  out: BpmnTextByElement
): void {
  const reAssociation = /<association\s[^>]*>|<bpmn:association\s[^>]*>/gi;
  let m: RegExpExecArray | null;

  while ((m = reAssociation.exec(xml)) !== null) {
    const tag = m[0];
    const sourceRef = tag.match(/sourceRef="([^"]+)"/)?.[1];
    const targetRef = tag.match(/targetRef="([^"]+)"/)?.[1];
    if (!sourceRef || !targetRef) continue;

    const textFromSource = annotations[sourceRef];
    const textFromTarget = annotations[targetRef];
    const elementId = textFromSource ? targetRef : textFromTarget ? sourceRef : null;
    const text = textFromSource || textFromTarget;
    if (!elementId || !text) continue;

    if (!out[elementId]) out[elementId] = {};
    out[elementId].textosAssociados = [...(out[elementId].textosAssociados || []), text];
    if (!out[elementId].textoFormatado) out[elementId].textoFormatado = text;
  }
}

function applyTaskDocumentation(xml: string, out: BpmnTextByElement): void {
  const reDoc =
    /<(?:bpmn:)?(?:task|serviceTask|userTask)[^>]*id="([^"]+)"[^>]*>[\s\S]*?<(?:bpmn:)?documentation[^>]*>([\s\S]*?)<\/(?:bpmn:)?documentation>/gi;
  let m: RegExpExecArray | null;

  while ((m = reDoc.exec(xml)) !== null) {
    const id = m[1];
    const docText = m[2].trim();
    if (docText) {
      if (!out[id]) out[id] = {};
      out[id].textoFormatado = out[id].textoFormatado || docText;
    }
  }
}
