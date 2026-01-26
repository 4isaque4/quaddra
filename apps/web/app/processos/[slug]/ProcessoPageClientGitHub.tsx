'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header, Footer, ProcessSettingsModal } from '@/components';
import BpmnViewer from '@/components/BpmnViewer';

type ProcessoGitHub = {
  slug: string;
  nome: string;
  pasta: string;
  arquivo: string;
  subdiagramas: string[];
  documentos: Record<string, string[]>;
  bpmnUrl: string;
  categoria: string;
};

type ProcessoPageClientGitHubProps = {
  processo: ProcessoGitHub;
};

export default function ProcessoPageClientGitHub({ processo }: ProcessoPageClientGitHubProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [displayName, setDisplayName] = useState(processo.nome);
  const [diagramaAtual, setDiagramaAtual] = useState<'principal' | string>('principal');
  const [bpmnUrlAtual, setBpmnUrlAtual] = useState(processo.bpmnUrl);

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

  const selecionarDiagrama = (tipo: 'principal' | string) => {
    if (tipo === 'principal') {
      setBpmnUrlAtual(processo.bpmnUrl);
      setDiagramaAtual('principal');
    } else {
      // Subdiagrama
      const url = `/api/github-bpmn/${processo.pasta}/subdiagramas/${tipo}`;
      setBpmnUrlAtual(url);
      setDiagramaAtual(tipo);
    }
  };

  return (
    <>
      <Header />
      <main className="pt-20 min-h-screen bg-gray-50">
        <div className="container py-16">
          <div className="mb-8">
            <Link 
              href="/processos"
              className="inline-flex items-center text-orange-500 hover:text-orange-600 font-semibold mb-4"
            >
              ← Voltar aos Processos
            </Link>
            
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                  {displayName}
                </h1>
                <p className="text-xl text-gray-600 mb-4">
                  Categoria: <span className="font-semibold">{processo.categoria}</span>
                </p>
                <div className="text-sm text-gray-500">
                  Arquivo: {processo.arquivo}
                </div>
                {diagramaAtual !== 'principal' && (
                  <div className="mt-2 text-sm text-orange-600 font-semibold">
                    📍 Visualizando subprocesso: {diagramaAtual}
                  </div>
                )}
              </div>
              
              {/* Botão de Configurações */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="ml-4 px-5 py-2.5 bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-lg hover:from-orange-500 hover:to-orange-600 transition-all duration-200 shadow-sm hover:shadow-md font-medium"
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

            {/* Navegação de Diagramas */}
            {processo.subdiagramas.length > 0 && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  📁 Diagramas Disponíveis
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => selecionarDiagrama('principal')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      diagramaAtual === 'principal'
                        ? 'bg-orange-500 text-white shadow-md'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    📊 Processo Principal
                  </button>
                  {processo.subdiagramas.map((sub) => (
                    <button
                      key={sub}
                      onClick={() => selecionarDiagrama(sub)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        diagramaAtual === sub
                          ? 'bg-orange-500 text-white shadow-md'
                          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                      }`}
                    >
                      📄 {sub}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Viewer BPMN */}
            <BpmnViewer 
              key={bpmnUrlAtual} // Força re-render ao trocar diagrama
              bpmnUrl={bpmnUrlAtual}
              descriptionsUrl="/api/descriptions"
              contentUrl={`/api/content/${processo.slug}`}
              documentos={processo.documentos}
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
