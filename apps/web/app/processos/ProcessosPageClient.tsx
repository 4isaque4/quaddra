'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Header, Footer } from '@/components';
import ProcessOrganizationModal from '@/components/ProcessOrganizationModal';
import ProcessSettingsModal from '@/components/ProcessSettingsModal';
import { useTheme } from '@/contexts/ThemeContext';
import { FolderTree, MoreVertical } from 'lucide-react';

const ORDER_STORAGE_KEY_PREFIX = 'quaddra_organize_order_';

type FolderKey = string;

interface ProcessoItem {
  file: string;
  slug: string;
  nome: string;
  categoria: string;
  folderPath?: string;
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
  const pathname = usePathname();
  
  const detectedBasePath = basePath || (pathname?.startsWith('/vale-shop') ? '/vale-shop' : '');
  const clientType = detectedBasePath.includes('vale-shop') ? 'valeshop' : 'quaddra';

  const [processos, setProcessos] = useState<ProcessoItem[]>(processosIniciais);

  useEffect(() => {
    setProcessos(processosIniciais);
  }, [processosIniciais]);

  const [filtro, setFiltro] = useState('');
  const [deletando, setDeletando] = useState<string | null>(null);
  const [processoADeletar, setProcessoADeletar] = useState<ProcessoItem | null>(null);
  const [notificacao, setNotificacao] = useState<Notificacao | null>(null);
  const [nomesCustomizados, setNomesCustomizados] = useState<Record<string, string>>({});
  const [isOrganizationModalOpen, setIsOrganizationModalOpen] = useState(false);
  const [settingsTarget, setSettingsTarget] = useState<ProcessoItem | null>(null);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'name' | 'rename'>('name');
  const [openMenuSlug, setOpenMenuSlug] = useState<string | null>(null);
  const [folderOrderMap, setFolderOrderMap] = useState<Record<string, string[]>>({});
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openMenuSlug) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuContainerRef.current && !menuContainerRef.current.contains(target)) {
        setOpenMenuSlug(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuSlug]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('process_custom_names');
      if (stored) setNomesCustomizados(JSON.parse(stored));
    } catch (e) {
      console.warn('Erro ao carregar nomes customizados:', e);
    }
  }, []);

  // Usar a mesma ordem do modal Organizar (localStorage) para refletir na listagem
  useEffect(() => {
    try {
      const key = `${ORDER_STORAGE_KEY_PREFIX}${clientType}`;
      const raw = localStorage.getItem(key);
      if (raw) setFolderOrderMap(JSON.parse(raw));
      else setFolderOrderMap({});
    } catch {
      setFolderOrderMap({});
    }
  }, [clientType, isOrganizationModalOpen]);

  const getDisplayName = (processo: ProcessoItem) => nomesCustomizados[processo.slug] || processo.nome;

  const processosFiltrados = useMemo(
    () =>
      processos.filter(
        (p) =>
          p.nome.toLowerCase().includes(filtro.toLowerCase()) ||
          p.categoria.toLowerCase().includes(filtro.toLowerCase()) ||
          (p.folderPath?.toLowerCase().includes(filtro.toLowerCase()) ?? false),
      ),
    [processos, filtro],
  );

  const gruposHierarquicos = useMemo(() => {
    type Subgrupo = { subpastaNome: string; folderKey: FolderKey; processos: ProcessoItem[] };
    const groups: Record<string, Subgrupo[]> = {};

    processosFiltrados.forEach((processo) => {
      const categoria = processo.categoria;
      const parts = processo.folderPath ? processo.folderPath.split('/') : [];
      const subpastaNome = parts.length > 1 ? parts.slice(1).join('/') : 'Raiz';
      const folderKey = `${categoria}/${subpastaNome}`;

      if (!groups[categoria]) groups[categoria] = [];
      let sub = groups[categoria].find((item) => item.subpastaNome === subpastaNome);
      if (!sub) {
        sub = { subpastaNome, folderKey, processos: [] };
        groups[categoria].push(sub);
      }
      sub.processos.push(processo);
    });

    const rootOrder = folderOrderMap[''] || [];
    const categoriasOrdenadas = Object.keys(groups).sort((a, b) => {
      const ia = rootOrder.indexOf(a);
      const ib = rootOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

    const result: Record<string, Subgrupo[]> = {};
    categoriasOrdenadas.forEach((categoria) => {
      const subgrupos = groups[categoria];
      const order = folderOrderMap[categoria] || [];
      subgrupos.sort((a, b) => {
        if (a.subpastaNome === 'Raiz') return -1;
        if (b.subpastaNome === 'Raiz') return 1;
        const pathA = `${categoria}/${a.subpastaNome}`;
        const pathB = `${categoria}/${b.subpastaNome}`;
        const ia = order.indexOf(pathA);
        const ib = order.indexOf(pathB);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.subpastaNome.localeCompare(b.subpastaNome);
      });
      result[categoria] = subgrupos;
    });

    return result;
  }, [processosFiltrados, folderOrderMap]);

  const mostrarNotificacao = (tipo: 'sucesso' | 'erro', mensagem: string) => setNotificacao({ tipo, mensagem });

  useEffect(() => {
    if (!notificacao) return;
    const timer = setTimeout(() => setNotificacao(null), 5000);
    return () => clearTimeout(timer);
  }, [notificacao]);

  const handleDeleteClick = (processo: ProcessoItem) => {
    setOpenMenuSlug(null);
    setProcessoADeletar(processo);
  };

  const handleOpenSettings = (processo: ProcessoItem, tab: 'name' | 'rename') => {
    setOpenMenuSlug(null);
    setSettingsInitialTab(tab);
    setSettingsTarget(processo);
  };

  const handleConfirmDelete = async () => {
    if (!processoADeletar) return;

    setDeletando(processoADeletar.slug);
    
    try {
      const response = await fetch(
        `/api/delete-processo?slug=${encodeURIComponent(processoADeletar.slug)}&clientType=${clientType}`,
        { method: 'DELETE' },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao deletar processo');
      }

      // Verificar se foi deletado do GitHub
      if (!result.deletedGitHub && result.githubError) {
        mostrarNotificacao('erro', 
          `Processo deletado localmente, mas erro ao deletar do GitHub: ${result.githubError}. ` +
          `O processo ainda existe no repositório.`
        );
        setProcessoADeletar(null);
        // Recarregar mesmo assim para atualizar a lista
        setTimeout(() => {
          window.location.reload();
        }, 3000);
        return;
      }

      setProcessos((prev) => prev.filter((p) => p.slug !== processoADeletar.slug));
      setProcessoADeletar(null);
      mostrarNotificacao('sucesso', `Processo "${getDisplayName(processoADeletar)}" deletado com sucesso!`);
      
      // Aguardar mais tempo para garantir que o GitHub propague as mudanças
      // e recarregar com cache-busting para forçar atualização
      setTimeout(() => {
        window.location.href = `${window.location.pathname}?t=${Date.now()}`;
      }, 3000);
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
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold text-gray-900">
                Processos
              </h1>
              <button
                onClick={() => setIsOrganizationModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors font-medium"
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
                <FolderTree className="w-5 h-5" />
                Organizar
              </button>
            </div>

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

          {Object.keys(gruposHierarquicos).length === 0 ? (
            <div className="py-12">
              <p className="text-gray-500">
                {filtro ? 'Nenhum processo encontrado' : 'Nenhum processo disponível'}
              </p>
            </div>
          ) : (
            Object.keys(gruposHierarquicos).map((categoria) => (
              <div key={categoria} className="mb-10">
                <h2 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b-2 border-gray-200">
                  {categoria}
                </h2>
                <div className="space-y-6">
                  {gruposHierarquicos[categoria].map((sub) => (
                    <div key={sub.subpastaNome}>
                      {sub.subpastaNome !== 'Raiz' && (
                        <h3
                          className="text-sm font-medium text-gray-600 mb-3 pl-2 border-l-4"
                          style={{ borderColor: theme.colors.primary }}
                        >
                          {sub.subpastaNome}
                        </h3>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sub.processos.map((item) => (
                          <div key={item.slug} className="bg-white border border-gray-200 rounded-lg p-5 relative">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h3 className="text-base font-semibold text-gray-900">{getDisplayName(item)}</h3>
                              <div className="relative" ref={openMenuSlug === item.slug ? menuContainerRef : undefined}>
                                <button
                                  type="button"
                                  onClick={() => setOpenMenuSlug((prev) => (prev === item.slug ? null : item.slug))}
                                  className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-100"
                                  title="Mais opções"
                                >
                                  <MoreVertical className="w-4 h-4 text-gray-600" />
                                </button>
                                {openMenuSlug === item.slug && (
                                  <div className="absolute right-0 mt-1 bg-white border border-gray-200 shadow-lg rounded-md py-1 z-10 min-w-44">
                                    <button
                                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                      onClick={() => handleOpenSettings(item, 'name')}
                                    >
                                      Editar nome
                                    </button>
                                    <button
                                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                      onClick={() => handleOpenSettings(item, 'rename')}
                                    >
                                      Renomear arquivo
                                    </button>
                                    <button
                                      className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                      onClick={() => handleDeleteClick(item)}
                                    >
                                      Deletar
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Link
                                href={(detectedBasePath ? `/vale-shop/processos/${item.slug}` : `/processos/${item.slug}`) as Route}
                                className="flex-1 text-white text-center px-4 py-2 rounded text-sm font-medium transition-colors"
                                style={{ backgroundColor: theme.colors.primary }}
                              >
                                Abrir
                              </Link>
                            </div>
                          </div>
                        ))}
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

      {/* Modal de Organização */}
      <ProcessOrganizationModal
        isOpen={isOrganizationModalOpen}
        onClose={() => setIsOrganizationModalOpen(false)}
        processos={processos}
        clientType={detectedBasePath.includes('vale-shop') ? 'valeshop' : 'quaddra'}
        onUpdate={() => {
          // Recarregar processos
          window.location.reload();
        }}
      />

      {settingsTarget && (
        <ProcessSettingsModal
          isOpen={!!settingsTarget}
          onClose={() => setSettingsTarget(null)}
          processSlug={settingsTarget.slug}
          originalName={settingsTarget.nome}
          originalFileName={settingsTarget.file.split('/').pop() || `${settingsTarget.nome}.bpmn`}
          initialTab={settingsInitialTab}
        />
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
