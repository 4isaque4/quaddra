'use client';
import React, { useEffect, useRef, useState } from 'react';
import BpmnJS from 'bpmn-js';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

export default function BpmnViewer({ bpmnUrl, descriptionsUrl }: { bpmnUrl: string; descriptionsUrl: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [viewer, setViewer] = useState<any>(null);
  const [zoom, setZoom] = useState(100);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!ref.current) return;
    
    console.log('Iniciando BpmnViewer...');
    console.log('URLs:', { bpmnUrl, descriptionsUrl });
    
    let overlays: any, eventBus: any;
    let active: Record<string, any> = {};
    let currentViewer: any = null;

    function escapeHtml(s: any) {
      return String(s ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as any)[m]);
    }

    async function load() {
      try {
        // Verificar se o componente ainda está montado
        if (!ref.current) {
          console.log('Componente desmontado, abortando carregamento');
          return;
        }
        
        setError('');
        console.log('Carregando XML e descrições...');
        
        const [xmlResp, descResp] = await Promise.all([ fetch(bpmnUrl), fetch(descriptionsUrl) ]);
        
        if (!xmlResp.ok) {
          throw new Error('BPMN não encontrado: ' + bpmnUrl);
        }
        
        const xml = await xmlResp.text();
        const desc = descResp.ok ? await descResp.json() : {};
        
        console.log('XML carregado, tamanho:', xml.length);
        console.log('Descrições carregadas:', Object.keys(desc).length);
        
        // Verificar se o XML é válido
        if (!xml.includes('<definitions') || !xml.includes('</definitions>')) {
          throw new Error('XML BPMN inválido - não contém definições');
        }
        
        // 3. Criar o viewer
        console.log('🔧 Criando viewer BPMN...');
        if (ref.current) {
          currentViewer = new BpmnJS({
            container: ref.current
          });
          
          setViewer(currentViewer);
          console.log('✅ Viewer criado com sucesso');
        } else {
          throw new Error('Container não disponível');
        }
        
        if (currentViewer) {
          // Verificar novamente se o componente ainda está montado
          if (!ref.current) {
            console.log('Componente desmontado durante processamento, abortando');
            return;
          }
          
          console.log('Importando XML...');
          await currentViewer.importXML(xml);
          
          console.log('XML importado com sucesso, ajustando zoom...');
          try {
            const canvas = currentViewer.get('canvas');
            if (canvas && canvas.zoom) {
              canvas.zoom('fit-viewport');
              setZoom(100);
            }
          } catch (zoomError) {
            console.warn('Erro ao ajustar zoom inicial:', zoomError);
          }
          
          overlays = currentViewer.get('overlays');
          eventBus = currentViewer.get('eventBus');

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

          console.log('Configurando eventos...');
          eventBus.on('element.hover', 100, function(e: any) {
            const id = e.element.id;
            const info = flat[id];
            if (info && (info.description || info.name)) {
              const html = document.createElement('div');
              html.className = 'tooltip';
              html.innerHTML = `<div class="title">${escapeHtml(info.name || id)}</div>
                <div class="meta">${escapeHtml(info.file || '')}${info.processName ? ' • ' + escapeHtml(info.processName) : ''}</div>
                <div>${escapeHtml(info.description || '')}</div>`;
              if (active[id]) overlays.remove(active[id]);
              active[id] = overlays.add(id, { position: { top: -10, left: 0 }, html });
            }
          });

          eventBus.on('element.out', 100, function(e: any) {
            const id = e.element.id;
            if (active[id]) { overlays.remove(active[id]); delete active[id]; }
          });

          console.log('BPMN carregado com sucesso!');
          
          // Verificar se o diagrama está visível após um pequeno delay
          setTimeout(() => {
            if (ref.current && currentViewer) {
              const canvas = currentViewer.get('canvas');
              const elementRegistry = currentViewer.get('elementRegistry');
              const elements = elementRegistry.getAll();
              
              console.log('Verificação final - Elementos:', elements.length);
              console.log('Container ref:', ref.current);
              console.log('Container children:', ref.current.children.length);
              
              // Se não há elementos visíveis, mostrar mensagem
              if (elements.length === 0) {
                console.warn('Nenhum elemento encontrado no diagrama');
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

    load();

    return () => {
      try { 
        if (currentViewer) {
          console.log('Destruindo viewer...');
          currentViewer.destroy(); 
        }
      } catch (e) {
        console.error('Erro ao destruir viewer:', e);
      }
    };
  }, [bpmnUrl, descriptionsUrl]); // Removido 'viewer' das dependências

  const handleZoomIn = () => {
    if (viewer) {
      try {
        const canvas = viewer.get('canvas');
        if (canvas && typeof canvas.zoom === 'function') {
          const currentZoom = canvas.zoom();
          const newZoom = currentZoom * 1.2;
          canvas.zoom(newZoom);
          setZoom(Math.round(newZoom * 100));
        }
      } catch (error) {
        console.error('Erro no zoom in:', error);
      }
    }
  };

  const handleZoomOut = () => {
    if (viewer) {
      try {
        const canvas = viewer.get('canvas');
        if (canvas && typeof canvas.zoom === 'function') {
          const currentZoom = canvas.zoom();
          const newZoom = currentZoom * 0.8;
          canvas.zoom(newZoom);
          setZoom(Math.round(newZoom * 100));
        }
      } catch (error) {
        console.error('Erro no zoom out:', error);
      }
    }
  };

  const handleZoomFit = () => {
    if (viewer) {
      try {
        const canvas = viewer.get('canvas');
        if (canvas && typeof canvas.zoom === 'function') {
          canvas.zoom('fit-viewport');
          setZoom(100);
        }
      } catch (error) {
        console.error('Erro no zoom fit:', error);
      }
    }
  };

  if (error) {
    return (
      <div className="w-full p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-lg font-semibold text-red-800 mb-2">Erro ao carregar BPMN</h3>
        <p className="text-red-700 mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Controles de Zoom */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg border">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Zoom:</span>
          <span className="text-sm text-gray-600">{zoom}%</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleZoomOut}
            className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
            title="Zoom Out"
          >
            -
          </button>
          <button
            onClick={handleZoomFit}
            className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
            title="Ajustar à tela"
          >
            Ajustar
          </button>
          <button
            onClick={handleZoomIn}
            className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
            title="Zoom In"
          >
            +
          </button>
        </div>
      </div>
      
      {/* Container do Diagrama */}
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
        <p>Use os botões de zoom ou <kbd className="px-1 py-0.5 bg-gray-100 rounded">Ctrl + Scroll</kbd> para zoom, <kbd className="px-1 py-0.5 bg-gray-100 rounded">Clique e arraste</kbd> para mover o diagrama</p>
      </div>
    </div>
  );
}
