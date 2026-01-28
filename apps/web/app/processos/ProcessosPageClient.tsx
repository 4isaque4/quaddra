'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header, Footer } from '@/components';

interface ProcessoItem {
  file: string;
  slug: string;
  nome: string;
  categoria: string;
}

interface ProcessosPageClientProps {
  processosIniciais: ProcessoItem[];
}

interface Notificacao {
  tipo: 'sucesso' | 'erro';
  mensagem: string;
}

export default function ProcessosPageClient({ processosIniciais }: ProcessosPageClientProps) {
  const [processos, setProcessos] = useState<ProcessoItem[]>(processosIniciais);
  const [filtro, setFiltro] = useState('');
  const [deletando, setDeletando] = useState<string | null>(null);
  const [processoADeletar, setProcessoADeletar] = useState<ProcessoItem | null>(null);
  const [notificacao, setNotificacao] = useState<Notificacao | null>(null);

  // Filtrar processos
  const processosFiltrados = processos.filter(p =>
    p.nome.toLowerCase().includes(filtro.toLowerCase()) ||
    p.categoria.toLowerCase().includes(filtro.toLowerCase())
  );

  // Agrupar por categoria
  const grupos: { [key: string]: ProcessoItem[] } = {};
  processosFiltrados.forEach(processo => {
    if (!grupos[processo.categoria]) {
      grupos[processo.categoria] = [];
    }
    grupos[processo.categoria].push(processo);
  });

  const handleDeleteClick = (processo: ProcessoItem) => {
    setProcessoADeletar(processo);
  };

  // Auto-fechar notificação após 5 segundos
  useEffect(() => {
    if (notificacao) {
      const timer = setTimeout(() => {
        setNotificacao(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notificacao]);

  const mostrarNotificacao = (tipo: 'sucesso' | 'erro', mensagem: string) => {
    setNotificacao({ tipo, mensagem });
  };

  const handleConfirmDelete = async () => {
    if (!processoADeletar) return;

    setDeletando(processoADeletar.slug);
    
    try {
      const response = await fetch(`/api/delete-processo?slug=${encodeURIComponent(processoADeletar.slug)}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao deletar processo');
      }

      // Remover da lista
      setProcessos(processos.filter(p => p.slug !== processoADeletar.slug));
      setProcessoADeletar(null);
      
      mostrarNotificacao('sucesso', `Processo "${processoADeletar.nome}" deletado com sucesso!`);
      
      // Recarregar a página após 2 segundos para garantir que os dados estejam atualizados
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error('Erro ao deletar:', error);
      mostrarNotificacao('erro', error.message || 'Erro ao deletar processo');
    } finally {
      setDeletando(null);
    }
  };

  return (
    <>
      <Header />
      <main className="pt-20 min-h-screen bg-gray-50">
        <div className="container py-16">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Processos BPMN
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Visualize e analise os processos de negócio da Quaddra
            </p>

            {/* Barra de Busca */}
            <div className="max-w-2xl mx-auto mb-8">
              <input
                type="text"
                placeholder="Buscar por nome ou categoria..."
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="w-full px-6 py-4 text-lg border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none transition-colors"
              />
              {filtro && (
                <p className="mt-2 text-gray-600">
                  {processosFiltrados.length} processo(s) encontrado(s)
                </p>
              )}
            </div>
          </div>

          {Object.keys(grupos).length === 0 ? (
            <div className="text-center py-16">
              <p className="text-xl text-gray-600">
                {filtro ? 'Nenhum processo encontrado' : 'Nenhum processo disponível'}
              </p>
            </div>
          ) : (
            Object.keys(grupos).sort().map((categoria) => (
              <div key={categoria} className="mb-12">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 border-b-2 border-orange-500 pb-2">
                  {categoria}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {grupos[categoria].map((processo) => (
                    <div
                      key={processo.slug}
                      className="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                    >
                      <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">
                          {processo.nome}
                        </h3>
                        <div className="flex gap-2">
                          <Link
                            href={`/processos/${processo.slug}`}
                            className="flex-1 inline-block bg-orange-500 hover:bg-orange-600 text-white text-center px-6 py-3 rounded-lg font-semibold transition-colors"
                          >
                            Ver Processo
                          </Link>
                          <button
                            onClick={() => handleDeleteClick(processo)}
                            disabled={deletando === processo.slug}
                            className="px-4 py-3 bg-gray-200 hover:bg-orange-100 text-gray-700 hover:text-orange-600 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Deletar processo"
                          >
                            {deletando === processo.slug ? (
                              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          <div className="text-center mt-16">
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

      {/* Notificação Toast */}
      {notificacao && (
        <div className="fixed top-24 right-4 z-50 animate-slide-in">
          <div className={`rounded-lg shadow-2xl p-6 max-w-md ${
            notificacao.tipo === 'sucesso' 
              ? 'bg-orange-50 border-2 border-orange-500' 
              : 'bg-orange-50 border-2 border-orange-500'
          }`}>
            <div className="flex items-start gap-4">
              {notificacao.tipo === 'sucesso' ? (
                <svg className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <div className="flex-1">
                <p className="font-semibold text-gray-900">
                  {notificacao.tipo === 'sucesso' ? 'Sucesso!' : 'Erro!'}
                </p>
                <p className="text-gray-700 mt-1">{notificacao.mensagem}</p>
              </div>
              <button
                onClick={() => setNotificacao(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação */}
      {processoADeletar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Confirmar Deleção
            </h3>
            <p className="text-gray-600 mb-6">
              Tem certeza que deseja deletar o processo <strong>&quot;{processoADeletar.nome}&quot;</strong>?
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Esta ação irá deletar o processo do site e do GitHub. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setProcessoADeletar(null)}
                disabled={!!deletando}
                className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={!!deletando}
                className="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {deletando ? 'Deletando...' : 'Deletar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
