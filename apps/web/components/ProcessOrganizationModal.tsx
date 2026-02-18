'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Folder, FolderPlus, FileText, GripVertical, X, Edit2, Trash2, Plus, Upload, ArrowUp, ArrowDown } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

const ORDER_STORAGE_KEY_PREFIX = 'quaddra_organize_order_';

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
  const [folderOrderMap, setFolderOrderMap] = useState<Record<string, string[]>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Carregar ordem salva ao abrir o modal
  useEffect(() => {
    if (!isOpen) return;
    try {
      const key = `${ORDER_STORAGE_KEY_PREFIX}${clientType}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string[]>;
        setFolderOrderMap(parsed);
      } else {
        setFolderOrderMap({});
      }
    } catch {
      setFolderOrderMap({});
    }
  }, [isOpen, clientType]);

  const sanitizeRelativePath = (value: string): string =>
    String(value || '')
      .replace(/\\/g, '/')
      .split('/')
      .map((part) => part.trim())
      .filter((part) => part && part !== '.' && part !== '..')
      .join('/');

  // Buscar pastas no GitHub e montar árvore (incluindo pastas vazias)
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const load = async () => {
      const folderPaths: string[] = [];
      try {
        const res = await fetch(`/api/folders?clientType=${clientType}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.folders)) folderPaths.push(...data.folders);
        }
      } catch (e) {
        console.warn('[Organizar] Erro ao carregar pastas:', e);
      }

      if (cancelled) return;

      const buildFolderStructure = (): FolderNode[] => {
        const root: FolderNode[] = [];
        const folderMap = new Map<string, FolderNode>();

        // Criar nós a partir da lista de pastas (incluindo vazias)
        folderPaths.forEach((folderPath) => {
          const parts = folderPath.split('/').filter(Boolean);
          if (parts.length === 0) return;
          let currentPath = '';
          let parentNode: FolderNode[] = root;

          parts.forEach((part) => {
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            if (!folderMap.has(currentPath)) {
              const newNode: FolderNode = {
                name: part,
                path: currentPath,
                processes: [],
                subfolders: [],
              };
              folderMap.set(currentPath, newNode);
              parentNode.push(newNode);
              parentNode = newNode.subfolders;
            } else {
              parentNode = folderMap.get(currentPath)!.subfolders;
            }
          });
        });

        // Processos na raiz
        const rootProcesses: ProcessoItem[] = [];

        processos.forEach((processo) => {
          const pathParts = processo.file.split('/');

          if (pathParts.length === 1) {
            rootProcesses.push(processo);
          } else {
            const folderPath = pathParts.slice(0, -1).join('/');
            const folder = folderMap.get(folderPath);
            if (folder) {
              folder.processes.push(processo);
            } else {
              // Pasta ainda não existe no mapa (ex.: só existe no GitHub como arquivo) – criar
              let currentPath = '';
              let parentNode: FolderNode[] = root;
              const parts = folderPath.split('/').filter(Boolean);
              parts.forEach((part) => {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                if (!folderMap.has(currentPath)) {
                  const newNode: FolderNode = {
                    name: part,
                    path: currentPath,
                    processes: [],
                    subfolders: [],
                  };
                  folderMap.set(currentPath, newNode);
                  parentNode.push(newNode);
                  parentNode = newNode.subfolders;
                } else {
                  parentNode = folderMap.get(currentPath)!.subfolders;
                }
              });
              folderMap.get(folderPath)!.processes.push(processo);
            }
          }
        });

        if (rootProcesses.length > 0) {
          root.push({
            name: 'Raiz',
            path: '',
            processes: rootProcesses,
            subfolders: [],
          });
        }

        return root;
      };

      setFolderStructure(buildFolderStructure());
    };

    load();
    return () => { cancelled = true; };
  }, [processos, isOpen, clientType]);

  // Ordenar pastas por ordem salva (acima/abaixo entre irmãos)
  function getSiblingPaths(struct: FolderNode[], parentPath: string): string[] {
    if (parentPath === '') return struct.filter((f) => f.path !== '').map((f) => f.path);
    for (const node of struct) {
      if (node.path === parentPath) return node.subfolders.map((s) => s.path);
      const found = getSiblingPaths(node.subfolders, parentPath);
      if (found.length > 0) return found;
    }
    return [];
  }

  const sortedFolderStructure = useMemo(() => {
    function applyOrder(folders: FolderNode[], parentPath: string, orderMap: Record<string, string[]>): FolderNode[] {
      const order = orderMap[parentPath] || folders.map((f) => f.path);
      const sorted = [...folders].sort((a, b) => {
        const ia = order.indexOf(a.path);
        const ib = order.indexOf(b.path);
        const i1 = ia === -1 ? 9999 : ia;
        const i2 = ib === -1 ? 9999 : ib;
        return i1 - i2;
      });
      return sorted.map((f) => ({ ...f, subfolders: applyOrder(f.subfolders, f.path, orderMap) }));
    }
    return applyOrder(folderStructure, '', folderOrderMap);
  }, [folderStructure, folderOrderMap]);

  const persistFolderOrder = (nextMap: Record<string, string[]>) => {
    setFolderOrderMap(nextMap);
    try {
      localStorage.setItem(`${ORDER_STORAGE_KEY_PREFIX}${clientType}`, JSON.stringify(nextMap));
    } catch (e) {
      console.warn('Erro ao salvar ordem:', e);
    }
  };

  const moveFolderUp = (parentPath: string, folderPath: string) => {
    const siblings = folderOrderMap[parentPath] ?? getSiblingPaths(folderStructure, parentPath);
    const idx = siblings.indexOf(folderPath);
    if (idx <= 0) return;
    const next = [...siblings];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    persistFolderOrder({ ...folderOrderMap, [parentPath]: next });
  };

  const moveFolderDown = (parentPath: string, folderPath: string) => {
    const siblings = folderOrderMap[parentPath] ?? getSiblingPaths(folderStructure, parentPath);
    const idx = siblings.indexOf(folderPath);
    if (idx < 0 || idx >= siblings.length - 1) return;
    const next = [...siblings];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    persistFolderOrder({ ...folderOrderMap, [parentPath]: next });
  };

  const mostrarNotificacao = (tipo: 'sucesso' | 'erro', mensagem: string) => {
    setNotificacao({ tipo, mensagem });
    setTimeout(() => setNotificacao(null), 3000);
  };

  const handleDragStart = (e: React.DragEvent, type: 'process' | 'folder', item: ProcessoItem | FolderNode) => {
    setDraggedItem({ type, item });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('type', type);
    if (type === 'folder') {
      e.dataTransfer.setData('folderPath', (item as FolderNode).path);
      e.dataTransfer.setData('text/plain', (item as FolderNode).path);
    }
    if (type === 'process') {
      e.dataTransfer.setData('processSlug', (item as ProcessoItem).slug);
      e.dataTransfer.setData('text/plain', (item as ProcessoItem).slug);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (targetFolderPath: string | null) => {
    if (!draggedItem) return;

    try {
      if (draggedItem.type === 'folder') {
        const folder = draggedItem.item as FolderNode;
        const sourcePath = folder.path;

        if (targetFolderPath === sourcePath) {
          mostrarNotificacao('erro', 'Não é possível mover uma pasta para si mesma.');
          setDraggedItem(null);
          return;
        }
        if (targetFolderPath && targetFolderPath.startsWith(sourcePath + '/')) {
          mostrarNotificacao('erro', 'Não é possível mover uma pasta para dentro de uma subpasta sua.');
          setDraggedItem(null);
          return;
        }

        const response = await fetch('/api/manage-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'move',
            folderPath: sourcePath,
            targetParentPath: targetFolderPath || null,
            clientType,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          const targetMsg = targetFolderPath ? `para a pasta "${targetFolderPath}"` : 'para a raiz';
          mostrarNotificacao('sucesso', `Pasta "${folder.name}" movida com sucesso ${targetMsg}!`);
          setTimeout(() => onUpdate(), 1000);
        } else {
          mostrarNotificacao('erro', data.error || 'Erro ao mover pasta.');
        }
      }

      if (draggedItem.type === 'process') {
        const processo = draggedItem.item as ProcessoItem;

        const response = await fetch('/api/move-processo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            processSlug: processo.slug,
            targetFolderPath: targetFolderPath || null,
            clientType,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          const targetMsg = targetFolderPath ? `para a pasta "${targetFolderPath}"` : 'para a raiz';
          mostrarNotificacao('sucesso', `Processo "${processo.nome}" movido com sucesso ${targetMsg}!`);
          setTimeout(() => onUpdate(), 1000);
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
          parentPath: parentPath || null,
          clientType
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
          newName: newName.trim(),
          clientType
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
          folderPath,
          clientType
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

  const handleUploadToFolder = async (folderPath: string, fileList: FileList | null) => {
    const files = Array.from(fileList || []).filter((file) => file.name.toLowerCase().endsWith('.bpmn'));

    if (!files.length) {
      mostrarNotificacao('erro', 'Selecione pelo menos um arquivo .bpmn');
      return;
    }

    const normalizedPath = sanitizeRelativePath(folderPath) || 'root';
    const processName = sanitizeRelativePath(folderPath).split('/').pop() || files[0].name.replace(/\.bpmn$/i, '');

    try {
      const formData = new FormData();
      formData.append('processName', processName);
      formData.append('clientType', clientType);
      formData.append(
        'folderStructure',
        JSON.stringify([{ path: normalizedPath, name: normalizedPath, fileCount: files.length }]),
      );

      files.forEach((file) => {
        formData.append(`folder_${normalizedPath}`, file);
      });

      const response = await fetch('/api/upload-processo', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        mostrarNotificacao('erro', data.error || data.message || 'Erro ao enviar arquivos');
        return;
      }

      if (data.noCommit) {
        mostrarNotificacao('sucesso', data.message || 'Arquivos já estavam sincronizados');
      } else {
        mostrarNotificacao('sucesso', 'Arquivo(s) enviado(s) com sucesso!');
      }

      onUpdate();
    } catch (error) {
      console.error('Erro ao enviar arquivo(s):', error);
      mostrarNotificacao('erro', 'Erro ao enviar arquivo(s) para a pasta');
    }
  };

  const renderFolder = (
    folder: FolderNode,
    level: number = 0,
    siblingIndex: number = 0,
    siblingCount: number = 1,
  ): JSX.Element => {
    const isRoot = folder.path === '';
    const indent = level * 24;
    const isCreatingHere = creatingFolder === folder.path;
    const parentPath = folder.path.includes('/') ? folder.path.split('/').slice(0, -1).join('/') : '';
    const canMoveUp = !isRoot && siblingCount > 1 && siblingIndex > 0;
    const canMoveDown = !isRoot && siblingCount > 1 && siblingIndex < siblingCount - 1;

    return (
      <div key={folder.path || 'root'} className="mb-4 relative">
        {/* Cabeçalho da Pasta */}
        <div
          className="flex items-center gap-2 p-3 rounded-lg border-2 border-dashed transition-colors"
          style={{
            marginLeft: `${indent}px`,
            borderColor: draggedItem ? theme.colors.primary : '#e5e7eb',
            backgroundColor: draggedItem ? `${theme.colors.primary}08` : '#fafafa'
          }}
          onDragOver={handleDragOver}
          onDrop={(e) => {
            e.preventDefault();
            handleDrop(folder.path || null);
          }}
        >
          {/* Handle para arrastar pasta — igual ao dos processos; arraste por aqui para mover a pasta */}
          {!isRoot && editingFolder?.path !== folder.path ? (
            <div
              role="button"
              tabIndex={0}
              draggable
              onDragStart={(e) => handleDragStart(e, 'folder', folder)}
              className="cursor-grab active:cursor-grabbing shrink-0 p-1.5 rounded border border-transparent hover:border-gray-300 hover:bg-gray-100 select-none"
              style={{ color: theme.colors.primary }}
              title="Arrastar pasta para mover"
              aria-label="Arrastar pasta"
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') e.preventDefault();
              }}
            >
              <GripVertical className="w-5 h-5" style={{ color: theme.colors.primary }} />
            </div>
          ) : (
            <span className="w-8 shrink-0 block" aria-hidden />
          )}
          <Folder className="w-5 h-5 shrink-0" style={{ color: theme.colors.primary }} />
          
          {editingFolder?.path === folder.path ? (
            <div className="flex-1 flex items-center gap-2 min-w-0">
                <input
                  type="text"
                  value={editingFolder.name}
                  onChange={(e) => setEditingFolder({ ...editingFolder, name: e.target.value })}
                  className="flex-1 min-w-0 px-3 py-1.5 border rounded-lg focus:outline-none text-sm"
                  style={{
                    borderColor: theme.colors.primary,
                    maxWidth: '280px'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameFolder(folder.path, editingFolder.name);
                    else if (e.key === 'Escape') setEditingFolder(null);
                  }}
                  autoFocus
                />
              <button
                onClick={() => handleRenameFolder(folder.path, editingFolder.name)}
                className="shrink-0 px-3 py-1.5 text-white rounded-lg text-sm font-medium"
                style={{ backgroundColor: theme.colors.primary }}
              >
                Salvar
              </button>
              <button
                onClick={() => setEditingFolder(null)}
                className="shrink-0 px-3 py-1.5 border rounded-lg text-sm"
                style={{ borderColor: theme.colors.primary, color: theme.colors.primary }}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <>
              <span className="flex-1 font-semibold text-sm min-w-0 truncate" style={{ color: theme.colors.primary }}>
                {folder.name}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {/* Subir / descer na hierarquia (ordem entre irmãos) */}
                {canMoveUp && (
                  <button
                    type="button"
                    onClick={() => moveFolderUp(parentPath, folder.path)}
                    className="p-1.5 rounded border border-gray-200 hover:bg-gray-100 transition-colors"
                    title="Subir (acima do irmão)"
                    aria-label="Subir"
                  >
                    <ArrowUp className="w-4 h-4 text-gray-600" />
                  </button>
                )}
                {canMoveDown && (
                  <button
                    type="button"
                    onClick={() => moveFolderDown(parentPath, folder.path)}
                    className="p-1.5 rounded border border-gray-200 hover:bg-gray-100 transition-colors"
                    title="Descer (abaixo do irmão)"
                    aria-label="Descer"
                  >
                    <ArrowDown className="w-4 h-4 text-gray-600" />
                  </button>
                )}
                {!isRoot && (
                  <>
                    <button
                      onClick={() => setEditingFolder({ path: folder.path, name: folder.name })}
                      className="p-1.5 rounded-md hover:bg-black/5 transition-colors"
                      title="Renomear pasta"
                    >
                      <Edit2 className="w-4 h-4" style={{ color: theme.colors.primary }} />
                    </button>
                    <button
                      onClick={() => handleDeleteFolder(folder.path)}
                      className="p-1.5 rounded-md hover:bg-black/5 transition-colors"
                      title="Deletar pasta"
                    >
                      <Trash2 className="w-4 h-4" style={{ color: theme.colors.primary }} />
                    </button>
                  </>
                )}
                <input
                  ref={(el) => { fileInputRefs.current[folder.path || 'root'] = el; }}
                  type="file"
                  accept=".bpmn"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleUploadToFolder(folder.path, e.target.files);
                    e.target.value = '';
                  }}
                />
                <button
                  onClick={() => fileInputRefs.current[folder.path || 'root']?.click()}
                  className="p-1.5 rounded-md hover:bg-black/5 transition-colors"
                  title="Enviar arquivo(s) nesta pasta"
                >
                  <Upload className="w-4 h-4" style={{ color: theme.colors.primary }} />
                </button>
                <button
                  onClick={() => setCreatingFolder(folder.path)}
                  className="p-1.5 rounded-md hover:bg-black/5 transition-colors"
                  title="Criar subpasta"
                >
                  <FolderPlus className="w-4 h-4" style={{ color: theme.colors.primary }} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Inserção de subpasta: inline logo abaixo da pasta, sempre no mesmo fluxo */}
        {isCreatingHere && (
          <div
            className="mt-2 rounded-lg border-2 p-3 flex items-center gap-2 flex-wrap"
            style={{
              marginLeft: `${indent}px`,
              borderColor: theme.colors.primary,
              backgroundColor: `${theme.colors.primary}08`
            }}
          >
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nome da nova pasta"
              className="flex-1 min-w-[180px] px-3 py-2 border rounded-lg focus:outline-none text-sm"
              style={{
                borderColor: theme.colors.primary,
                maxWidth: '240px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder(folder.path || null);
                else if (e.key === 'Escape') {
                  setCreatingFolder(null);
                  setNewFolderName('');
                }
              }}
              autoFocus
            />
            <button
              onClick={() => handleCreateFolder(folder.path || null)}
              className="px-4 py-2 text-white rounded-lg text-sm font-medium shrink-0"
              style={{ backgroundColor: theme.colors.primary }}
            >
              Criar
            </button>
            <button
              onClick={() => {
                setCreatingFolder(null);
                setNewFolderName('');
              }}
              className="px-4 py-2 border rounded-lg text-sm shrink-0"
              style={{ borderColor: theme.colors.primary, color: theme.colors.primary }}
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Conteúdo: subpastas primeiro (ordem por setas), depois processos na pasta */}
        <div className="ml-4 mt-2 space-y-2">
          {folder.subfolders.map((subfolder, idx) =>
            renderFolder(subfolder, level + 1, idx, folder.subfolders.length),
          )}
          {folder.processes.map((processo) => (
            <div
              key={processo.slug}
              draggable
              onDragStart={(e) => handleDragStart(e, 'process', processo)}
              className="flex items-center gap-2 p-2 bg-white border rounded-lg cursor-move transition-all"
              style={{
                marginLeft: `${indent + 16}px`,
                borderColor: '#e5e7eb',
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
              <GripVertical className="w-4 h-4 shrink-0" style={{ color: theme.colors.primary }} />
              <FileText className="w-4 h-4 shrink-0" style={{ color: theme.colors.primary }} />
              <span className="flex-1 text-sm min-w-0 truncate" style={{ color: '#1f2937' }}>{processo.nome}</span>
            </div>
          ))}
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
              <strong>Como usar:</strong> Arraste pastas ou processos para mover entre pastas ou para a Raiz. Use as setas ↑/↓ ao lado da pasta para subir ou descer na lista (ordem entre irmãos). Use os ícones para criar, renomear ou deletar pastas.
            </p>
          </div>

          {/* Área de drop para raiz - solte aqui para mover pasta/processo para o nível raiz */}
          <div
            className="mb-4 p-4 min-h-[72px] border-2 border-dashed rounded-lg transition-colors flex items-center"
            style={{
              borderColor: draggedItem ? theme.colors.primary : '#e5e7eb',
              backgroundColor: draggedItem ? `${theme.colors.primary}10` : 'transparent'
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDrop(null);
            }}
          >
            <div className="flex items-center gap-2">
              <Folder className="w-5 h-5 shrink-0" style={{ color: theme.colors.primary }} />
              <span className="font-semibold" style={{ color: theme.colors.primary }}>
                Raiz (Solte aqui para mover para a raiz)
              </span>
            </div>
          </div>

          {/* Estrutura de pastas (ordenada por ↑/↓ entre irmãos) */}
          <div className="space-y-2">
            {sortedFolderStructure.map((folder, index) =>
              renderFolder(folder, 0, index, sortedFolderStructure.length),
            )}
          </div>

          {/* Criar pasta na raiz: um único bloco com botão que expande o formulário */}
          <div className="mt-6 p-4 rounded-xl border-2 border-dashed" style={{ borderColor: `${theme.colors.primary}40`, backgroundColor: `${theme.colors.primary}06` }}>
            {creatingFolder !== '' ? (
              <button
                onClick={() => setCreatingFolder('')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors w-full justify-center"
                style={{ color: theme.colors.primary }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${theme.colors.primary}15`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium">Nova pasta principal</span>
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium" style={{ color: theme.colors.primary }}>
                  Nova pasta principal
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Nome da pasta"
                    className="flex-1 min-w-[200px] px-3 py-2 border rounded-lg focus:outline-none text-sm"
                    style={{
                      borderColor: theme.colors.primary,
                      maxWidth: '280px'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateFolder(null);
                      else if (e.key === 'Escape') {
                        setCreatingFolder(null);
                        setNewFolderName('');
                      }
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => handleCreateFolder(null)}
                    className="px-4 py-2 text-white rounded-lg text-sm font-medium"
                    style={{ backgroundColor: theme.colors.primary }}
                  >
                    Criar
                  </button>
                  <button
                    onClick={() => {
                      setCreatingFolder(null);
                      setNewFolderName('');
                    }}
                    className="px-4 py-2 border rounded-lg text-sm"
                    style={{ borderColor: theme.colors.primary, color: theme.colors.primary }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
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
