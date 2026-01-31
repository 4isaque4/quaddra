'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header, Footer } from '@/components';
import { useTheme } from '@/contexts/ThemeContext';

interface ProcessoItem {
  file: string;
  slug: string;
  nome: string;
  categoria: string;
}

interface ProcessosPageClientProps {
  processosIniciais: ProcessoItem[];
  basePath?: string;
}

interface Notificacao {
  tipo: 'sucesso' | 'erro';
  mensagem: string;
}

export default function ProcessosPageClient({ processosIniciais, basePath = '' }: ProcessosPageClientProps) {
  const { theme } = useTheme();
  
  // Debug: verificar qual tema está sendo usado
  useEffect(() => {
    console.log('🎨 Tema atual:', theme.name, 'Primary:', theme.colors.primary);
  }, [theme]);
  
  const [processos, setProcessos] = useState<ProcessoItem[]>(processosIniciais);
  const [filtro, setFiltro] = useState('');
  const [deletando, setDeletando] = useState<string | null>(null);
  const [processoADeletar, setProcessoADeletar] = useState<ProcessoItem | null>(null);
  const [notificacao, setNotificacao] = useState<Notificacao | null>(null);
  const [nomesCustomizados, setNomesCustomizados] = useState<Record<string, string>>({});

  // Carregar nomes customizados do localStorage
  useEffect(() => {
    try {
      const storageKey = 'process_custom_names';
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setNomesCustomizados(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Erro ao carregar nomes customizados:', e);
    }
  }, []);

  // Função para obter o nome de exibição (customizado ou original)
  const getDisplayName = (processo: ProcessoItem) => {
    return nomesCustomizados[processo.slug] || processo.nome;
  };

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
      
      mostrarNotificacao('sucesso', `Processo "${nomesCustomizados[processoADeletar.slug] || processoADeletar.nome}" deletado com sucesso!`);
      
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
        <div className="container py-12">
          {/* Header simples e direto */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Processos
            </h1>

            {/* Barra de Busca compacta */}
            <div className="max-w-xl">
              <input
                type="text"
                placeholder="Buscar..."
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none"
                style={{
                  borderColor: filtro ? theme.colors.primary : undefined,
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = theme.colors.primary;
                }}
                onBlur={(e) => {
                  if (!filtro) e.target.style.borderColor = '';
                }}
              />
              {filtro && (
                <p className="mt-2 text-sm text-gray-500">
                  {processosFiltrados.length} resultado(s)
                </p>
              )}
            </div>
          </div>

          {Object.keys(grupos).length === 0 ? (
            <div className="py-12">
              <p className="text-gray-500">
                {filtro ? 'Nenhum processo encontrado' : 'Nenhum processo disponível'}
              </p>
            </div>
          ) : (
            Object.keys(grupos).sort().map((categoria) => (
              <div key={categoria} className="mb-10">
                <h2 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-200">
                  {categoria}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {grupos[categoria].map((processo) => (
                    <div
                      key={processo.slug}
                      className="bg-white border border-gray-200 rounded-lg p-5 transition-colors"
                      style={{
                        borderColor: undefined,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = theme.colors.primary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '';
                      }}
                    >
                      <h3 className="text-base font-semibold text-gray-900 mb-3">
                        {getDisplayName(processo)}
                      </h3>
                      <div className="flex gap-2">
                        <Link
                          href={`${basePath}/processos/${processo.slug}`}
                          className="flex-1 text-white text-center px-4 py-2 rounded text-sm font-medium transition-colors"
                          style={{
                            backgroundColor: theme.colors.primary,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.primary;
                          }}
                        >
                          Abrir
                        </Link>
                        <button
                          onClick={() => handleDeleteClick(processo)}
                          disabled={deletando === processo.slug}
                          className="px-3 py-2 border border-gray-300 rounded transition-colors disabled:opacity-50"
                          title="Deletar"
                          style={{
                            borderColor: undefined,
                            color: undefined,
                          }}
                          onMouseEnter={(e) => {
                            if (deletando !== processo.slug) {
                              e.currentTarget.style.borderColor = theme.colors.primary;
                              e.currentTarget.style.color = theme.colors.primary;
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '';
                            e.currentTarget.style.color = '';
                          }}
                        >
                          {deletando === processo.slug ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          <div className="mt-12">
            <Link
              href="/"
              className="inline-block text-gray-600 text-sm font-medium transition-colors"
              style={{
                color: undefined,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = theme.colors.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '';
              }}
            >
              ← Voltar
            </Link>
          </div>
        </div>
      </main>
      <Footer />

      {/* Notificação Toast - Minimalista */}
      {notificacao && (
        <div className="fixed top-24 right-4 z-50 animate-slide-in">
          <div 
            className="bg-white shadow-lg p-4 max-w-sm"
            style={{
              borderLeft: `4px solid ${notificacao.tipo === 'sucesso' ? theme.colors.primary : '#EF4444'}`,
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{notificacao.mensagem}</p>
              </div>
              <button
                onClick={() => setNotificacao(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação - Minimalista */}
      {processoADeletar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Deletar processo?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{nomesCustomizados[processoADeletar.slug] || processoADeletar.nome}</strong>
            </p>
            <p className="text-xs text-gray-500 mb-6">
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setProcessoADeletar(null)}
                disabled={!!deletando}
                className="flex-1 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={!!deletando}
                className="flex-1 px-4 py-2 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: theme.colors.primary,
                }}
                onMouseEnter={(e) => {
                  if (!deletando) {
                    e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!deletando) {
                    e.currentTarget.style.backgroundColor = theme.colors.primary;
                  }
                }}
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
