'use client';

import { useState, useEffect } from 'react';
import { Folder, FolderPlus, FileText, GripVertical, X, Edit2, Trash2, Plus } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface ProcessoItem {
  file: string;
  slug: string;
  nome: string;
  categoria: string;
  folderPath?: string; // Caminho completo da pasta (ex: "Pasta1/Subpasta")
}

interface FolderNode {
  name: string;
  path: string;
  processes: ProcessoItem[];
  subfolders: FolderNode[];
}

interface ProcessOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  processos: ProcessoItem[];
  onUpdate: () => void;
  clientType?: 'quaddra' | 'valeshop'; // Tipo de cliente para determinar repositório
}

export default function ProcessOrganizationModal({
  isOpen,
  onClose,
  processos,
  onUpdate,
  clientType = 'quaddra'
}: ProcessOrganizationModalProps) {
  const { theme } = useTheme();
  const [folderStructure, setFolderStructure] = useState<FolderNode[]>([]);
  const [draggedItem, setDraggedItem] = useState<{ type: 'process' | 'folder', item: ProcessoItem | FolderNode } | null>(null);
  const [editingFolder, setEditingFolder] = useState<{ path: string, name: string } | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState<string | null>(null);
  const [notificacao, setNotificacao] = useState<{ tipo: 'sucesso' | 'erro', mensagem: string } | null>(null);

  // Construir estrutura hierárquica de pastas
  useEffect(() => {
    if (!isOpen) return;

    const buildFolderStructure = (): FolderNode[] => {
      const root: FolderNode[] = [];
      const folderMap = new Map<string, FolderNode>();

      // Processos na raiz
      const rootProcesses: ProcessoItem[] = [];

      processos.forEach(processo => {
        const pathParts = processo.file.split('/');
        
        if (pathParts.length === 1) {
          // Processo na raiz
          rootProcesses.push(processo);
        } else {
          // Processo em uma pasta
          const folderPath = pathParts.slice(0, -1).join('/');
          
          if (!folderMap.has(folderPath)) {
            const parts = folderPath.split('/');
            let currentPath = '';
            let parentNode: FolderNode[] = root;

            // Criar estrutura de pastas hierárquica
            parts.forEach((part) => {
              currentPath = currentPath ? `${currentPath}/${part}` : part;
              
              if (!folderMap.has(currentPath)) {
                const newNode: FolderNode = {
                  name: part,
                  path: currentPath,
                  processes: [],
                  subfolders: []
                };
                
                folderMap.set(currentPath, newNode);
                parentNode.push(newNode);
                parentNode = newNode.subfolders;
              } else {
                parentNode = folderMap.get(currentPath)!.subfolders;
              }
            });
          }

          // Adicionar processo à pasta
          const folder = folderMap.get(folderPath);
          if (folder) {
            folder.processes.push(processo);
          }
        }
      });

      // Adicionar processos da raiz apenas se houver processos
      if (rootProcesses.length > 0) {
        root.push({
          name: 'Raiz',
          path: '',
          processes: rootProcesses,
          subfolders: []
        });
      }

      return root;
    };

    setFolderStructure(buildFolderStructure());
  }, [processos, isOpen]);

  const mostrarNotificacao = (tipo: 'sucesso' | 'erro', mensagem: string) => {
    setNotificacao({ tipo, mensagem });
    setTimeout(() => setNotificacao(null), 3000);
  };

  const handleDragStart = (e: React.DragEvent, type: 'process' | 'folder', item: ProcessoItem | FolderNode) => {
    setDraggedItem({ type, item });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (targetFolderPath: string | null) => {
    if (!draggedItem) return;

    try {
      if (draggedItem.type === 'process') {
        const processo = draggedItem.item as ProcessoItem;
        
        const response = await fetch('/api/move-processo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            processSlug: processo.slug,
            targetFolderPath: targetFolderPath || null,
            clientType: clientType
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          const targetMsg = targetFolderPath ? `para a pasta "${targetFolderPath}"` : 'para a raiz';
          mostrarNotificacao('sucesso', `Processo "${processo.nome}" movido com sucesso ${targetMsg}!`);
          // Aguardar um pouco antes de atualizar para dar tempo do GitHub processar
          setTimeout(() => {
            onUpdate();
          }, 1000);
        } else {
          const errorMsg = data.error || data.details || 'Erro ao mover processo';
          mostrarNotificacao('erro', `Erro ao mover processo: ${errorMsg}`);
        }
      }

      setDraggedItem(null);
    } catch (error) {
      console.error('Erro ao mover:', error);
      mostrarNotificacao('erro', 'Erro ao mover item');
      setDraggedItem(null);
    }
  };

  const handleCreateFolder = async (parentPath: string | null) => {
    if (!newFolderName.trim()) {
      mostrarNotificacao('erro', 'Digite um nome para a pasta');
      return;
    }

    try {
      const response = await fetch('/api/manage-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          folderPath: '',
          newName: newFolderName.trim(),
          parentPath: parentPath || null
        })
      });

      const data = await response.json();

      if (response.ok) {
        mostrarNotificacao('sucesso', 'Pasta criada com sucesso!');
        setNewFolderName('');
        setCreatingFolder(null);
        onUpdate();
      } else {
        mostrarNotificacao('erro', data.error || 'Erro ao criar pasta');
      }
    } catch (error) {
      console.error('Erro ao criar pasta:', error);
      mostrarNotificacao('erro', 'Erro ao criar pasta');
    }
  };

  const handleRenameFolder = async (folderPath: string, newName: string) => {
    if (!newName.trim()) {
      mostrarNotificacao('erro', 'Digite um nome para a pasta');
      return;
    }

    try {
      const response = await fetch('/api/manage-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rename',
          folderPath,
          newName: newName.trim()
        })
      });

      const data = await response.json();

      if (response.ok) {
        mostrarNotificacao('sucesso', 'Pasta renomeada com sucesso!');
        setEditingFolder(null);
        onUpdate();
      } else {
        mostrarNotificacao('erro', data.error || 'Erro ao renomear pasta');
      }
    } catch (error) {
      console.error('Erro ao renomear pasta:', error);
      mostrarNotificacao('erro', 'Erro ao renomear pasta');
    }
  };

  const handleDeleteFolder = async (folderPath: string) => {
    if (!confirm('Tem certeza que deseja deletar esta pasta? Ela deve estar vazia.')) {
      return;
    }

    try {
      const response = await fetch('/api/manage-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          folderPath
        })
      });

      const data = await response.json();

      if (response.ok) {
        mostrarNotificacao('sucesso', 'Pasta deletada com sucesso!');
        onUpdate();
      } else {
        mostrarNotificacao('erro', data.error || 'Erro ao deletar pasta');
      }
    } catch (error) {
      console.error('Erro ao deletar pasta:', error);
      mostrarNotificacao('erro', 'Erro ao deletar pasta');
    }
  };

  const renderFolder = (folder: FolderNode, level: number = 0): JSX.Element => {
    const isRoot = folder.path === '';
    const indent = level * 24;

    return (
      <div key={folder.path || 'root'} className="mb-4">
        {/* Cabeçalho da Pasta */}
        <div
          className="flex items-center gap-2 p-3 rounded-lg border-2 border-dashed transition-colors"
          style={{
            marginLeft: `${indent}px`,
            borderColor: draggedItem ? theme.colors.primary : 'transparent',
            backgroundColor: draggedItem ? `${theme.colors.primary}10` : 'transparent'
          }}
          onDragOver={handleDragOver}
          onDrop={(e) => {
            e.preventDefault();
            handleDrop(folder.path || null);
          }}
        >
          <Folder className="w-5 h-5" style={{ color: theme.colors.primary }} />
          
          {editingFolder?.path === folder.path ? (
            <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={editingFolder.name}
                  onChange={(e) => setEditingFolder({ ...editingFolder, name: e.target.value })}
                  className="flex-1 px-2 py-1 border rounded focus:outline-none"
                  style={{
                    borderColor: theme.colors.primary
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = theme.colors.primary;
                    e.target.style.boxShadow = `0 0 0 2px ${theme.colors.primary}20`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = theme.colors.primary;
                    e.target.style.boxShadow = 'none';
                  }}
                  autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRenameFolder(folder.path, editingFolder.name);
                  } else if (e.key === 'Escape') {
                    setEditingFolder(null);
                  }
                }}
              />
              <button
                onClick={() => handleRenameFolder(folder.path, editingFolder.name)}
                className="px-2 py-1 text-white rounded text-sm"
                style={{ backgroundColor: theme.colors.primary }}
              >
                Salvar
              </button>
              <button
                onClick={() => setEditingFolder(null)}
                className="px-2 py-1 border rounded text-sm transition-colors"
                style={{
                  borderColor: theme.colors.primary,
                  color: theme.colors.primary,
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${theme.colors.primary}10`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <>
              <span className="flex-1 font-semibold" style={{ color: theme.colors.primary }}>
                {folder.name}
              </span>
              <div className="flex items-center gap-1">
                {!isRoot && (
                  <>
                    <button
                      onClick={() => setEditingFolder({ path: folder.path, name: folder.name })}
                      className="p-1 rounded transition-colors"
                      style={{ 
                        color: theme.colors.primary,
                        backgroundColor: 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${theme.colors.primary}15`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title="Renomear pasta"
                    >
                      <Edit2 className="w-4 h-4" style={{ color: theme.colors.primary }} />
                    </button>
                    <button
                      onClick={() => handleDeleteFolder(folder.path)}
                      className="p-1 rounded transition-colors"
                      style={{ 
                        color: theme.colors.primary,
                        backgroundColor: 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${theme.colors.primary}15`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title="Deletar pasta"
                    >
                      <Trash2 className="w-4 h-4" style={{ color: theme.colors.primary }} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setCreatingFolder(folder.path)}
                  className="p-1 rounded transition-colors"
                  style={{ 
                    color: theme.colors.primary,
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${theme.colors.primary}15`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title="Criar subpasta"
                >
                  <FolderPlus className="w-4 h-4" style={{ color: theme.colors.primary }} />
                </button>
              </div>
            </>
          )}

          {/* Criar subpasta */}
          {creatingFolder === folder.path && (
            <div className="absolute mt-10 left-0 right-0 p-3 bg-white border rounded-lg shadow-lg z-10">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Nome da pasta"
                  className="flex-1 px-2 py-1 border rounded focus:outline-none"
                  style={{
                    borderColor: theme.colors.primary
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = theme.colors.primary;
                    e.target.style.boxShadow = `0 0 0 2px ${theme.colors.primary}20`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = theme.colors.primary;
                    e.target.style.boxShadow = 'none';
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateFolder(folder.path || null);
                    } else if (e.key === 'Escape') {
                      setCreatingFolder(null);
                      setNewFolderName('');
                    }
                  }}
                />
                <button
                  onClick={() => handleCreateFolder(folder.path || null)}
                  className="px-3 py-1 text-white rounded text-sm"
                  style={{ backgroundColor: theme.colors.primary }}
                >
                  Criar
                </button>
                <button
                  onClick={() => {
                    setCreatingFolder(null);
                    setNewFolderName('');
                  }}
                  className="px-3 py-1 border rounded text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Processos na Pasta */}
        <div className="ml-4 space-y-2">
          {folder.processes.map((processo) => (
            <div
              key={processo.slug}
              draggable
              onDragStart={(e) => handleDragStart(e, 'process', processo)}
              className="flex items-center gap-2 p-2 bg-white border rounded-lg cursor-move transition-all"
              style={{ 
                marginLeft: `${indent + 16}px`,
                borderColor: '#e5e7eb'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = theme.colors.primary;
                e.currentTarget.style.boxShadow = `0 2px 8px ${theme.colors.primary}30`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <GripVertical className="w-4 h-4" style={{ color: theme.colors.primary }} />
              <FileText className="w-4 h-4" style={{ color: theme.colors.primary }} />
              <span className="flex-1 text-sm" style={{ color: '#1f2937' }}>{processo.nome}</span>
            </div>
          ))}

          {/* Subpastas */}
          {folder.subfolders.map((subfolder) => renderFolder(subfolder, level + 1))}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Organizar Processos</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div 
            className="mb-4 p-4 border rounded-lg"
            style={{
              backgroundColor: `${theme.colors.primary}10`,
              borderColor: `${theme.colors.primary}30`
            }}
          >
            <p className="text-sm" style={{ color: theme.colors.primary }}>
              <strong>Como usar:</strong> Arraste os processos para mover entre pastas. 
              Use os ícones para criar, renomear ou deletar pastas.
            </p>
          </div>

          {/* Área de drop para raiz */}
          <div
            className="mb-4 p-4 border-2 border-dashed rounded-lg transition-colors"
            style={{
              borderColor: draggedItem ? theme.colors.primary : '#e5e7eb',
              backgroundColor: draggedItem ? `${theme.colors.primary}10` : 'transparent'
            }}
            onDragOver={handleDragOver}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(null);
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Folder className="w-5 h-5" style={{ color: theme.colors.primary }} />
              <span className="font-semibold" style={{ color: theme.colors.primary }}>
                Raiz (Solte aqui para mover para a raiz)
              </span>
            </div>
          </div>

          {/* Estrutura de pastas */}
          <div className="space-y-2">
            {folderStructure.map((folder) => renderFolder(folder, 0))}
          </div>

          {/* Botão para criar pasta na raiz */}
          <div className="mt-4">
            <button
              onClick={() => setCreatingFolder('')}
              className="flex items-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg transition-colors"
              style={{ 
                borderColor: theme.colors.primary,
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${theme.colors.primary}10`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Plus className="w-4 h-4" style={{ color: theme.colors.primary }} />
              <span style={{ color: theme.colors.primary }}>Criar Pasta Principal</span>
            </button>
          </div>

          {creatingFolder === '' && (
            <div className="mt-4 p-3 bg-white border rounded-lg shadow-lg">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Nome da pasta"
                  className="flex-1 px-2 py-1 border rounded focus:outline-none"
                  style={{
                    borderColor: theme.colors.primary
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = theme.colors.primary;
                    e.target.style.boxShadow = `0 0 0 2px ${theme.colors.primary}20`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = theme.colors.primary;
                    e.target.style.boxShadow = 'none';
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateFolder(null);
                    } else if (e.key === 'Escape') {
                      setCreatingFolder(null);
                      setNewFolderName('');
                    }
                  }}
                />
                <button
                  onClick={() => handleCreateFolder(null)}
                  className="px-3 py-1 text-white rounded text-sm"
                  style={{ backgroundColor: theme.colors.primary }}
                >
                  Criar
                </button>
                <button
                  onClick={() => {
                    setCreatingFolder(null);
                    setNewFolderName('');
                  }}
                  className="px-3 py-1 border rounded text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t">
          <button
            onClick={onClose}
            className="px-6 py-2 border rounded-lg transition-colors"
            style={{
              borderColor: theme.colors.primary,
              color: theme.colors.primary,
              backgroundColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${theme.colors.primary}10`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Fechar
          </button>
        </div>

        {/* Notificação */}
        {notificacao && (
          <div className="fixed top-4 right-4 z-50 animate-slide-in">
            <div
              className="bg-white shadow-lg p-4 max-w-sm rounded-lg flex items-center gap-2"
              style={{
                borderLeft: `4px solid ${notificacao.tipo === 'sucesso' ? theme.colors.primary : '#F59E0B'}`,
                boxShadow: `0 4px 12px ${notificacao.tipo === 'sucesso' ? theme.colors.primary : '#F59E0B'}30`
              }}
            >
              {notificacao.tipo === 'sucesso' ? (
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.colors.primary }} />
              ) : (
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#F59E0B' }} />
              )}
              <p className="text-sm font-medium" style={{ color: '#1f2937' }}>{notificacao.mensagem}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
