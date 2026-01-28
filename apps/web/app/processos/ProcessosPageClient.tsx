'use client';

import { useState } from 'react';
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

export default function ProcessosPageClient({ processosIniciais }: ProcessosPageClientProps) {
  const [processos, setProcessos] = useState<ProcessoItem[]>(processosIniciais);
  const [filtro, setFiltro] = useState('');
  const [deletando, setDeletando] = useState<string | null>(null);
  const [processoADeletar, setProcessoADeletar] = useState<ProcessoItem | null>(null);

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
      
      alert('Processo deletado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao deletar:', error);
      alert(error.message || 'Erro ao deletar processo');
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
                            {deletando === processo.slug ? '...' : '🗑️'}
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
