'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Header } from '@/components';
import BpmnViewer from '@/components/BpmnViewer';
import DiagramaSelector from './DiagramaSelector';
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

type ProcessoPageClientProps = {
  processo: ProcessoInfo;
  outros: ProcessoInfo[];
};

export default function ProcessoPageClient({ processo, outros }: ProcessoPageClientProps) {
  const { theme } = useTheme();
  const pathname = usePathname();
  const basePath = pathname?.startsWith('/vale-shop') ? '/vale-shop' : '';

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
    <div className="min-h-screen md:h-screen md:overflow-hidden flex flex-col">
      <Header />
      <main className="flex-1 min-h-0 pt-20 md:pt-24 bg-gray-50 flex flex-col md:overflow-hidden">
        <div className="container md:h-full py-3 px-3 sm:px-4 flex flex-col gap-2 min-h-0 md:overflow-hidden">
          <div className="flex-shrink-0 mb-1">
            <Link
              href={`${basePath}/processos`}
              className="inline-flex items-center text-sm sm:text-base font-semibold mb-2 transition-colors"
              style={{ color: theme.colors.primary }}
              onMouseEnter={(e) => (e.currentTarget.style.color = theme.colors.primaryHover)}
              onMouseLeave={(e) => (e.currentTarget.style.color = theme.colors.primary)}
            >
              ← Voltar aos Processos
            </Link>

            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-1 break-words">{displayName}</h1>
            <p className="text-xs sm:text-sm text-gray-600">
              Processo localizado em: <span className="font-semibold">{processo.categoria}</span>
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg flex-1 min-h-[60vh] md:min-h-0 flex flex-col p-2 sm:p-3 overflow-hidden">
            {outros.length > 0 && (
              <div className="flex-shrink-0 mb-2">
                <DiagramaSelector processoAtual={processo} outrosDiagramas={outros} />
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <BpmnViewer bpmnUrl={processo.bpmnUrl} descriptionsUrl={processo.descriptionsUrl} contentUrl={processo.contentUrl} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
