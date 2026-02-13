'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BpmnJS from 'bpmn-js/dist/bpmn-navigated-viewer.development.js';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import { useTheme } from '@/contexts/ThemeContext';

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

const arrayFields: Array<keyof ElementContent> = [
  'entradas',
  'saidas',
  'ferramentas',
  'passoAPasso',
  'regrasDeNegocio',
  'popItReferencia',
  'observacoes',
  'textosAssociados',
];

function toText(v: any): string {
  return typeof v === 'string' ? v : '';
}

function normalizeArray(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => String(item || '').trim()).filter(Boolean);
}

function normalizeElementContent(raw: any, fallback: { id: string; nome: string; tipo?: string }): ElementContent {
  return {
    id: raw?.id || fallback.id,
    nome: raw?.nome || fallback.nome,
    tipo: raw?.tipo || fallback.tipo,
    ator: toText(raw?.ator),
    entradas: normalizeArray(raw?.entradas),
    saidas: normalizeArray(raw?.saidas),
    ferramentas: normalizeArray(raw?.ferramentas),
    passoAPasso: normalizeArray(raw?.passoAPasso),
    regrasDeNegocio: normalizeArray(raw?.regrasDeNegocio),
    popItReferencia: normalizeArray(raw?.popItReferencia),
    observacoes: normalizeArray(raw?.observacoes),
    textoFormatado: toText(raw?.textoFormatado),
    textosAssociados: normalizeArray(raw?.textosAssociados),
  };
}

export default function BpmnViewer({ bpmnUrl, descriptionsUrl, contentUrl }: BpmnViewerProps) {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const [viewer, setViewer] = useState<any>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ElementContent | null>(null);
  const [editedData, setEditedData] = useState<ElementContent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const storageKey = useMemo(() => `bpmn_edits_${bpmnUrl}`, [bpmnUrl]);

  const getLocalEdits = useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [storageKey]);

  const applyBizagiColors = (instance: any) => {
    try {
      const elementRegistry = instance.get('elementRegistry');
      for (const el of elementRegistry.getAll()) {
        const bo = el.businessObject;
        const attrs = bo?.di?.$attrs || {};
        const fill = attrs['bioc:fill'] || attrs['bizagi:fillColor'] || attrs['color:background-color'] || attrs['bi:bgColor'];
        const stroke = attrs['bioc:stroke'] || attrs['bizagi:strokeColor'] || attrs['color:border-color'] || attrs['bi:borderColor'];
        if (!fill && !stroke) continue;
        const gfx = elementRegistry.getGraphics(el.id);
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
  };

  const avoidTextOverlap = (instance: any) => {
    try {
      const elementRegistry = instance.get('elementRegistry');
      for (const el of elementRegistry.getAll()) {
        if (!/Task$/i.test(el.type || '')) continue;
        const gfx = elementRegistry.getGraphics(el.id);
        const label = gfx?.querySelector('text');
        if (!label) continue;

        const currentX = Number(label.getAttribute('x') || 0);
        if (currentX < 20) {
          label.setAttribute('x', String(currentX + 18));
        }

        const iconCandidates = gfx?.querySelectorAll('.djs-visual g path, .djs-visual g rect');
        iconCandidates?.forEach((n: Element) => {
          const shape = n as SVGElement;
          if (shape.closest('.djs-label')) return;
          shape.setAttribute('opacity', shape.getAttribute('opacity') || '0.8');
        });
      }
    } catch (e) {
      console.warn('[BPMN] Falha ao ajustar sobreposição de texto:', e);
    }
  };

  const collectAssociationTexts = (instance: any): Record<string, string[]> => {
    const map: Record<string, string[]> = {};
    try {
      const elementRegistry = instance.get('elementRegistry');
      for (const el of elementRegistry.getAll()) {
        const bo = el.businessObject;
        if (el.type !== 'bpmn:Association') continue;
        const targetId = bo?.targetRef?.id;
        const sourceText = bo?.sourceRef?.text || bo?.sourceRef?.businessObject?.text || bo?.sourceRef?.name;
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

    let currentViewer: any = null;
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

        if (!isAlive || !canvasRef.current) return;

        currentViewer = new (BpmnJS as any)({ container: canvasRef.current });
        setViewer(currentViewer);

        await currentViewer.importXML(xml);

        const canvas = currentViewer.get('canvas');
        canvas.zoom('fit-viewport');

        applyBizagiColors(currentViewer);
        avoidTextOverlap(currentViewer);

        const flat = descriptions?.elements || descriptions?.processes?.[Object.keys(descriptions?.processes || {})[0]]?.elements || {};
        const contentById = content?.elements || {};
        const associationTexts = collectAssociationTexts(currentViewer);
        const eventBus = currentViewer.get('eventBus');

        eventBus.on('element.dblclick', 100, (e: any) => {
          const id = e.element?.id;
          if (!id) return;
          const bo = e.element.businessObject;

          const fallback = {
            id,
            nome: flat?.[id]?.name || bo?.name || id,
            tipo: e.element.type,
          };

          const fromContent = normalizeElementContent(contentById[id], fallback);
          const fromLocal = normalizeElementContent(getLocalEdits()[id], fallback);

          const merged = normalizeElementContent(
            {
              ...EMPTY_CONTENT,
              ...fromContent,
              ...fromLocal,
              textosAssociados: [...(fromLocal.textosAssociados || fromContent.textosAssociados || []), ...(associationTexts[id] || [])],
              textoFormatado: fromLocal.textoFormatado || fromContent.textoFormatado || bo?.documentation?.[0]?.text || '',
            },
            fallback,
          );

          setSelected(merged);
          setEditedData(merged);
          setIsEditing(false);
          setShowModal(true);
        });
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar diagrama');
      }
    };

    load();

    return () => {
      isAlive = false;
      if (currentViewer) {
        try {
          currentViewer.destroy();
        } catch {
          // noop
        }
      }
    };
  }, [bpmnUrl, descriptionsUrl, contentUrl, getLocalEdits]);

  const saveEdits = () => {
    if (!editedData) return;
    try {
      const edits = getLocalEdits();
      edits[editedData.id] = editedData;
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
      const arr = [...normalizeArray((prev as any)[field])];
      arr[idx] = value;
      return { ...prev, [field]: arr } as ElementContent;
    });
  };

  const addArrayItem = (field: keyof ElementContent) => {
    setEditedData((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: [...normalizeArray((prev as any)[field]), ''] } as ElementContent;
    });
  };

  const removeArrayItem = (field: keyof ElementContent, idx: number) => {
    setEditedData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [field]: normalizeArray((prev as any)[field]).filter((_, i) => i !== idx),
      } as ElementContent;
    });
  };

  if (error) {
    return <div className="rounded-lg border p-4 text-sm" style={{ borderColor: theme.colors.accent }}>{error}</div>;
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .quaddra-bpmn .djs-container,
        .quaddra-bpmn svg { background: #fff !important; }
        .quaddra-bpmn .djs-element text { paint-order: stroke; stroke: #fff; stroke-width: 0.5px; }
      ` }} />
      <div className="quaddra-bpmn rounded-xl border bg-white" style={{ borderColor: '#dbe2ea' }}>
        <div ref={canvasRef} className="w-full" style={{ height: 'calc(100vh - 240px)', minHeight: 620 }} />
      </div>

      <p className="mt-2 text-xs text-gray-500 text-center">
        Status: {viewer ? 'Diagrama carregado' : 'Carregando...'} • Dê duplo clique para abrir detalhes
      </p>

      {showModal && selected && editedData && (
        <div className="fixed inset-0 z-[120] bg-black/35 p-4 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[88vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#e5e7eb' }}>
              <div>
                <p className="text-xs uppercase tracking-wide" style={{ color: '#6b7280' }}>{selected.tipo || 'Elemento BPMN'}</p>
                <h3 className="text-xl font-semibold" style={{ color: theme.colors.text }}>{selected.nome}</h3>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 text-white rounded-md"
                    style={{ backgroundColor: theme.colors.primary }}
                  >
                    Editar
                  </button>
                ) : (
                  <>
                    <button onClick={() => { setEditedData(selected); setIsEditing(false); }} className="px-4 py-2 rounded-md border">Cancelar</button>
                    <button
                      onClick={saveEdits}
                      className="px-4 py-2 text-white rounded-md"
                      style={{ backgroundColor: theme.colors.primary }}
                    >
                      Salvar
                    </button>
                  </>
                )}
                <button onClick={() => { setShowModal(false); setIsEditing(false); }} className="px-3 py-2 rounded-md border">Fechar</button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field title="Ator" readValue={selected.ator || '-'} editing={isEditing}>
                <input className="w-full border rounded px-3 py-2" value={editedData.ator || ''} onChange={(e) => setEditedData({ ...editedData, ator: e.target.value })} />
              </Field>

              <ArrayField title="Entradas" readValues={selected.entradas || []} editing={isEditing} values={editedData.entradas || []} onAdd={() => addArrayItem('entradas')} onChange={(i, v) => updateArrayItem('entradas', i, v)} onRemove={(i) => removeArrayItem('entradas', i)} />
              <ArrayField title="Saídas" readValues={selected.saidas || []} editing={isEditing} values={editedData.saidas || []} onAdd={() => addArrayItem('saidas')} onChange={(i, v) => updateArrayItem('saidas', i, v)} onRemove={(i) => removeArrayItem('saidas', i)} />
              <ArrayField title="Ferramentas" readValues={selected.ferramentas || []} editing={isEditing} values={editedData.ferramentas || []} onAdd={() => addArrayItem('ferramentas')} onChange={(i, v) => updateArrayItem('ferramentas', i, v)} onRemove={(i) => removeArrayItem('ferramentas', i)} />
              <ArrayField title="Passo a passo" readValues={selected.passoAPasso || []} editing={isEditing} values={editedData.passoAPasso || []} onAdd={() => addArrayItem('passoAPasso')} onChange={(i, v) => updateArrayItem('passoAPasso', i, v)} onRemove={(i) => removeArrayItem('passoAPasso', i)} />
              <ArrayField title="Regra de negócio" readValues={selected.regrasDeNegocio || []} editing={isEditing} values={editedData.regrasDeNegocio || []} onAdd={() => addArrayItem('regrasDeNegocio')} onChange={(i, v) => updateArrayItem('regrasDeNegocio', i, v)} onRemove={(i) => removeArrayItem('regrasDeNegocio', i)} />
              <ArrayField title="POP / IT" readValues={selected.popItReferencia || []} editing={isEditing} values={editedData.popItReferencia || []} onAdd={() => addArrayItem('popItReferencia')} onChange={(i, v) => updateArrayItem('popItReferencia', i, v)} onRemove={(i) => removeArrayItem('popItReferencia', i)} />
              <ArrayField title="Observações" readValues={selected.observacoes || []} editing={isEditing} values={editedData.observacoes || []} onAdd={() => addArrayItem('observacoes')} onChange={(i, v) => updateArrayItem('observacoes', i, v)} onRemove={(i) => removeArrayItem('observacoes', i)} />
              <ArrayField title="Textos associados" readValues={selected.textosAssociados || []} editing={isEditing} values={editedData.textosAssociados || []} onAdd={() => addArrayItem('textosAssociados')} onChange={(i, v) => updateArrayItem('textosAssociados', i, v)} onRemove={(i) => removeArrayItem('textosAssociados', i)} />

              <Field title="Texto formatado" readValue={selected.textoFormatado || '-'} editing={isEditing} full>
                <textarea className="w-full border rounded px-3 py-2 min-h-[120px]" value={editedData.textoFormatado || ''} onChange={(e) => setEditedData({ ...editedData, textoFormatado: e.target.value })} />
              </Field>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ title, readValue, editing, children, full = false }: { title: string; readValue: string; editing: boolean; children: React.ReactNode; full?: boolean }) {
  return (
    <section className={full ? 'md:col-span-2' : ''}>
      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{title}</p>
      {editing ? children : <p className="text-sm text-gray-800 whitespace-pre-wrap">{readValue}</p>}
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
          <ul className="list-disc ml-5 text-sm text-gray-800 space-y-1">{readValues.map((item, i) => <li key={`${title}-${i}`}>{item}</li>)}</ul>
        ) : (
          <p className="text-sm text-gray-400">Nenhum item</p>
        )}
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-wide text-gray-500">{title}</p>
        <button type="button" className="text-xs px-2 py-1 rounded border" onClick={onAdd}>+ Adicionar</button>
      </div>
      <div className="space-y-2">
        {values.map((item, idx) => (
          <div key={`${title}-edit-${idx}`} className="flex gap-2">
            <input className="flex-1 border rounded px-3 py-2 text-sm" value={item} onChange={(e) => onChange(idx, e.target.value)} />
            <button type="button" className="px-2 border rounded text-sm" onClick={() => onRemove(idx)}>x</button>
          </div>
        ))}
      </div>
    </section>
  );
}
