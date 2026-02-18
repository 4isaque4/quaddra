'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components';
import BpmnViewer from '@/components/BpmnViewer';
import DiagramaSelector from '../../../processos/[slug]/DiagramaSelector';
import { useTheme } from '@/contexts/ThemeContext';

type ProcessoInfo = {
  slug: string;
  nome: string;
  file: string;
  arquivo: string;
  categoria: string;
  bpmnUrl: string;
  descriptionsUrl: string;
  contentUrl: string;
};

type ValeShopProcessoPageClientProps = {
  processo: ProcessoInfo;
  outros: ProcessoInfo[];
};

export default function ValeShopProcessoPageClient({ processo, outros }: ValeShopProcessoPageClientProps) {
  const { theme } = useTheme();
  const [displayName, setDisplayName] = useState(processo.nome);

  useEffect(() => {
    try {
      const storageKey = 'process_custom_names';
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const names = JSON.parse(stored);
        const customName = names[processo.slug];
        if (customName) {
          setDisplayName(customName);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar nome customizado:', e);
    }
  }, [processo.slug, processo.nome]);

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <Header />
      <main className="flex-1 min-h-0 pt-24 bg-gray-50 overflow-hidden flex flex-col">
        <div className="px-4 md:px-6 py-3 h-full flex flex-col gap-3 overflow-hidden">
          <div className="flex-shrink-0 bg-white/95 rounded-xl px-4 py-3 border" style={{ borderColor: '#e5e7eb' }}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <Link
                href="/vale-shop/processos"
                className="inline-flex items-center font-semibold transition-colors"
                style={{ color: theme.colors.primary }}
                onMouseEnter={(e) => (e.currentTarget.style.color = theme.colors.primaryHover)}
                onMouseLeave={(e) => (e.currentTarget.style.color = theme.colors.primary)}
              >
                ← Voltar aos Processos
              </Link>

              {outros.length > 0 && (
                <div className="min-w-[260px]">
                  <DiagramaSelector processoAtual={processo} outrosDiagramas={outros} />
                </div>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-2">{displayName}</h1>
            <p className="text-sm md:text-base text-gray-600">
              Pasta: <span className="font-semibold">{processo.categoria}</span>
            </p>
          </div>

          <div className="bg-white rounded-xl border flex-1 min-h-0 overflow-hidden" style={{ borderColor: '#dbe2ea' }}>
            <BpmnViewer bpmnUrl={processo.bpmnUrl} descriptionsUrl={processo.descriptionsUrl} contentUrl={processo.contentUrl} />
          </div>
        </div>
      </main>
    </div>
  );
}
