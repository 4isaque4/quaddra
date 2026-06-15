'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BpmnJS from 'bpmn-js/dist/bpmn-navigated-viewer.development.js';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import { useTheme } from '@/contexts/ThemeContext';
import { extractBpmnTextFromXml } from '@/lib/bpmn-text-extract';
import { createBpmnViewerOptions, type BpmnViewerOptions } from '@/lib/bpmn-viewer-config';

type BpmnViewerProps = {
  bpmnUrl: string;
  descriptionsUrl: string;
  contentUrl?: string;
};

type ElementContent = {
  id: string;
  nome: string;
  tipo?: string;
  ator?: string;
  entradas?: string[];
  saidas?: string[];
  ferramentas?: string[];
  passoAPasso?: string[];
  regrasDeNegocio?: string[];
  popItReferencia?: string[];
  observacoes?: string[];
  textoFormatado?: string;
  textosAssociados?: string[];
};

const EMPTY_CONTENT = {
  ator: '',
  entradas: [],
  saidas: [],
  ferramentas: [],
  passoAPasso: [],
  regrasDeNegocio: [],
  popItReferencia: [],
  observacoes: [],
  textoFormatado: '',
  textosAssociados: [],
};

function toText(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function normalizeArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => String(item || '').trim()).filter(Boolean);
}

function getElementDiAttrs(el: unknown): Record<string, string> {
  try {
    const element = el as { di?: { $attrs?: Record<string, string> } };
    return element?.di?.$attrs || {};
  } catch {
    return {};
  }
}

function normalizeElementContent(raw: unknown, fallback: { id: string; nome: string; tipo?: string }): ElementContent {
  const r = raw as Record<string, unknown> | null | undefined;
  return {
    id: (r?.id as string) || fallback.id,
    nome: (r?.nome as string) || fallback.nome,
    tipo: (r?.tipo as string) || fallback.tipo,
    ator: toText(r?.ator),
    entradas: normalizeArray(r?.entradas),
    saidas: normalizeArray(r?.saidas),
    ferramentas: normalizeArray(r?.ferramentas),
    passoAPasso: normalizeArray(r?.passoAPasso),
    regrasDeNegocio: normalizeArray(r?.regrasDeNegocio),
    popItReferencia: normalizeArray(r?.popItReferencia),
    observacoes: normalizeArray(r?.observacoes),
    textoFormatado: toText(r?.textoFormatado),
    textosAssociados: normalizeArray(r?.textosAssociados),
  };
}

export default function BpmnViewer({ bpmnUrl, descriptionsUrl, contentUrl }: BpmnViewerProps) {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const [viewer, setViewer] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ElementContent | null>(null);
  const [editedData, setEditedData] = useState<ElementContent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [modalSize, setModalSize] = useState({ width: 920, height: 520 });
  const [modalPosition, setModalPosition] = useState<{ x: number; y: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const resizeOriginRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const dragOriginRef = useRef<{ x: number; y: number; modalX: number; modalY: number } | null>(null);
  const highlightedShapesRef = useRef<SVGElement[]>([]);

  const storageKey = useMemo(() => `bpmn_edits_${bpmnUrl}`, [bpmnUrl]);

  const getLocalEdits = useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }, [storageKey]);

  const getBizagiColorsFromBo = useCallback((bo: Record<string, unknown>): { fill?: string; stroke?: string } => {
    const out: { fill?: string; stroke?: string } = {};
    try {
      const ext = (bo.get as (k: string) => unknown)?.('extensionElements') ?? bo.extensionElements;
      if (!ext || typeof ext !== 'object') return out;
      const extObj = ext as Record<string, unknown>;
      const values = (extObj.get as (k: string) => unknown)?.('values') ?? extObj.values;
      const arr = Array.isArray(values) ? values : [];
      const walk = (items: unknown[]): void => {
        for (const it of items) {
          if (!it || typeof it !== 'object') continue;
          const obj = it as Record<string, unknown>;
          const name = (obj.get as (k: string) => unknown)?.('name') ?? obj.name;
          const value = (obj.get as (k: string) => unknown)?.('value') ?? obj.value;
          if (name === 'bgColor' && typeof value === 'string') out.fill = value;
          if (name === 'borderColor' && typeof value === 'string') out.stroke = value;
          const inner = (obj.get as (k: string) => unknown)?.('values') ?? obj.values;
          if (Array.isArray(inner)) walk(inner);
        }
      };
      walk(arr);
    } catch {
      // ignore
    }
    return out;
  }, []);

  const applyBizagiColors = useCallback((instance: { get: (name: string) => unknown }) => {
    try {
      const elementRegistry = instance.get('elementRegistry') as { getAll: () => Array<{ id: string; di?: { $attrs?: Record<string, string> }; businessObject?: Record<string, unknown> & { get?: (k: string) => unknown }; type?: string }>; getGraphics: (el: { id: string }) => Element | null };
      for (const el of elementRegistry.getAll()) {
        const bo = el.businessObject;
        if (!bo) continue;
        const attrs = getElementDiAttrs(el);
        let fill = attrs['bioc:fill'] || attrs['bizagi:fillColor'] || attrs['color:background-color'] || attrs['bi:bgColor'] || attrs['fill'];
        let stroke = attrs['bioc:stroke'] || attrs['bizagi:strokeColor'] || attrs['color:border-color'] || attrs['bi:borderColor'] || attrs['stroke'];
        if (!fill && !stroke) {
          const fromExt = getBizagiColorsFromBo(bo as Record<string, unknown>);
          fill = fromExt.fill ?? fill;
          stroke = fromExt.stroke ?? stroke;
        }
        if (!fill && !stroke) {
          const elType = (el.type || (bo as { $type?: string }).$type) || '';
          if (elType.includes('Lane') || elType.includes('Participant')) {
            fill = fill || '#E8F4FC';
            stroke = stroke || '#B3D4E8';
          }
          if (elType.includes('TextAnnotation')) {
            fill = fill || '#E8E8E8';
            stroke = stroke || '#B0B0B0';
          }
        }
        if (!fill && !stroke) continue;
        const gfx = elementRegistry.getGraphics(el);
        const visual = gfx?.querySelector('.djs-visual');
        if (!visual) continue;

        const targets = visual.querySelectorAll('rect, path, polygon, circle, ellipse');
        targets.forEach((node: Element) => {
          const shape = node as SVGElement;
          if (fill) shape.setAttribute('fill', fill);
          if (stroke) {
            shape.setAttribute('stroke', stroke);
            shape.setAttribute('stroke-width', shape.getAttribute('stroke-width') || '2');
          }
        });
      }
    } catch (e) {
      console.warn('[BPMN] Falha ao aplicar cores Bizagi:', e);
    }
  }, [getBizagiColorsFromBo]);


  const restoreHighlightedShapes = useCallback(() => {
    highlightedShapesRef.current.forEach((shape) => {
      const originalFill = shape.getAttribute('data-original-fill');
      const originalStyleFill = shape.getAttribute('data-original-style-fill');
      if (originalFill === '__none__') {
        shape.removeAttribute('fill');
      } else if (originalFill != null) {
        shape.setAttribute('fill', originalFill);
      }

      if (originalStyleFill === '__none__') {
        shape.style.removeProperty('fill');
      } else if (originalStyleFill != null) {
        shape.style.setProperty('fill', originalStyleFill);
      }

      shape.removeAttribute('data-original-fill');
      shape.removeAttribute('data-original-style-fill');
    });
    highlightedShapesRef.current = [];
  }, []);

  const applySelectionFill = useCallback((instance: { get: (name: string) => unknown }, elementId: string) => {
    try {
      const elementRegistry = instance.get('elementRegistry') as { get: (id: string) => { id: string } | null; getGraphics: (el: { id: string }) => Element | null };
      const target = elementRegistry.get(elementId);
      if (!target) return;
      const gfx = elementRegistry.getGraphics(target);
      const visual = gfx?.querySelector('.djs-visual');
      if (!visual) return;

      const candidates = visual.querySelectorAll('rect, path, polygon, circle, ellipse');
      candidates.forEach((node) => {
        const shape = node as SVGGraphicsElement;
        if (shape.closest('.djs-label')) return;
        try {
          const box = shape.getBBox();
          if (box.width < 18 && box.height < 18) return;
        } catch {
          // ignore bbox errors
        }

        if (!shape.hasAttribute('data-original-fill')) {
          const currentFill = shape.getAttribute('fill');
          shape.setAttribute('data-original-fill', currentFill ?? '__none__');
        }
        if (!shape.hasAttribute('data-original-style-fill')) {
          const currentStyleFill = shape.style.fill;
          shape.setAttribute('data-original-style-fill', currentStyleFill || '__none__');
        }
        shape.setAttribute('fill', '#E3F2FD');
        shape.style.setProperty('fill', '#E3F2FD', 'important');
        highlightedShapesRef.current.push(shape as unknown as SVGElement);
      });
    } catch (e) {
      console.warn('[BPMN] Falha ao aplicar preenchimento de seleção:', e);
    }
  }, []);

  const removeAssociationsFromXml = (xml: string): string => {
    try {
      return xml
        .replace(/<bpmn:association\b[^>]*\/>/gi, '')
        .replace(/<bpmn:Association\b[^>]*\/>/g, '')
        .replace(/<bpmn:Association\b[\s\S]*?<\/bpmn:Association>/g, '');
    } catch {
      return xml;
    }
  };

  const collectAssociationTexts = (instance: { get: (name: string) => unknown }): Record<string, string[]> => {
    const map: Record<string, string[]> = {};
    try {
      const elementRegistry = instance.get('elementRegistry') as { getAll: () => Array<{ type?: string; businessObject?: { targetRef?: { id: string }; sourceRef?: { text?: string; name?: string; businessObject?: { text?: string } } } }> };
      for (const el of elementRegistry.getAll()) {
        const bo = el.businessObject;
        if (el.type !== 'bpmn:Association') continue;
        const targetId = bo?.targetRef?.id;
        const src = (bo as { sourceRef?: { text?: string; name?: string; businessObject?: { text?: string } } })?.sourceRef;
        const sourceText = src?.text || src?.businessObject?.text || src?.name;
        const text = typeof sourceText === 'string' ? sourceText.trim() : '';
        if (!targetId || !text) continue;
        map[targetId] = [...(map[targetId] || []), text];
      }
    } catch (e) {
      console.warn('[BPMN] Falha ao coletar textos de associação:', e);
    }
    return map;
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    type ViewerInstance = { destroy: () => void; importXML: (xml: string) => Promise<unknown>; get: (name: string) => unknown };
    let currentViewer: ViewerInstance | null = null;
    let isAlive = true;

    const load = async () => {
      try {
        setError('');

        const [xmlResp, descResp, contentResp] = await Promise.all([
          fetch(bpmnUrl),
          fetch(descriptionsUrl),
          contentUrl ? fetch(contentUrl).catch(() => null) : Promise.resolve(null),
        ]);

        if (!xmlResp.ok) throw new Error(`BPMN não encontrado: ${bpmnUrl}`);

        const xml = await xmlResp.text();
        const descriptions = descResp.ok ? await descResp.json() : {};
        const content = contentResp && contentResp.ok ? await contentResp.json() : {};
        const bpmnTextFromXml = extractBpmnTextFromXml(xml);

        if (!isAlive || !canvasRef.current) return;

        const viewerInstance = new (BpmnJS as unknown as new (opts: BpmnViewerOptions) => ViewerInstance)(
          createBpmnViewerOptions(canvasRef.current)
        );
        currentViewer = viewerInstance;
        setViewer(viewerInstance);

        try {
          await viewerInstance.importXML(xml);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error || '');
          if (!/referenced by <bpmn:Association/i.test(message)) {
            throw error;
          }

          console.warn('[BPMN] XML com associações inválidas. Tentando importar sem associações.');
          const sanitizedXml = removeAssociationsFromXml(xml);
          await viewerInstance.importXML(sanitizedXml);
        }

        const canvas = viewerInstance.get('canvas') as {
          zoom: (arg?: string | number) => number | void;
        };
        canvas.zoom('fit-viewport');
        const minZoom = 0.28;
        setTimeout(() => {
          try {
            const current = (canvas.zoom as () => number)?.();
            if (typeof current !== 'number' || (current > 0 && current < minZoom)) {
              canvas.zoom(minZoom);
            }
          } catch {
            canvas.zoom(minZoom);
          }
        }, 50);

        applyBizagiColors(viewerInstance);
        setTimeout(() => {
          try {
            canvas.zoom('fit-viewport');
            const currentZoom = (canvas.zoom as () => number)?.();
            if (typeof currentZoom === 'number' && currentZoom > 0 && currentZoom < minZoom) {
              canvas.zoom(minZoom);
            }
          } catch (e) {
            console.warn('[BPMN] Falha no ajuste tardio de renderização:', e);
          }
        }, 280);

        const flat = descriptions?.elements || descriptions?.processes?.[Object.keys(descriptions?.processes || {})[0]]?.elements || {};
        const contentById = content?.elements || {};
        const associationTexts = collectAssociationTexts(viewerInstance);
        const eventBus = viewerInstance.get('eventBus') as { on: (event: string, priority: number, handler: (e: { element?: { id: string; businessObject?: { documentation?: Array<{ text?: string }>; name?: string }; type?: string } }) => void) => void };
        const canvasSvc = viewerInstance.get('canvas') as { addMarker: (id: string, marker: string) => void; removeMarker: (id: string, marker: string) => void };

        eventBus.on('element.hover', 100, (e: { element?: { id: string } }) => {
          if (!e?.element?.id) return;
          canvasSvc.addMarker(e.element.id, 'bpmn-hovered');
        });
        eventBus.on('element.out', 100, (e: { element?: { id: string } }) => {
          if (!e?.element?.id) return;
          canvasSvc.removeMarker(e.element.id, 'bpmn-hovered');
        });
        eventBus.on('element.click', 100, (e: { element?: { id: string; labelTarget?: { id?: string } } }) => {
          const id = e?.element?.labelTarget?.id || e?.element?.id;
          if (!id) return;
          const elementRegistry = viewerInstance.get('elementRegistry') as { getAll: () => Array<{ id: string }> };
          restoreHighlightedShapes();
          for (const el of elementRegistry.getAll()) {
            canvasSvc.removeMarker(el.id, 'bpmn-selected');
          }
          canvasSvc.addMarker(id, 'bpmn-selected');
          applySelectionFill(viewerInstance, id);
        });

        eventBus.on('element.dblclick', 100, (e: { element?: { id: string; businessObject?: { id?: string; documentation?: Array<{ text?: string }>; name?: string }; type?: string } }) => {
          const bo = e.element?.businessObject;
          const id = (bo?.id ?? e.element?.id) ?? '';
          if (!id) return;

          const fallback = {
            id,
            nome: (flat as Record<string, { name?: string }>)?.[id]?.name || bo?.name || id,
            tipo: e.element?.type,
          };

          const fromContent = normalizeElementContent((contentById as Record<string, unknown>)?.[id], fallback);
          const fromLocal = normalizeElementContent(getLocalEdits()[id], fallback);

          const fromXml = bpmnTextFromXml[id] || {};
          const allAssoc = [
            ...(fromLocal.textosAssociados || []),
            ...(fromContent.textosAssociados || []),
            ...(associationTexts[id] || []),
            ...(fromXml.textosAssociados || []),
          ];
          const textosAssociadosUniq = [...new Set(allAssoc.filter(Boolean))];
          const merged = normalizeElementContent(
            {
              ...EMPTY_CONTENT,
              ...fromContent,
              ...fromLocal,
              textoFormatado: fromLocal.textoFormatado || fromContent.textoFormatado || fromXml.textoFormatado || bo?.documentation?.[0]?.text || '',
              textosAssociados: textosAssociadosUniq,
            },
            fallback,
          );

          setSelected(merged);
          setEditedData(merged);
          setIsEditing(false);
          setShowModal(true);
          setModalPosition({
            x: Math.max(16, (typeof window !== 'undefined' ? window.innerWidth : 1024) / 2 - 460),
            y: Math.max(16, (typeof window !== 'undefined' ? window.innerHeight : 768) / 2 - 260),
          });
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar diagrama');
      }
    };

    load();

    return () => {
      isAlive = false;
      if (currentViewer) {
        try {
          restoreHighlightedShapes();
          currentViewer.destroy();
        } catch {
          // noop
        }
      }
    };
  }, [bpmnUrl, descriptionsUrl, contentUrl, getLocalEdits, applyBizagiColors, applySelectionFill, restoreHighlightedShapes]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (isDragging && dragOriginRef.current) {
        const origin = dragOriginRef.current;
        const dx = event.clientX - origin.x;
        const dy = event.clientY - origin.y;
        const w = modalSize.width;
        const h = modalSize.height;
        setModalPosition({
          x: Math.max(8, Math.min(window.innerWidth - w - 8, origin.modalX + dx)),
          y: Math.max(8, Math.min(window.innerHeight - h - 8, origin.modalY + dy)),
        });
      }
      if (isResizing && resizeOriginRef.current) {
        const deltaX = event.clientX - resizeOriginRef.current.x;
        const deltaY = event.clientY - resizeOriginRef.current.y;
        setModalSize({
          width: Math.max(360, Math.min(window.innerWidth - 40, resizeOriginRef.current.width + deltaX)),
          height: Math.max(280, Math.min(window.innerHeight - 40, resizeOriginRef.current.height + deltaY)),
        });
      }
    };
    const onUp = () => {
      setIsResizing(false);
      setIsDragging(false);
      resizeOriginRef.current = null;
      dragOriginRef.current = null;
    };
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isResizing, isDragging, modalSize.width, modalSize.height]);

  const saveEdits = () => {
    if (!editedData) return;
    try {
      const edits = getLocalEdits();
      (edits as Record<string, ElementContent>)[editedData.id] = editedData;
      localStorage.setItem(storageKey, JSON.stringify(edits));
      setSelected(editedData);
      setIsEditing(false);
    } catch {
      setError('Falha ao salvar alterações locais.');
    }
  };

  const updateArrayItem = (field: keyof ElementContent, idx: number, value: string) => {
    setEditedData((prev) => {
      if (!prev) return prev;
      const arr = [...normalizeArray((prev as Record<string, unknown>)[field])];
      arr[idx] = value;
      return { ...prev, [field]: arr } as ElementContent;
    });
  };

  const addArrayItem = (field: keyof ElementContent) => {
    setEditedData((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: [...normalizeArray((prev as Record<string, unknown>)[field]), ''] } as ElementContent;
    });
  };

  const removeArrayItem = (field: keyof ElementContent, idx: number) => {
    setEditedData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [field]: normalizeArray((prev as Record<string, unknown>)[field]).filter((_, i) => i !== idx),
      } as ElementContent;
    });
  };

  const getCanvasSvc = useCallback(() => {
    if (!viewer) return null;
    try {
      return (viewer as { get: (name: string) => unknown }).get('canvas') as {
        zoom: (arg?: string | number) => number | void;
        scroll: (delta: { dx?: number; dy?: number }) => void;
        viewbox: () => { width: number; height: number };
      };
    } catch {
      return null;
    }
  }, [viewer]);

  const scrollCanvas = useCallback((direction: 'up' | 'down') => {
    const canvas = getCanvasSvc();
    if (!canvas) return;
    try {
      const vb = canvas.viewbox();
      const step = Math.max(80, Math.round(vb.height * 0.35));
      canvas.scroll({ dy: direction === 'up' ? step : -step });
    } catch (e) {
      console.warn('[BPMN] Erro ao rolar diagrama:', e);
    }
  }, [getCanvasSvc]);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      window.scrollBy({
        top: event.deltaY,
        left: event.deltaX,
        behavior: 'auto',
      });
      event.preventDefault();
      event.stopPropagation();
    };

    canvasElement.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => canvasElement.removeEventListener('wheel', handleWheel, { capture: true } as AddEventListenerOptions);
  }, [viewer]);

  const zoomCanvas = useCallback((factor: number) => {
    const canvas = getCanvasSvc();
    if (!canvas) return;
    try {
      const current = (canvas.zoom as () => number)?.();
      const next = typeof current === 'number' && current > 0
        ? Math.max(0.15, Math.min(4, current * factor))
        : 1;
      canvas.zoom(next);
    } catch (e) {
      console.warn('[BPMN] Erro ao aplicar zoom:', e);
    }
  }, [getCanvasSvc]);

  const recenterCanvas = useCallback(() => {
    const canvas = getCanvasSvc();
    if (!canvas) return;
    try {
      canvas.zoom('fit-viewport');
      setTimeout(() => {
        try {
          const current = (canvas.zoom as () => number)?.();
          if (typeof current === 'number' && current < 0.28 && current > 0) canvas.zoom(0.28);
        } catch {
          canvas.zoom(0.28);
        }
      }, 50);
    } catch (e) {
      console.warn('[BPMN] Erro ao recentralizar:', e);
    }
  }, [getCanvasSvc]);

  if (error) {
    return <div className="rounded-lg border p-4 text-sm" style={{ borderColor: theme.colors.accent }}>{error}</div>;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <style dangerouslySetInnerHTML={{ __html: `
        .quaddra-bpmn .djs-container,
        .quaddra-bpmn .djs-canvas,
        .quaddra-bpmn svg { background: #fff !important; overflow: visible !important; }
        .quaddra-bpmn .djs-visual,
        .quaddra-bpmn .djs-element text,
        .quaddra-bpmn .djs-shape,
        .quaddra-bpmn .djs-canvas,
        .quaddra-bpmn .djs-container { overflow: visible !important; }
        .quaddra-bpmn .djs-element text { paint-order: stroke; stroke: #fff; stroke-width: 0.35px; fill: #1a1a1a; }
        .quaddra-bpmn .djs-element,
        .quaddra-bpmn .djs-element * { cursor: pointer !important; }
        .quaddra-bpmn .djs-element.bpmn-hovered .djs-visual > :first-child { filter: brightness(0.95); }
        .quaddra-bpmn .djs-element.bpmn-selected .djs-visual > :first-child { stroke: ${theme.colors.primary} !important; stroke-width: 3px !important; }
        .quaddra-bpmn .bjs-powered-by { display: none !important; }
        .quaddra-bpmn .djs-overlay-container { pointer-events: none; }
      ` }} />
      <div className="quaddra-bpmn rounded-lg border border-gray-200 bg-white flex-1 min-h-0 flex flex-col relative overflow-hidden">
        <div ref={canvasRef} className="w-full flex-1 min-h-[55vh] md:min-h-[420px]" />
        {viewer ? (
          <>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-gray-200 p-1.5">
              <button
                type="button"
                onClick={() => scrollCanvas('up')}
                className="w-9 h-9 flex items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
                title="Mover para cima"
                aria-label="Mover diagrama para cima"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
              </button>
              <button
                type="button"
                onClick={() => scrollCanvas('down')}
                className="w-9 h-9 flex items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
                title="Mover para baixo"
                aria-label="Mover diagrama para baixo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div className="h-px bg-gray-200 my-0.5" />
              <button
                type="button"
                onClick={() => zoomCanvas(1.2)}
                className="w-9 h-9 flex items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 transition-colors text-lg font-semibold"
                title="Aumentar zoom"
                aria-label="Aumentar zoom"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => zoomCanvas(1 / 1.2)}
                className="w-9 h-9 flex items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 transition-colors text-lg font-semibold"
                title="Diminuir zoom"
                aria-label="Diminuir zoom"
              >
                −
              </button>
            </div>
            <button
              type="button"
              onClick={recenterCanvas}
              className="absolute bottom-2 right-2 px-3 py-1.5 text-xs font-medium rounded-lg shadow-sm border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors z-10"
              title="Ajustar diagrama ao centro da tela"
            >
              Recentralizar
            </button>
          </>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-gray-400 text-center flex-shrink-0">
        {viewer ? 'Duplo clique no elemento — use as setas para navegar pelo fluxo' : 'Carregando...'}
      </p>

      {showModal && selected && editedData && (
        <div className="fixed inset-0 z-[120] pointer-events-none">
          <div
            className="bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col absolute border border-gray-100 pointer-events-auto"
            style={{
              width: modalSize.width,
              height: modalSize.height,
              maxWidth: '96vw',
              maxHeight: '92vh',
              left: modalPosition?.x ?? 24,
              top: modalPosition?.y ?? 24,
            }}
          >
            <div
              className={`px-6 py-4 flex items-center justify-between select-none text-white ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              style={{ backgroundColor: '#005EA8' }}
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                if ((e.target as HTMLElement).closest('button')) return;
                if (!modalPosition) return;
                e.preventDefault();
                setIsDragging(true);
                dragOriginRef.current = {
                  x: e.clientX,
                  y: e.clientY,
                  modalX: modalPosition.x,
                  modalY: modalPosition.y,
                };
              }}
            >
              <div>
                <p className="text-xs uppercase tracking-wide text-white/80">{selected.tipo || 'Elemento BPMN'}</p>
                <h3 className="text-xl font-semibold text-white">{selected.nome}</h3>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-white text-[#005EA8] rounded-lg font-medium hover:bg-gray-100 transition-colors"
                  >
                    Editar
                  </button>
                ) : (
                  <>
                    <button onClick={() => { setEditedData(selected); setIsEditing(false); }} className="px-4 py-2 rounded-lg border border-white/50 text-white hover:bg-white/10 transition-colors">Cancelar</button>
                    <button onClick={saveEdits} className="px-4 py-2 bg-[#FFD24A] text-gray-900 rounded-lg font-medium hover:bg-[#FFD24A]/90 transition-colors">
                      Salvar
                    </button>
                  </>
                )}
                <button onClick={() => { setShowModal(false); setIsEditing(false); }} className="px-3 py-2 rounded-lg border border-white/50 text-white hover:bg-white/10 transition-colors">Fechar</button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-4 gap-x-6 content-start bg-gray-50/50">
              <Field title="Ator" readValue={selected.ator || '-'} editing={isEditing}>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#005EA8]/20 focus:border-[#005EA8] outline-none" value={editedData.ator || ''} onChange={(e) => setEditedData({ ...editedData, ator: e.target.value })} />
              </Field>

              <ArrayField title="Entradas" readValues={selected.entradas || []} editing={isEditing} values={editedData.entradas || []} onAdd={() => addArrayItem('entradas')} onChange={(i, v) => updateArrayItem('entradas', i, v)} onRemove={(i) => removeArrayItem('entradas', i)} />
              <ArrayField title="Saídas" readValues={selected.saidas || []} editing={isEditing} values={editedData.saidas || []} onAdd={() => addArrayItem('saidas')} onChange={(i, v) => updateArrayItem('saidas', i, v)} onRemove={(i) => removeArrayItem('saidas', i)} />
              <ArrayField title="Ferramentas" readValues={selected.ferramentas || []} editing={isEditing} values={editedData.ferramentas || []} onAdd={() => addArrayItem('ferramentas')} onChange={(i, v) => updateArrayItem('ferramentas', i, v)} onRemove={(i) => removeArrayItem('ferramentas', i)} />
              <ArrayField title="Passo a passo" readValues={selected.passoAPasso || []} editing={isEditing} values={editedData.passoAPasso || []} onAdd={() => addArrayItem('passoAPasso')} onChange={(i, v) => updateArrayItem('passoAPasso', i, v)} onRemove={(i) => removeArrayItem('passoAPasso', i)} />
              <ArrayField title="Regra de negócio" readValues={selected.regrasDeNegocio || []} editing={isEditing} values={editedData.regrasDeNegocio || []} onAdd={() => addArrayItem('regrasDeNegocio')} onChange={(i, v) => updateArrayItem('regrasDeNegocio', i, v)} onRemove={(i) => removeArrayItem('regrasDeNegocio', i)} />
              <ArrayField title="POP / IT" readValues={selected.popItReferencia || []} editing={isEditing} values={editedData.popItReferencia || []} onAdd={() => addArrayItem('popItReferencia')} onChange={(i, v) => updateArrayItem('popItReferencia', i, v)} onRemove={(i) => removeArrayItem('popItReferencia', i)} />
              <ArrayField title="Observações" readValues={selected.observacoes || []} editing={isEditing} values={editedData.observacoes || []} onAdd={() => addArrayItem('observacoes')} onChange={(i, v) => updateArrayItem('observacoes', i, v)} onRemove={(i) => removeArrayItem('observacoes', i)} />

              {(selected.textoFormatado?.trim() ?? '') && (
                <Field title="Texto formatado (BPMN)" readValue={selected.textoFormatado ?? ''} editing={false} full>
                  <></>
                </Field>
              )}
              {(() => {
                const mainTrim = (selected.textoFormatado ?? '').replace(/\r\n/g, '\n').trim();
                const assocExtra = (selected.textosAssociados ?? []).filter(
                  (t) => t.replace(/\r\n/g, '\n').trim() !== mainTrim
                );
                return assocExtra.length > 0 ? (
                  <section className="md:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Textos de associação (BPMN)</p>
                    <ul className="list-disc ml-4 text-sm text-gray-800 space-y-1">
                      {assocExtra.map((item, i) => (
                        <li key={`assoc-${i}`}>{item}</li>
                      ))}
                    </ul>
                  </section>
                ) : null;
              })()}
            </div>
            <div
              className={`absolute right-0 bottom-0 z-20 w-8 h-8 flex items-center justify-center bg-[#005EA8] hover:bg-[#004a85] rounded-tl-lg cursor-nwse-resize select-none ${isResizing ? 'ring-2 ring-[#FFD24A] ring-offset-1' : ''}`}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsResizing(true);
                resizeOriginRef.current = {
                  x: event.clientX,
                  y: event.clientY,
                  width: modalSize.width,
                  height: modalSize.height,
                };
              }}
              title="Arraste para redimensionar"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ title, readValue, editing, children, full = false }: { title: string; readValue: string; editing: boolean; children: React.ReactNode; full?: boolean }) {
  return (
    <section className={full ? 'md:col-span-2' : ''}>
      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{title}</p>
      {editing ? children : <p className="text-sm text-gray-800 whitespace-pre-wrap py-2 px-0 border-b border-transparent">{readValue}</p>}
    </section>
  );
}

function ArrayField({ title, readValues, editing, values, onAdd, onChange, onRemove }: {
  title: string;
  readValues: string[];
  editing: boolean;
  values: string[];
  onAdd: () => void;
  onChange: (idx: number, value: string) => void;
  onRemove: (idx: number) => void;
}) {
  if (!editing) {
    return (
      <section>
        <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{title}</p>
        {readValues.length ? (
          <ul className="list-disc ml-4 text-sm text-gray-800 space-y-0.5">{readValues.map((item, i) => <li key={`${title}-${i}`}>{item}</li>)}</ul>
        ) : (
          <p className="text-sm text-gray-400 py-1">—</p>
        )}
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center gap-3 mb-2">
        <p className="text-xs uppercase tracking-wide text-gray-500">{title}</p>
        <button type="button" className="text-xs px-2 py-1.5 rounded-md border border-[#005EA8]/30 text-[#005EA8] hover:bg-[#005EA8]/5 transition-colors" onClick={onAdd}>+ Adicionar</button>
      </div>
      <div className="space-y-2">
        {values.length === 0 && <p className="text-xs text-gray-400">Nenhum item. Clique em + Adicionar.</p>}
        {values.map((item, idx) => (
          <div key={`${title}-edit-${idx}`} className="flex gap-2">
            <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#005EA8]/20 focus:border-[#005EA8]" value={item} onChange={(e) => onChange(idx, e.target.value)} />
            <button type="button" className="px-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors" onClick={() => onRemove(idx)}>Remover</button>
          </div>
        ))}
      </div>
    </section>
  );
}
