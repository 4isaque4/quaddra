'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Header, Footer, ProcessSettingsModal } from '@/components';
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
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [displayName, setDisplayName] = useState(processo.nome);

  useEffect(() => {
    // Carregar nome customizado do localStorage
    try {
      const storageKey = `process_custom_names`;
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
    <>
      <Header />
      <main className="pt-20 min-h-screen bg-gray-50">
        <div className="container py-16">
          <div className="mb-8">
            <Link 
              href={`${basePath}/processos`}
              className="inline-flex items-center font-semibold mb-4 transition-colors"
              style={{ color: theme.colors.primary }}
              onMouseEnter={(e) => e.currentTarget.style.color = theme.colors.primaryHover}
              onMouseLeave={(e) => e.currentTarget.style.color = theme.colors.primary}
            >
              ← Voltar aos Processos
            </Link>
            
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                  {displayName}
                </h1>
                <p className="text-xl text-gray-600 mb-4">
                  Processo localizado em: <span className="font-semibold">{processo.categoria}</span>
                </p>
                <div className="text-sm text-gray-500">
                  Arquivo: {processo.arquivo}
                </div>
              </div>
              
              {/* Botão de Configurações */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="ml-4 px-5 py-2.5 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md font-medium"
                style={{ backgroundColor: theme.colors.primary }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.primary;
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                }}
                title="Configurações do Processo"
              >
                Configurações
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Visualização do Processo
            </h2>
            {outros.length > 0 && (
              <div className="mb-4">
                <DiagramaSelector processoAtual={processo} outrosDiagramas={outros} />
              </div>
            )}
            <BpmnViewer 
              bpmnUrl={processo.bpmnUrl}
              descriptionsUrl={processo.descriptionsUrl}
              contentUrl={processo.contentUrl}
            />
          </div>

          <div className="text-center mt-12">
            <Link 
              href="/"
              className="inline-block bg-gray-600 hover:bg-gray-700 text-white px-8 py-4 rounded-lg font-semibold transition-all duration-300"
            >
              Voltar ao Início
            </Link>
          </div>
        </div>
      </main>
      <Footer />

      {/* Modal de Configurações */}
      <ProcessSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        processSlug={processo.slug}
        originalName={processo.nome}
        originalFileName={processo.arquivo}
      />
    </>
  );
}
