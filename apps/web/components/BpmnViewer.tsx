'use client';
import React, { useEffect, useRef, useState } from 'react';
import BpmnJS from 'bpmn-js/dist/bpmn-navigated-viewer.development.js';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

type BpmnViewerProps = {
  bpmnUrl: string
  descriptionsUrl: string
  contentUrl?: string
}

export default function BpmnViewer({ bpmnUrl, descriptionsUrl, contentUrl }: BpmnViewerProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [viewer, setViewer] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [selected, setSelected] = useState<any>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedData, setEditedData] = useState<any>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [localEdits, setLocalEdits] = useState<Record<string, any>>({});
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [modalDimensions, setModalDimensions] = useState({ width: 1000, height: 700 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string>('');
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Debug: Log quando showModal muda
  useEffect(() => {
    // console.log('[Modal] showModal alterado para:', showModal);
  }, [showModal]);

  useEffect(() => {
    if (!ref.current) return;
    
    let overlays: any, eventBus: any, canvas: any, elementRegistry: any;
    let active: Record<string, any> = {};
    let currentViewer: any = null;
    let selectionMarker: string | null = null;
    let cursorStyleEl: HTMLStyleElement | null = null;

    function escapeHtml(s: any) {
      return String(s ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as any)[m]);
    }

    async function load() {
      try {
        // Verificar se o componente ainda está montado
        if (!ref.current) {
          return;
        }
        
        setError('');
        
        const xmlResp = await fetch(bpmnUrl);
        const descResp = await fetch(descriptionsUrl);
        
        // Buscar content de forma silenciosa (sem mostrar erro 404)
        let contentResp = null;
        if (contentUrl) {
          try {
            contentResp = await fetch(contentUrl);
            if (!contentResp.ok) {
              contentResp = null; // Silenciar erro 404
            }
          } catch (e) {
            contentResp = null; // Silenciar qualquer erro de rede
          }
        }
        
        if (!xmlResp.ok) {
          throw new Error('BPMN não encontrado: ' + bpmnUrl);
        }
        
        const xml = await xmlResp.text();
        const desc = descResp.ok ? await descResp.json() : {};
        
        // Tratar content como opcional - se não existir, usar objeto vazio
        let content: any = {};
        if (contentResp && contentResp.ok) {
          try {
            content = await contentResp.json();
          } catch (e) {
            console.warn('Content não disponível ou inválido, usando dados vazios');
          }
        }
        
        // Verificar se o XML é válido
        if (!xml.includes('<definitions') || !xml.includes('</definitions>')) {
          throw new Error('XML BPMN inválido - não contém definições');
        }
        
        // 3. Criar o viewer
        if (ref.current) {
          currentViewer = new BpmnJS({
            container: ref.current,
            textRenderer: {
              defaultStyle: {
                fontSize: 10,
                lineHeight: 1.1
              },
              externalStyle: {
                fontSize: 9,
                lineHeight: 1.1
              }
            }
          });
          
          setViewer(currentViewer);
        } else {
          throw new Error('Container não disponível');
        }
        
        if (currentViewer) {
          // Verificar novamente se o componente ainda está montado
          if (!ref.current) {
            return;
          }
          
          await currentViewer.importXML(xml);
          try {
            const canvas = currentViewer.get('canvas');
            if (canvas && canvas.zoom) {
              canvas.zoom('fit-viewport');
            }
          } catch (zoomError) {
            console.warn('Erro ao ajustar zoom inicial:', zoomError);
          }
          
          overlays = currentViewer.get('overlays');
          eventBus = currentViewer.get('eventBus');
          canvas = currentViewer.get('canvas');
          elementRegistry = currentViewer.get('elementRegistry');

          // Função para limitar linhas de texto nos labels
          const clampLabelText = () => {
            if (!canvas || !elementRegistry) return;

            elementRegistry.getAll().forEach((el: any) => {
              const gfx = canvas.getGraphics(el);
              if (!gfx) return;

              const textEl = gfx.querySelector('text.djs-label');
              if (!textEl) return;

              const maxLines = el.type === 'bpmn:TextAnnotation' ? 5 : 3;
              const tspans = Array.from(textEl.querySelectorAll('tspan'));

              if (tspans.length <= maxLines) return;

              tspans.slice(maxLines).forEach((tspan: any) => tspan.remove());
              const lastLine = tspans[maxLines - 1] as Element;

              if (lastLine) {
                const original = lastLine.textContent || '';
                const trimmed = original.replace(/…$/, '').trim();
                lastLine.textContent = trimmed ? `${trimmed}…` : '…';
              }
            });
          };

          // estilo de cursor/hover/seleção
          cursorStyleEl = document.createElement('style');
          cursorStyleEl.innerHTML = `
            /* Normalizar todas as bordas para espessura padrão */
            .djs-element .djs-visual > :first-child {
              stroke-width: 2px !important;
            }
            
            .djs-element:not(.djs-connection) .djs-hit {
              cursor: pointer !important;
              stroke: transparent;
              stroke-width: 100px;
              fill: transparent;
              fill-opacity: 0;
              pointer-events: all !important;
            }
            .djs-element.djs-hover .djs-visual > * { filter: none; }
            
            /* Seleção com fundo e borda alaranjada */
            .bpmn-selected .djs-visual > :first-child { 
              stroke: #f97316 !important;
              stroke-width: 3px !important;
              fill: #fed7aa !important; /* tom alaranjado claro */
            }
            
            /* Texto laranja mais escuro quando selecionado (sem negrito) */
            .bpmn-selected .djs-visual > text {
              fill: #c2410c !important; /* laranja mais escuro para contraste */
              stroke: none !important;
              font-weight: normal !important;
            }
            
            .bpmn-selected .djs-visual > .djs-label {
              fill: #c2410c !important;
              font-weight: normal !important;
            }
            
            .bpmn-selected .djs-visual > [class*="bpmn-icon"] { 
              stroke: none !important;
              filter: none !important;
              fill: #c2410c !important; /* ícones também em laranja escuro */
            }
            
            /* Ajustar texto em tarefas para não sobrepor ícones */
            .djs-element .djs-visual text {
              font-size: 10px !important;
              font-weight: 400 !important;
            }
            /* Forçar peso normal em todo texto/label/tspan, inclusive herdados do Bizagi */
            .djs-element .djs-label,
            .djs-element .djs-label text,
            .djs-element .djs-label tspan,
            .djs-element .djs-visual text,
            .djs-element .djs-visual tspan,
            .djs-element text,
            .djs-element tspan,
            .djs-element text[font-weight],
            .djs-element tspan[font-weight],
            .djs-element text[style*="font-weight"],
            .djs-element tspan[style*="font-weight"] {
              font-weight: 400 !important;
              font-family: inherit !important;
              font-stretch: normal !important;
              font-style: normal !important;
              font-variation-settings: "wght" 400 !important;
              stroke: none !important;
            }
            
            /* Deslocar texto para baixo em tarefas com ícones para dar espaço */
            .djs-element[class*="userTask"] .djs-visual text,
            .djs-element[class*="manualTask"] .djs-visual text,
            .djs-element[class*="scriptTask"] .djs-visual text,
            .djs-element[class*="serviceTask"] .djs-visual text,
            .djs-element[class*="businessRuleTask"] .djs-visual text,
            .djs-element[class*="sendTask"] .djs-visual text,
            .djs-element[class*="receiveTask"] .djs-visual text {
              transform: translate(0, 10px);
            }
            
            .tooltip {
              background: rgba(255,255,255,0.95);
              border: 2px solid #f97316;
              border-radius: 6px;
              padding: 8px 12px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              max-width: 300px;
              pointer-events: none;
              z-index: 1000;
            }
            .tooltip .title {
              font-weight: 500;
              color: #f97316;
              font-size: 14px;
              margin-bottom: 4px;
            }
            .tooltip .meta {
              font-size: 11px;
              color: #666;
              margin-bottom: 4px;
            }
            .tooltip div:last-child {
              font-size: 12px;
              color: #333;
            }
            
            /* Anotações de texto - reduzir drasticamente */
            .djs-element[class*="TextAnnotation"] .djs-visual text,
            .djs-element[class*="TextAnnotation"] .djs-label text {
              font-size: 8px !important;
              font-weight: 400 !important;
            }
            
            .djs-element[class*="TextAnnotation"] {
              max-width: 180px !important;
            }
            
            .djs-element[class*="TextAnnotation"] .djs-label {
              max-width: 180px !important;
            }
            
            /* Controlar tamanho de todos os labels */
            .djs-label {
              max-width: 250px !important;
            }
            
            .djs-label text {
              font-size: 10px !important;
            }
            
            /* Remover overlays de hover completamente */
            .djs-overlay-context {
              display: none !important;
            }
            
            /* Overlays permanentes (data stores) - menor z-index */
            .djs-overlay {
              pointer-events: none !important;
              z-index: 1 !important;
            }
            
            /* Remover watermark bpmn.io */
            .bjs-powered-by {
              display: none !important;
            }
          `;
          document.head.appendChild(cursorStyleEl);
          requestAnimationFrame(() => clampLabelText());

          const flat: any = Array.isArray(desc) ? {} : (desc.elements ? desc.elements : (() => {
            const map: any = {};
            if (desc.processes) {
              Object.values<any>(desc.processes as any).forEach(p => {
                Object.values<any>((p as any).elements || {}).forEach((el: any) => { map[el.id] = el; });
              });
            } else if (desc && typeof desc === 'object') {
              Object.assign(map, desc);
            }
            return map;
          })());
          const contentById: Record<string, any> = (() => {
            if (content && content.elements) return content.elements;
            return {};
          })();

          // DESABILITADO: Tooltips ao passar o mouse causam sobreposição
          // eventBus.on('element.hover', 100, function(e: any) {
          //   const id = e.element.id;
          //   const info = flat[id];
          //   if (info && (info.description || info.name)) {
          //     const html = document.createElement('div');
          //     html.className = 'tooltip';
          //     html.style.pointerEvents = 'none';
          //     html.style.zIndex = '1000';
          //     html.innerHTML = `<div class="title">${escapeHtml(info.name || id)}</div>
          //       <div class="meta">${escapeHtml(info.file || '')}${info.processName ? ' • ' + escapeHtml(info.processName) : ''}</div>
          //       <div>${escapeHtml(info.description || '')}</div>`;
          //     if (active[id]) overlays.remove(active[id]);
          //     active[id] = overlays.add(id, { position: { top: -5, left: 0 }, html });
          //   }
          // });

          let clickCount = 0;
          let clickTimer: any = null;

          eventBus.on('element.click', 100, function(e: any) {
            const id = e.element.id;
            const element = e.element;
            clickCount++;

            if (clickCount === 1) {
              clickTimer = setTimeout(() => {
                // Clique único
                const details = contentById[id];
                const fallback = flat[id];
                const businessObject = element.businessObject;
                
                // Sempre cria um objeto, mesmo que vazio
                const merged = details
                  ? { id, ...details }
                  : (fallback ? { 
                      id,
                      nome: fallback.name || id,
                      observacoes: fallback.description ? [fallback.description] : [],
                      arquivo: fallback.file,
                      processo: fallback.processName
                    } : {
                      id,
                      nome: businessObject?.name || element.type || id,
                      tipo: element.type,
                      ator: '',
                      entradas: [],
                      saidas: [],
                      ferramentas: [],
                      passoAPasso: [],
                      popItReferencia: [],
                      observacoes: []
                    });
                
                // Aplicar edições locais se existirem (ler direto do localStorage)
                let finalData = merged;
                try {
                  const storageKey = `bpmn_edits_${bpmnUrl}`;
                  const stored = localStorage.getItem(storageKey);
                  if (stored) {
                    const edits = JSON.parse(stored);
                    if (edits[id]) {
                      finalData = { ...merged, ...edits[id] };
                    }
                  }
                } catch (e) {
                  console.warn('Erro ao carregar edições do localStorage:', e);
                }
                
                setSelected(finalData);
                setSelectedId(id);
                setIsEditing(false);
                setShowModal(false);

                try {
                  if (selectionMarker) {
                    canvas.removeMarker(selectionMarker, 'bpmn-selected');
                  }
                  canvas.addMarker(id, 'bpmn-selected');
                  selectionMarker = id;
                } catch (selErr) {
                  console.warn('Falha ao aplicar marcador de seleção', selErr);
                }
                
                clickCount = 0;
              }, 250);
            } else if (clickCount === 2) {
              // Duplo clique - abrir modal
              clearTimeout(clickTimer);
              const details = contentById[id];
              const fallback = flat[id];
              const businessObject = element.businessObject;
              
              // Sempre cria um objeto, mesmo que vazio
              const merged = details
                ? { id, ...details }
                : (fallback ? { 
                    id,
                    nome: fallback.name || id,
                    observacoes: fallback.description ? [fallback.description] : [],
                    arquivo: fallback.file,
                    processo: fallback.processName
                  } : {
                    id,
                    nome: businessObject?.name || element.type || id,
                    tipo: element.type,
                    ator: '',
                    entradas: [],
                    saidas: [],
                    ferramentas: [],
                    passoAPasso: [],
                    popItReferencia: [],
                    observacoes: []
                  });
              
              // Aplicar edições locais se existirem (ler direto do localStorage)
              let finalData = merged;
              try {
                const storageKey = `bpmn_edits_${bpmnUrl}`;
                const stored = localStorage.getItem(storageKey);
                if (stored) {
                  const edits = JSON.parse(stored);
                  if (edits[id]) {
                    finalData = { ...merged, ...edits[id] };
                  }
                }
              } catch (e) {
                console.warn('Erro ao carregar edições do localStorage:', e);
              }
              
              setSelected(finalData);
              setSelectedId(id);
              setShowModal(true);
              setModalDimensions({ width: 800, height: 600 });
              // Centralizar na tela
              setModalPosition({ 
                x: (window.innerWidth - 800) / 2, 
                y: (window.innerHeight - 600) / 2 
              });
              clickCount = 0;
            }
          });

          // rótulos de data store (usa nome do dataStoreRef ou próprio nome)
          elementRegistry.getAll().forEach((el: any) => {
            if (el.type === 'bpmn:DataStoreReference') {
              const bo = el.businessObject || {};
              const refName = bo.dataStoreRef?.name || bo.name || flat[el.id]?.name;
              if (refName) {
                try {
                  overlays.add(el, {
                    position: { bottom: -28, left: 0 },
                    html: `<span style="background:rgba(255,255,255,0.95);border:1px solid #d4d4d4;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:500;color:#111;pointer-events:none;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.12);z-index:100;display:block;text-align:center;">${escapeHtml(refName)}</span>`
                  });
                } catch (ovErr) {
                  console.warn('Falha ao adicionar label de data store', el.id, ovErr);
                }
              }
            }
          });

          eventBus.on('element.out', 100, function(e: any) {
            const id = e.element.id;
            if (active[id]) { overlays.remove(active[id]); delete active[id]; }
          });
          
          // Verificar se o diagrama está visível após um pequeno delay
          setTimeout(() => {
            if (ref.current && currentViewer) {
              const canvas = currentViewer.get('canvas');
              const elementRegistry = currentViewer.get('elementRegistry');
              const elements = elementRegistry.getAll();
              
              // Se não há elementos visíveis, mostrar mensagem
              if (elements.length === 0) {
                if (ref.current) {
                  ref.current.innerHTML = `
                    <div style="padding:20px;text-align:center;color:#666;">
                      <h3>Diagrama BPMN</h3>
                      <p>XML carregado com sucesso (${xml.length} caracteres)</p>
                      <p>Mas nenhum elemento visual foi encontrado.</p>
                      <p>Verifique se o XML contém elementos de processo válidos.</p>
                    </div>
                  `;
                }
              }
            }
          }, 1000);
        }

      } catch (err) {
        console.error('Erro detalhado ao carregar BPMN:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
        
        if (ref.current) {
          // Fallback: mostrar o XML como texto
          try {
            const xmlResponse = await fetch(bpmnUrl);
            if (xmlResponse.ok && ref.current) {
              const xmlText = await xmlResponse.text();
              ref.current.innerHTML = `
                <div style="padding:20px;color:#f55;text-align:center;">
                  <h3>Erro ao renderizar BPMN</h3>
                  <p>${err instanceof Error ? err.message : 'Erro desconhecido'}</p>
                  <details style="margin-top:10px;text-align:left;max-width:800px;margin:10px auto;">
                    <summary>Detalhes técnicos</summary>
                    <p><strong>URL BPMN:</strong> ${bpmnUrl}</p>
                    <p><strong>URL Descrições:</strong> ${descriptionsUrl}</p>
                    <p><strong>Erro:</strong> ${err instanceof Error ? err.message : 'N/A'}</p>
                    <div style="margin-top:15px;padding:10px;background:#f8f9fa;border-radius:4px;font-family:monospace;font-size:12px;max-height:300px;overflow-y:auto;text-align:left;">
                      <strong>XML BPMN (primeiros 1000 caracteres):</strong><br/>
                      ${xmlText.substring(0, 1000)}...
                    </div>
                  </details>
                </div>
              `;
            } else {
              throw new Error('Não foi possível carregar o XML para fallback');
            }
          } catch (fallbackError) {
            if (ref.current) {
              ref.current.innerHTML = `<div style="padding:20px;color:#f55;text-align:center;">
                <h3>Erro ao carregar BPMN</h3>
                <p>${err instanceof Error ? err.message : 'Erro desconhecido'}</p>
                <p><strong>Erro no fallback:</strong> ${fallbackError instanceof Error ? fallbackError.message : 'N/A'}</p>
                <details style="margin-top:10px;text-align:left;max-width:500px;margin:10px auto;">
                  <summary>Detalhes técnicos</summary>
                  <p><strong>URL BPMN:</strong> ${bpmnUrl}</p>
                  <p><strong>URL Descrições:</strong> ${descriptionsUrl}</p>
                  <p><strong>Erro:</strong> ${err instanceof Error ? err.stack : 'N/A'}</p>
                </details>
              </div>`;
            }
          }
        }
      }
    }

    load();

    return () => {
      try { 
        if (currentViewer) {
          currentViewer.destroy(); 
        }
      } catch (e) {
        console.error('Erro ao destruir viewer:', e);
      }
    };
  }, [bpmnUrl, descriptionsUrl, contentUrl]);

  // Funcoes de edicao
  const handleStartEdit = () => {
    // Garantir que todos os campos de array existam
    const initialData = selected ? { 
      ...selected,
      entradas: selected.entradas || [],
      saidas: selected.saidas || [],
      ferramentas: selected.ferramentas || [],
      passoAPasso: selected.passoAPasso || [],
      popItReferencia: selected.popItReferencia || [],
      observacoes: selected.observacoes || []
    } : {
      entradas: [],
      saidas: [],
      ferramentas: [],
      passoAPasso: [],
      popItReferencia: [],
      observacoes: []
    };
    setEditedData(initialData);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedData(null);
  };

  const handleSaveEdit = () => {
    
    if (selectedId && editedData) {
      setLocalEdits((prev: any) => {
        const newEdits = { ...prev, [selectedId]: editedData };
        
        // Salvar no localStorage com o valor mais recente
        try {
          const storageKey = `bpmn_edits_${bpmnUrl}`;
          localStorage.setItem(storageKey, JSON.stringify(newEdits));
        } catch (e) {
          console.error('[Storage] Erro ao salvar edições no localStorage:', e);
        }
        
        return newEdits;
      });
      
      setSelected(editedData);
      setIsEditing(false);
      setEditedData(null);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setEditedData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleArrayFieldChange = (field: string, index: number, value: string) => {
    setEditedData((prev: any) => {
      const array = [...(prev[field] || [])];
      array[index] = value;
      return { ...prev, [field]: array };
    });
  };

  const handleArrayFieldAdd = (field: string) => {
    setEditedData((prev: any) => ({
      ...prev,
      [field]: [...(prev[field] || []), '']
    }));
  };

  const handleArrayFieldRemove = (field: string, index: number) => {
    setEditedData((prev: any) => {
      const array = [...(prev[field] || [])];
      array.splice(index, 1);
      return { ...prev, [field]: array };
    });
  };

  // Carregar edições do localStorage ao montar
  React.useEffect(() => {
    try {
      const storageKey = `bpmn_edits_${bpmnUrl}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setLocalEdits(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Erro ao carregar edições do localStorage:', e);
    }
  }, [bpmnUrl]);

  // Listener global para parar arrastar/redimensionar quando soltar o mouse
  React.useEffect(() => {
    const handleMouseUp = () => {
      setIsResizing(false);
      setIsDragging(false);
      setResizeDirection('');
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        
        let newWidth = resizeStart.width;
        let newHeight = resizeStart.height;
        let newX = resizeStart.posX;
        let newY = resizeStart.posY;

        // Redimensionar baseado na direção
        switch (resizeDirection) {
          case 'e': // Direita
            newWidth = Math.max(400, resizeStart.width + deltaX);
            break;
          case 'w': // Esquerda
            newWidth = Math.max(400, resizeStart.width - deltaX);
            newX = resizeStart.posX + (resizeStart.width - newWidth);
            break;
          case 's': // Baixo
            newHeight = Math.max(300, resizeStart.height + deltaY);
            break;
          case 'n': // Cima
            newHeight = Math.max(300, resizeStart.height - deltaY);
            newY = resizeStart.posY + (resizeStart.height - newHeight);
            break;
          case 'se': // Sudeste
            newWidth = Math.max(400, resizeStart.width + deltaX);
            newHeight = Math.max(300, resizeStart.height + deltaY);
            break;
          case 'sw': // Sudoeste
            newWidth = Math.max(400, resizeStart.width - deltaX);
            newHeight = Math.max(300, resizeStart.height + deltaY);
            newX = resizeStart.posX + (resizeStart.width - newWidth);
            break;
          case 'ne': // Nordeste
            newWidth = Math.max(400, resizeStart.width + deltaX);
            newHeight = Math.max(300, resizeStart.height - deltaY);
            newY = resizeStart.posY + (resizeStart.height - newHeight);
            break;
          case 'nw': // Noroeste
            newWidth = Math.max(400, resizeStart.width - deltaX);
            newHeight = Math.max(300, resizeStart.height - deltaY);
            newX = resizeStart.posX + (resizeStart.width - newWidth);
            newY = resizeStart.posY + (resizeStart.height - newHeight);
            break;
        }

        // Limitar ao viewport
        if (newWidth > window.innerWidth - 20) newWidth = window.innerWidth - 20;
        if (newHeight > window.innerHeight - 20) newHeight = window.innerHeight - 20;
        if (newX < 0) { newWidth += newX; newX = 0; }
        if (newY < 0) { newHeight += newY; newY = 0; }

        setModalDimensions({ width: newWidth, height: newHeight });
        setModalPosition({ x: newX, y: newY });
      } else if (isDragging) {
        const newX = Math.max(0, Math.min(window.innerWidth - modalDimensions.width, e.clientX - dragStart.x));
        const newY = Math.max(0, Math.min(window.innerHeight - modalDimensions.height, e.clientY - dragStart.y));
        setModalPosition({ x: newX, y: newY });
      }
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, resizeDirection, resizeStart, dragStart, modalDimensions]);

  if (error) {
    return (
      <div className="w-full p-6 bg-orange-50 border border-orange-300 rounded-lg">
        <h3 className="text-lg font-semibold text-orange-800 mb-2">Erro ao carregar BPMN</h3>
        <p className="text-orange-700 mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Container do Diagrama */}
        <div className="lg:col-span-2">
          <div 
            ref={ref} 
            className="w-full bg-white rounded-lg border border-gray-200 overflow-hidden"
            style={{ 
              height: '80vh',
              minHeight: '700px',
              position: 'relative',
              backgroundColor: '#ffffff'
            }} 
          />
          
          {/* Indicador de status */}
          <div className="mt-2 text-xs text-gray-500 text-center">
            <p>Status: {viewer ? 'Diagrama carregado' : 'Carregando...'}</p>
          </div>
          
          {/* Instruções */}
          <div className="mt-3 text-xs text-gray-500 text-center">
            <p>Use <kbd className="px-1 py-0.5 bg-gray-100 rounded">Scroll do mouse</kbd> para zoom, <kbd className="px-1 py-0.5 bg-gray-100 rounded">Clique e arraste</kbd> para mover o diagrama</p>
          </div>
        </div>

        {/* Painel lateral */}
        <div className="lg:col-span-1">
          <div className="h-full min-h-[300px] bg-white border border-gray-200 rounded-lg p-4 shadow-sm overflow-y-auto max-h-[80vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-normal text-gray-900">Detalhes da atividade</h3>
              {selected && !isEditing && (
                <button
                  onClick={handleStartEdit}
                  className="px-4 py-1.5 text-sm font-medium bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Editar
                </button>
              )}
              {isEditing && (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="px-4 py-1.5 text-sm font-medium bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-1.5 text-sm font-medium bg-white text-gray-700 border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
            
            {!contentUrl && (
              <p className="text-sm text-gray-500">Nenhum conteúdo detalhado configurado.</p>
            )}
            {contentUrl && !selected && (
              <p className="text-sm text-gray-500">Clique em uma tarefa do diagrama para ver os detalhes. Clique duas vezes para abrir o popup.</p>
            )}
            {contentUrl && selected && !isEditing && (
              <div className="space-y-3" style={{ fontWeight: 'normal' }}>
                <div>
                  <p className="text-xs uppercase text-gray-500" style={{ fontWeight: 400 }}>Nome</p>
                  <p className="text-base text-gray-900" style={{ fontWeight: 400 }}>{selected.nome || selected.id}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500" style={{ fontWeight: 400 }}>Ator</p>
                  <p className="text-sm text-gray-800" style={{ fontWeight: 400 }}>{selected.ator || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500" style={{ fontWeight: 400 }}>Entradas</p>
                  <ul className="text-sm text-gray-800 list-disc list-inside space-y-1" style={{ fontWeight: 400 }}>
                    {(selected.entradas || []).length === 0 ? (
                      <li className="text-gray-400">Nenhuma entrada cadastrada</li>
                    ) : (
                      (selected.entradas || []).map((i: string, idx: number) => <li key={idx}>{i}</li>)
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500" style={{ fontWeight: 400 }}>Saídas</p>
                  <ul className="text-sm text-gray-800 list-disc list-inside space-y-1" style={{ fontWeight: 400 }}>
                    {(selected.saidas || []).length === 0 ? (
                      <li className="text-gray-400">Nenhuma saída cadastrada</li>
                    ) : (
                      (selected.saidas || []).map((i: string, idx: number) => <li key={idx}>{i}</li>)
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500" style={{ fontWeight: 400 }}>Ferramentas</p>
                  <ul className="text-sm text-gray-800 list-disc list-inside space-y-1" style={{ fontWeight: 400 }}>
                    {(selected.ferramentas || []).length === 0 ? (
                      <li className="text-gray-400">Nenhuma ferramenta cadastrada</li>
                    ) : (
                      (selected.ferramentas || []).map((i: string, idx: number) => <li key={idx}>{i}</li>)
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500" style={{ fontWeight: 400 }}>Passo a passo</p>
                  <ol className="text-sm text-gray-800 list-decimal list-inside space-y-1" style={{ fontWeight: 400 }}>
                    {(selected.passoAPasso || []).length === 0 ? (
                      <li className="text-gray-400 list-none">Nenhum passo cadastrado</li>
                    ) : (
                      (selected.passoAPasso || []).map((i: string, idx: number) => <li key={idx}>{i}</li>)
                    )}
                  </ol>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500" style={{ fontWeight: 400 }}>POP / IT</p>
                  <ul className="text-sm text-gray-800 list-disc list-inside space-y-1" style={{ fontWeight: 400 }}>
                    {(selected.popItReferencia || []).length === 0 ? (
                      <li className="text-gray-400">Nenhuma referência cadastrada</li>
                    ) : (
                      (selected.popItReferencia || []).map((i: string, idx: number) => <li key={idx}>{i}</li>)
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500" style={{ fontWeight: 400 }}>Observações</p>
                  <ul className="text-sm text-gray-800 list-disc list-inside space-y-1" style={{ fontWeight: 400 }}>
                    {(selected.observacoes || []).length === 0 ? (
                      <li className="text-gray-400">Nenhuma observação cadastrada</li>
                    ) : (
                      (selected.observacoes || []).map((i: string, idx: number) => <li key={idx}>{i}</li>)
                    )}
                  </ul>
                </div>
              </div>
            )}
            {contentUrl && isEditing && editedData && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase text-gray-500 font-normal block mb-1">Nome</label>
                  <input
                    type="text"
                    value={editedData.nome || ''}
                    onChange={(e) => handleFieldChange('nome', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-gray-500 font-normal block mb-1">Ator</label>
                  <input
                    type="text"
                    value={editedData.ator || ''}
                    onChange={(e) => handleFieldChange('ator', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-gray-500 font-normal block mb-1">Entradas</label>
                  {(editedData.entradas || []).map((item: string, idx: number) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => handleArrayFieldChange('entradas', idx, e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <button
                        onClick={() => handleArrayFieldRemove('entradas', idx)}
                        className="px-3 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md transition-all duration-150 font-medium text-sm"
                        title="Remover"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => handleArrayFieldAdd('entradas')}
                    className="text-sm font-medium text-orange-600 hover:text-orange-700 px-3 py-1 rounded-md hover:bg-orange-50 transition-all duration-150"
                  >
                    + Adicionar entrada
                  </button>
                </div>
                <div>
                  <label className="text-xs uppercase text-gray-500 font-normal block mb-1">Saídas</label>
                  {(editedData.saidas || []).map((item: string, idx: number) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => handleArrayFieldChange('saidas', idx, e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <button
                        onClick={() => handleArrayFieldRemove('saidas', idx)}
                        className="px-3 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md transition-all duration-150 font-medium text-sm"
                        title="Remover"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => handleArrayFieldAdd('saidas')}
                    className="text-sm font-medium text-orange-600 hover:text-orange-700 px-3 py-1 rounded-md hover:bg-orange-50 transition-all duration-150"
                  >
                    + Adicionar saída
                  </button>
                </div>
                <div>
                  <label className="text-xs uppercase text-gray-500 font-normal block mb-1">Ferramentas</label>
                  {(editedData.ferramentas || []).map((item: string, idx: number) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => handleArrayFieldChange('ferramentas', idx, e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <button
                        onClick={() => handleArrayFieldRemove('ferramentas', idx)}
                        className="px-3 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md transition-all duration-150 font-medium text-sm"
                        title="Remover"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => handleArrayFieldAdd('ferramentas')}
                    className="text-sm font-medium text-orange-600 hover:text-orange-700 px-3 py-1 rounded-md hover:bg-orange-50 transition-all duration-150"
                  >
                    + Adicionar ferramenta
                  </button>
                </div>
                <div>
                  <label className="text-xs uppercase text-gray-500 font-normal block mb-1">Passo a passo</label>
                  {(editedData.passoAPasso || []).map((item: string, idx: number) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <span className="text-sm text-gray-600 mt-2">{idx + 1}.</span>
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => handleArrayFieldChange('passoAPasso', idx, e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <button
                        onClick={() => handleArrayFieldRemove('passoAPasso', idx)}
                        className="px-3 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md transition-all duration-150 font-medium text-sm"
                        title="Remover"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => handleArrayFieldAdd('passoAPasso')}
                    className="text-sm font-medium text-orange-600 hover:text-orange-700 px-3 py-1 rounded-md hover:bg-orange-50 transition-all duration-150"
                  >
                    + Adicionar passo
                  </button>
                </div>
                <div>
                  <label className="text-xs uppercase text-gray-500 font-normal block mb-1">POP / IT</label>
                  {(editedData.popItReferencia || []).map((item: string, idx: number) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => handleArrayFieldChange('popItReferencia', idx, e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <button
                        onClick={() => handleArrayFieldRemove('popItReferencia', idx)}
                        className="px-3 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md transition-all duration-150 font-medium text-sm"
                        title="Remover"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => handleArrayFieldAdd('popItReferencia')}
                    className="text-sm font-medium text-orange-600 hover:text-orange-700 px-3 py-1 rounded-md hover:bg-orange-50 transition-all duration-150"
                  >
                    + Adicionar referência
                  </button>
                </div>
                <div>
                  <label className="text-xs uppercase text-gray-500 font-normal block mb-1">Observações</label>
                  {(editedData.observacoes || []).map((item: string, idx: number) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <textarea
                        value={item}
                        onChange={(e) => handleArrayFieldChange('observacoes', idx, e.target.value)}
                        rows={2}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <button
                        onClick={() => handleArrayFieldRemove('observacoes', idx)}
                        className="px-3 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md transition-all duration-150 font-medium text-sm"
                        title="Remover"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => handleArrayFieldAdd('observacoes')}
                    className="text-sm font-medium text-orange-600 hover:text-orange-700 px-3 py-1 rounded-md hover:bg-orange-50 transition-all duration-150"
                  >
                    + Adicionar observação
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de detalhes (duplo clique) - Arrastável e Redimensionável */}
      {showModal && selected && (
        <div 
            className="fixed z-50 bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col pointer-events-auto"
            style={{ 
              left: `${modalPosition.x}px`,
              top: `${modalPosition.y}px`,
              width: `${modalDimensions.width}px`,
              height: `${modalDimensions.height}px`,
              minWidth: '400px',
              minHeight: '300px',
              maxWidth: '95vw',
              maxHeight: '95vh'
            }}
          >
            {/* Barra superior - área de arrastar */}
            <div 
              className="drag-handle flex justify-between items-center p-4 border-b border-gray-200 bg-gradient-to-r from-orange-400 to-orange-500 text-white cursor-move select-none"
              onMouseDown={(e) => {
                // Só arrastar se não estiver clicando em um botão ou handle de redimensionamento
                const target = e.target as HTMLElement;
                if (target.closest('button') || target.closest('.resize-handle')) {
                  return;
                }
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
                setDragStart({
                  x: e.clientX - modalPosition.x,
                  y: e.clientY - modalPosition.y
                });
              }}
            >
              <h2 className="text-xl font-semibold">{selected.nome || selected.id}</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setModalDimensions({ width: 1000, height: 700 });
                  setModalPosition({ x: 0, y: 0 });
                }}
                className="w-8 h-8 flex items-center justify-center text-white hover:bg-white hover:bg-opacity-20 rounded-lg text-2xl transition-all duration-200"
                title="Fechar"
              >
                ×
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-normal text-gray-500 uppercase mb-2">Ator</h3>
                  <p className="text-base text-gray-900">{selected.ator || '-'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-normal text-gray-500 uppercase mb-2">Entradas</h3>
                  <ul className="text-base text-gray-900 list-disc list-inside space-y-1">
                    {(selected.entradas || []).length === 0 ? (
                      <li className="text-gray-400">Nenhuma entrada cadastrada</li>
                    ) : (
                      (selected.entradas || []).map((i: string, idx: number) => <li key={idx}>{i}</li>)
                    )}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-normal text-gray-500 uppercase mb-2">Saídas</h3>
                  <ul className="text-base text-gray-900 list-disc list-inside space-y-1">
                    {(selected.saidas || []).length === 0 ? (
                      <li className="text-gray-400">Nenhuma saída cadastrada</li>
                    ) : (
                      (selected.saidas || []).map((i: string, idx: number) => <li key={idx}>{i}</li>)
                    )}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-normal text-gray-500 uppercase mb-2">Ferramentas</h3>
                  <ul className="text-base text-gray-900 list-disc list-inside space-y-1">
                    {(selected.ferramentas || []).length === 0 ? (
                      <li className="text-gray-400">Nenhuma ferramenta cadastrada</li>
                    ) : (
                      (selected.ferramentas || []).map((i: string, idx: number) => <li key={idx}>{i}</li>)
                    )}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-normal text-gray-500 uppercase mb-2">Passo a passo</h3>
                  <ol className="text-base text-gray-900 list-decimal list-inside space-y-1">
                    {(selected.passoAPasso || []).length === 0 ? (
                      <li className="text-gray-400 list-none">Nenhum passo cadastrado</li>
                    ) : (
                      (selected.passoAPasso || []).map((i: string, idx: number) => <li key={idx}>{i}</li>)
                    )}
                  </ol>
                </div>
                <div>
                  <h3 className="text-sm font-normal text-gray-500 uppercase mb-2">POP / IT</h3>
                  <ul className="text-base text-gray-900 list-disc list-inside space-y-1">
                    {(selected.popItReferencia || []).length === 0 ? (
                      <li className="text-gray-400">Nenhuma referência cadastrada</li>
                    ) : (
                      (selected.popItReferencia || []).map((i: string, idx: number) => <li key={idx}>{i}</li>)
                    )}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-normal text-gray-500 uppercase mb-2">Observações</h3>
                  <ul className="text-base text-gray-900 list-disc list-inside space-y-1">
                    {(selected.observacoes || []).length === 0 ? (
                      <li className="text-gray-400">Nenhuma observação cadastrada</li>
                    ) : (
                      (selected.observacoes || []).map((i: string, idx: number) => <li key={idx}>{i}</li>)
                    )}
                  </ul>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowModal(false);
                  setModalDimensions({ width: 800, height: 600 });
                  setModalPosition({ x: 0, y: 0 });
                }}
                className="px-6 py-2 bg-gradient-to-r from-gray-700 to-gray-800 text-white rounded-lg hover:from-gray-800 hover:to-gray-900 transition-all duration-200 shadow-sm hover:shadow-md font-medium"
              >
                Fechar
              </button>
            </div>
            
            {/* Handles de redimensionamento nas bordas - só redimensiona quando clica e arrasta */}
            {/* Borda superior */}
            <div
              className="resize-handle absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-orange-300 hover:bg-opacity-30 z-10"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsResizing(true);
                setIsDragging(false); // Garantir que não está arrastando
                setResizeDirection('n');
                setResizeStart({
                  x: e.clientX,
                  y: e.clientY,
                  width: modalDimensions.width,
                  height: modalDimensions.height,
                  posX: modalPosition.x,
                  posY: modalPosition.y
                });
              }}
            />
            {/* Borda inferior */}
            <div
              className="resize-handle absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-orange-300 hover:bg-opacity-30 z-10"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsResizing(true);
                setIsDragging(false);
                setResizeDirection('s');
                setResizeStart({
                  x: e.clientX,
                  y: e.clientY,
                  width: modalDimensions.width,
                  height: modalDimensions.height,
                  posX: modalPosition.x,
                  posY: modalPosition.y
                });
              }}
            />
            {/* Borda esquerda */}
            <div
              className="resize-handle absolute top-0 bottom-0 left-0 w-2 cursor-ew-resize hover:bg-orange-300 hover:bg-opacity-30 z-10"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsResizing(true);
                setIsDragging(false);
                setResizeDirection('w');
                setResizeStart({
                  x: e.clientX,
                  y: e.clientY,
                  width: modalDimensions.width,
                  height: modalDimensions.height,
                  posX: modalPosition.x,
                  posY: modalPosition.y
                });
              }}
            />
            {/* Borda direita */}
            <div
              className="resize-handle absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize hover:bg-orange-300 hover:bg-opacity-30 z-10"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsResizing(true);
                setIsDragging(false);
                setResizeDirection('e');
                setResizeStart({
                  x: e.clientX,
                  y: e.clientY,
                  width: modalDimensions.width,
                  height: modalDimensions.height,
                  posX: modalPosition.x,
                  posY: modalPosition.y
                });
              }}
            />
            {/* Cantos */}
            <div
              className="resize-handle absolute top-0 left-0 w-4 h-4 cursor-nwse-resize hover:bg-orange-300 hover:bg-opacity-30 z-10"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsResizing(true);
                setIsDragging(false);
                setResizeDirection('nw');
                setResizeStart({
                  x: e.clientX,
                  y: e.clientY,
                  width: modalDimensions.width,
                  height: modalDimensions.height,
                  posX: modalPosition.x,
                  posY: modalPosition.y
                });
              }}
            />
            <div
              className="resize-handle absolute top-0 right-0 w-4 h-4 cursor-nesw-resize hover:bg-orange-300 hover:bg-opacity-30 z-10"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsResizing(true);
                setIsDragging(false);
                setResizeDirection('ne');
                setResizeStart({
                  x: e.clientX,
                  y: e.clientY,
                  width: modalDimensions.width,
                  height: modalDimensions.height,
                  posX: modalPosition.x,
                  posY: modalPosition.y
                });
              }}
            />
            <div
              className="resize-handle absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize hover:bg-orange-300 hover:bg-opacity-30 z-10"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsResizing(true);
                setIsDragging(false);
                setResizeDirection('sw');
                setResizeStart({
                  x: e.clientX,
                  y: e.clientY,
                  width: modalDimensions.width,
                  height: modalDimensions.height,
                  posX: modalPosition.x,
                  posY: modalPosition.y
                });
              }}
            />
            <div
              className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize hover:bg-orange-300 hover:bg-opacity-30 z-10"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsResizing(true);
                setIsDragging(false);
                setResizeDirection('se');
                setResizeStart({
                  x: e.clientX,
                  y: e.clientY,
                  width: modalDimensions.width,
                  height: modalDimensions.height,
                  posX: modalPosition.x,
                  posY: modalPosition.y
                });
              }}
            />
          </div>
      )}
    </div>
  );
}
