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
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 pt-20 md:pt-24 pb-6">
        <div className="px-3 sm:px-4 md:px-6 py-3 flex flex-col gap-3">
          <div className="bg-white/95 rounded-xl px-3 sm:px-4 py-3 border" style={{ borderColor: '#e5e7eb' }}>
            <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
              <Link
                href="/vale-shop/processos"
                className="inline-flex items-center text-sm sm:text-base font-semibold transition-colors"
                style={{ color: theme.colors.primary }}
                onMouseEnter={(e) => (e.currentTarget.style.color = theme.colors.primaryHover)}
                onMouseLeave={(e) => (e.currentTarget.style.color = theme.colors.primary)}
              >
                ← Voltar aos Processos
              </Link>

              {outros.length > 0 && (
                <div className="w-full sm:w-auto sm:min-w-[260px]">
                  <DiagramaSelector processoAtual={processo} outrosDiagramas={outros} />
                </div>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mt-2 break-words">{displayName}</h1>
            <p className="text-xs sm:text-sm md:text-base text-gray-600">
              Pasta: <span className="font-semibold">{processo.categoria}</span>
            </p>
          </div>

          <div className="bg-white rounded-xl border h-[85vh] md:h-[88vh] overflow-hidden flex flex-col" style={{ borderColor: '#dbe2ea' }}>
            <BpmnViewer bpmnUrl={processo.bpmnUrl} descriptionsUrl={processo.descriptionsUrl} contentUrl={processo.contentUrl} />
          </div>
        </div>
      </main>
    </div>
  );
}
