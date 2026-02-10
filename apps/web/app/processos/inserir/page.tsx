'use client';
import { useState, useEffect, useRef } from 'react';
import { Header, Footer } from '@/components';
import Link from 'next/link';
import { Folder, FolderPlus, FileText, GripVertical, X, Trash2, Plus, ExternalLink } from 'lucide-react';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import { useTheme } from '@/contexts/ThemeContext';
import { usePathname } from 'next/navigation';

// Tipo para pasta personalizada com suporte a hierarquia
type FolderConfig = {
  id: string;
  name: string;
  files: File[];
  subfolders: FolderConfig[];
  parentId?: string;
};

export default function InserirProcessoPage() {
  const { theme } = useTheme();
  const pathname = usePathname();
  const basePath = pathname?.startsWith('/vale-shop') ? '/vale-shop' : '';
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Preview do diagrama
  const [showPreview, setShowPreview] = useState(false);
  const [bpmnXml, setBpmnXml] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const previewRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);

  // Dados do formulário - estrutura flexível: arquivos na raiz + múltiplas pastas principais
  const [rootFiles, setRootFiles] = useState<File[]>([]); // Arquivos diretamente na raiz (sem pasta)
  const [mainFolders, setMainFolders] = useState<FolderConfig[]>([]); // Múltiplas pastas principais
  const [draggedFile, setDraggedFile] = useState<{ file: File, sourceFolderId: string | null } | null>(null);
  const [creatingFolder, setCreatingFolder] = useState<string | null>(null); // ID da pasta pai ou null para raiz
  const [newFolderName, setNewFolderName] = useState('');

  const extractHtmlErrorMessage = (html: string): string => {
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const cleaned = (titleMatch?.[1] || h1Match?.[1] || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned || 'O servidor retornou HTML em vez de JSON.';
  };

  const parseApiResponse = async (response: Response): Promise<any> => {
    const contentType = response.headers.get('content-type') || '';
    const rawBody = await response.text();

    if (contentType.includes('application/json')) {
      try {
        return JSON.parse(rawBody);
      } catch {
        throw new Error('Resposta JSON inválida recebida da API de upload.');
      }
    }

    if (rawBody.trim().startsWith('<')) {
      const htmlError = extractHtmlErrorMessage(rawBody);
      throw new Error(`Resposta inesperada do servidor (${response.status}): ${htmlError}`);
    }

    throw new Error(
      `Resposta inesperada da API (${response.status}) com content-type "${contentType || 'desconhecido'}".`,
    );
  };

  // Função auxiliar para encontrar pasta por ID recursivamente
  const findFolderById = (folders: FolderConfig[], id: string): FolderConfig | null => {
    for (const folder of folders) {
      if (folder.id === id) return folder;
      const found = findFolderById(folder.subfolders, id);
      if (found) return found;
    }
    return null;
  };

  // Função auxiliar para atualizar pasta recursivamente
  const updateFolderInTree = (folders: FolderConfig[], id: string, updater: (f: FolderConfig) => FolderConfig): FolderConfig[] => {
    return folders.map(folder => {
      if (folder.id === id) {
        return updater(folder);
      }
      return {
        ...folder,
        subfolders: updateFolderInTree(folder.subfolders, id, updater)
      };
    });
  };

  // Função auxiliar para remover pasta recursivamente
  const removeFolderFromTree = (folders: FolderConfig[], id: string): FolderConfig[] => {
    return folders
      .filter(folder => folder.id !== id)
      .map(folder => ({
        ...folder,
        subfolders: removeFolderFromTree(folder.subfolders, id)
      }));
  };

  // Preview do primeiro arquivo BPMN encontrado
  const handleFilePreview = async (file: File) => {
    if (!file.name.endsWith('.bpmn')) return;

    setError('');
    setMessage('');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const xml = e.target?.result as string;
        await renderPreview(xml);
      };
      reader.onerror = () => {
        setError('Erro ao ler arquivo BPMN');
      };
      reader.readAsText(file);
    } catch (err) {
      setError('Erro ao processar arquivo BPMN');
    }
  };

  // Renderizar preview do diagrama
  const renderPreview = async (xml: string) => {
    console.log('[PREVIEW] Configurando preview com XML de', xml.length, 'caracteres');
    setBpmnXml(xml);
    setShowPreview(true);
    setZoomLevel(1);
    // O useEffect irá renderizar quando showPreview e bpmnXml mudarem
  };

  // Controles de zoom
  const handleZoomIn = () => {
    if (viewerRef.current) {
      const canvas = viewerRef.current.get('canvas');
      const newZoom = zoomLevel * 1.2;
      canvas.zoom(newZoom);
      setZoomLevel(newZoom);
    }
  };

  const handleZoomOut = () => {
    if (viewerRef.current) {
      const canvas = viewerRef.current.get('canvas');
      const newZoom = zoomLevel * 0.8;
      canvas.zoom(newZoom);
      setZoomLevel(newZoom);
    }
  };

  const handleZoomReset = () => {
    if (viewerRef.current) {
      const canvas = viewerRef.current.get('canvas');
      canvas.zoom('fit-viewport');
      setZoomLevel(1);
    }
  };

  // Renderizar o viewer quando showPreview e bpmnXml mudam
  useEffect(() => {
    const loadViewer = async () => {
      if (showPreview && bpmnXml && previewRef.current) {
        console.log('[PREVIEW] UseEffect - renderizando viewer...');

        // Aguardar um frame para garantir que o DOM está pronto
        await new Promise(resolve => requestAnimationFrame(resolve));

        // Verificar se o container tem dimensões válidas
        const rect = previewRef.current.getBoundingClientRect();
        console.log('[PREVIEW] Dimensões do container:', rect.width, 'x', rect.height);

        if (rect.width === 0 || rect.height === 0) {
          console.warn('[PREVIEW] Container ainda não tem dimensões válidas, aguardando...');
          setTimeout(() => loadViewer(), 100);
          return;
        }

        try {
          if (!viewerRef.current) {
            console.log('[PREVIEW] Criando novo viewer...');
            const BpmnJS = (await import('bpmn-js/dist/bpmn-navigated-viewer.development.js')).default;
            viewerRef.current = new BpmnJS({
              container: previewRef.current,
            });
          }

          console.log('[PREVIEW] Importando XML no viewer...');
          
          // Importar XML e ignorar warnings de DataObject (problema comum do Bizagi)
          try {
            const result = await viewerRef.current.importXML(bpmnXml);
            if (result.warnings && result.warnings.length > 0) {
              // Filtrar apenas warnings críticos (não os de DataObject)
              const criticalWarnings = result.warnings.filter((w: any) =>
                !w.message?.includes('DataObject') &&
                !w.message?.includes('not yet drawn') &&
                !w.message?.includes('Association')
              );
              if (criticalWarnings.length > 0) {
                console.warn('[PREVIEW] Avisos ao importar:', criticalWarnings);
              }
            }
          } catch (importError: any) {
            // Ignorar erros de DataObject que não impedem renderização
            if (importError.message?.includes('DataObject') ||
                importError.message?.includes('not yet drawn') ||
                importError.message?.includes('Association')) {
              console.warn('[PREVIEW] Aviso ignorado (DataObject/Association):', importError.message);
              // Continuar mesmo com o erro, pois o diagrama pode ser renderizado
            } else {
              throw importError;
            }
          }

          // Aguardar um pouco antes de fazer zoom
          await new Promise(resolve => setTimeout(resolve, 50));

          const canvas = viewerRef.current.get('canvas');
          const viewbox = canvas.viewbox();
          console.log('[PREVIEW] Viewbox:', viewbox);

          // Verificar se viewbox tem valores válidos antes de fazer zoom
          if (viewbox && viewbox.width > 0 && viewbox.height > 0) {
            canvas.zoom('fit-viewport');
            console.log('[PREVIEW] Preview renderizado com sucesso!');
          } else {
            console.warn('[PREVIEW] Viewbox inválido, usando zoom padrão');
            canvas.zoom(1);
          }
        } catch (err: any) {
          console.error('[PREVIEW] Erro no useEffect:', err);
          // Só mostrar erro se não for relacionado a DataObject
          if (!err.message?.includes('DataObject') && 
              !err.message?.includes('not yet drawn') &&
              !err.message?.includes('Association')) {
            setError(`Erro ao renderizar diagrama: ${err.message}`);
            setShowPreview(false);
          } else {
            console.warn('[PREVIEW] Erro de DataObject ignorado, continuando renderização');
          }
        }
      }
    };

    loadViewer();
  }, [showPreview, bpmnXml]);

  // Limpar viewer ao desmontar
  useEffect(() => {
    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
      }
    };
  }, []);

  // Adicionar arquivos na raiz
  const addRootFiles = (newFiles: File[]) => {
    const existingNames = rootFiles.map(f => f.name);
    const filesToAdd = newFiles.filter(f => !existingNames.includes(f.name));
    setRootFiles([...rootFiles, ...filesToAdd]);
    
    // Preview do primeiro arquivo BPMN
    if (filesToAdd.length > 0) {
      const bpmnFile = filesToAdd.find(f => f.name.endsWith('.bpmn'));
      if (bpmnFile) handleFilePreview(bpmnFile);
    }
  };

  // Remover arquivo da raiz
  const removeRootFile = (fileName: string) => {
    setRootFiles(rootFiles.filter(f => f.name !== fileName));
  };

  // Criar nova pasta principal ou subpasta
  const createFolder = (parentId: string | null) => {
    if (!newFolderName.trim()) {
      setError('Digite um nome para a pasta');
      return;
    }

    const newFolder: FolderConfig = {
      id: `folder-${Date.now()}-${Math.random()}`,
      name: newFolderName.trim(),
      files: [],
      subfolders: [],
      parentId: parentId || undefined
    };

    if (parentId === null) {
      // Criar pasta principal
      setMainFolders([...mainFolders, newFolder]);
    } else {
      // Criar subpasta
      setMainFolders(updateFolderInTree(mainFolders, parentId, (folder) => ({
        ...folder,
        subfolders: [...folder.subfolders, newFolder]
      })));
    }

    setNewFolderName('');
    setCreatingFolder(null);
  };

  // Remover pasta
  const removeFolder = (id: string) => {
    setMainFolders(removeFolderFromTree(mainFolders, id));
  };

  // Atualizar nome da pasta
  const updateFolderName = (id: string, name: string) => {
    setMainFolders(updateFolderInTree(mainFolders, id, (folder) => ({
      ...folder,
      name
    })));
  };

  // Adicionar arquivos a uma pasta
  const addFilesToFolder = (folderId: string, newFiles: File[]) => {
    setMainFolders(updateFolderInTree(mainFolders, folderId, (folder) => {
      const existingNames = folder.files.map(f => f.name);
      const filesToAdd = newFiles.filter(f => !existingNames.includes(f.name));
      
      // Preview do primeiro arquivo BPMN
      if (filesToAdd.length > 0) {
        const bpmnFile = filesToAdd.find(f => f.name.endsWith('.bpmn'));
        if (bpmnFile) handleFilePreview(bpmnFile);
      }
      
      return {
        ...folder,
        files: [...folder.files, ...filesToAdd]
      };
    }));
  };

  // Remover arquivo de uma pasta
  const removeFileFromFolder = (folderId: string, fileName: string) => {
    setMainFolders(updateFolderInTree(mainFolders, folderId, (folder) => ({
      ...folder,
      files: folder.files.filter(f => f.name !== fileName)
    })));
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, file: File, sourceFolderId: string | null) => {
    setDraggedFile({ file, sourceFolderId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (targetFolderId: string | null) => {
    if (!draggedFile) return;

    const { file, sourceFolderId } = draggedFile;

    // Remover do local de origem
    if (sourceFolderId === null) {
      removeRootFile(file.name);
    } else {
      removeFileFromFolder(sourceFolderId, file.name);
    }

    // Adicionar ao destino
    if (targetFolderId === null) {
      addRootFiles([file]);
    } else {
      addFilesToFolder(targetFolderId, [file]);
    }

    setDraggedFile(null);
  };

  // Função auxiliar para coletar estrutura de pastas em formato plano para envio
  const flattenFolderStructure = (folder: FolderConfig, parentPath: string = ''): Array<{ path: string, name: string, files: File[] }> => {
    const currentPath = parentPath ? `${parentPath}/${folder.name}` : folder.name;
    const result: Array<{ path: string, name: string, files: File[] }> = [];
    
    if (folder.files.length > 0 || folder.subfolders.length > 0) {
      result.push({
        path: currentPath,
        name: folder.name,
        files: folder.files
      });
    }
    
    folder.subfolders.forEach(subfolder => {
      result.push(...flattenFolderStructure(subfolder, currentPath));
    });
    
    return result;
  };

  // Submit do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      // Remover pastas vazias antes de processar
      const removeEmptyFolders = (folders: FolderConfig[]): FolderConfig[] => {
        return folders.filter(folder => {
          const hasFiles = folder.files.length > 0;
          const hasSubfolders = removeEmptyFolders(folder.subfolders).length > 0;
          return hasFiles || hasSubfolders;
        }).map(folder => ({
          ...folder,
          subfolders: removeEmptyFolders(folder.subfolders)
        }));
      };
      
      // Filtrar pastas vazias antes de processar
      const filteredMainFolders = removeEmptyFolders(mainFolders);
      
      // Validações
      const totalFiles = rootFiles.length + filteredMainFolders.reduce((sum, folder) => {
        const countFiles = (f: FolderConfig): number => {
          return f.files.length + f.subfolders.reduce((acc, sub) => acc + countFiles(sub), 0);
        };
        return sum + countFiles(folder);
      }, 0);

      if (totalFiles === 0) {
        throw new Error('Adicione pelo menos um arquivo');
      }

      // Validar todas as pastas recursivamente (apenas verificar nomes, pastas vazias já foram removidas)
      const validateFolder = (folder: FolderConfig): void => {
        if (!folder.name.trim()) {
          throw new Error('Todas as pastas devem ter um nome');
        }
        folder.subfolders.forEach(validateFolder);
      };
      
      filteredMainFolders.forEach(validateFolder);

      // Determinar nome do processo
      let processName = '';
      
      if (filteredMainFolders.length > 0 && filteredMainFolders[0].name.trim()) {
        // Se há pasta principal, usar o nome dela
        processName = filteredMainFolders[0].name.trim();
      } else if (rootFiles.length > 0) {
        // Se há arquivos na raiz, usar o nome do primeiro arquivo .bpmn (sem extensão)
        const rootBpmn = rootFiles.find(f => f.name.endsWith('.bpmn'));
        if (rootBpmn) {
          processName = rootBpmn.name.replace(/\.bpmn$/i, '');
        } else {
          // Se não há .bpmn, usar o nome do primeiro arquivo (sem extensão)
          const firstFile = rootFiles[0];
          const ext = firstFile.name.substring(firstFile.name.lastIndexOf('.'));
          processName = firstFile.name.replace(ext, '');
        }
      } else {
        // Fallback: usar timestamp apenas se não houver nenhum arquivo
        processName = 'Processo-' + Date.now();
      }

      // Encontrar arquivo principal (primeiro .bpmn encontrado)
      let mainFile: File | null = null;
      let mainFileName = '';

      // Procurar na raiz primeiro
      const rootBpmn = rootFiles.find(f => f.name.endsWith('.bpmn'));
      if (rootBpmn) {
        mainFile = rootBpmn;
        mainFileName = rootBpmn.name;
      } else {
        // Procurar nas pastas
        const findFirstBpmn = (folders: FolderConfig[]): File | null => {
          for (const folder of folders) {
            const bpmn = folder.files.find(f => f.name.endsWith('.bpmn'));
            if (bpmn) return bpmn;
            const found = findFirstBpmn(folder.subfolders);
            if (found) return found;
          }
          return null;
        };
        mainFile = findFirstBpmn(filteredMainFolders);
        if (mainFile) mainFileName = mainFile.name;
      }

      // Se não encontrou .bpmn, usar o primeiro arquivo disponível
      if (!mainFile) {
        mainFile = rootFiles.length > 0 ? rootFiles[0] : (filteredMainFolders[0]?.files[0] || null);
        if (mainFile) mainFileName = mainFile.name;
      }

      if (!mainFile) {
        throw new Error('Nenhum arquivo encontrado');
      }

      // Criar FormData
      const formData = new FormData();
      formData.append('processName', processName);
      formData.append('mainFile', mainFile);
      formData.append('mainFileName', mainFileName);
      
      // Adicionar tipo de cliente
      const clientType = basePath.includes('vale-shop') ? 'valeshop' : 'quaddra';
      formData.append('clientType', clientType);

      // Coletar estrutura completa
      const folderStructure: Array<{ path: string, name: string, files: File[] }> = [];
      
      // Adicionar arquivos da raiz como uma "pasta" especial
      if (rootFiles.length > 0) {
        folderStructure.push({
          path: '',
          name: '',
          files: rootFiles
        });
      }

      // Adicionar todas as pastas principais e suas subpastas (apenas pastas não vazias)
      filteredMainFolders.forEach(folder => {
        folderStructure.push(...flattenFolderStructure(folder));
      });

      // Adicionar estrutura de pastas (formato compatível com API)
      const folderStructureForAPI = folderStructure.map(f => ({
        name: f.path || 'root', // Caminho completo da pasta ou 'root' para raiz
        fileCount: f.files.length
      }));
      formData.append('folderStructure', JSON.stringify(folderStructureForAPI));

      // Adicionar arquivos de cada pasta usando o caminho completo
      folderStructure.forEach(folder => {
        folder.files.forEach(file => {
          const pathKey = folder.path || 'root';
          formData.append(`folder_${pathKey}`, file);
        });
      });

      // Enviar para API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      let response: Response;
      try {
        response = await fetch('/api/upload-processo', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const result = await parseApiResponse(response);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || result?.message || 'Erro ao fazer upload');
      }

      // Verificar se foi sincronizado com GitHub
      if (!result.githubSynced) {
        const errorMsg = result.githubError 
          ? `Erro ao enviar para GitHub: ${result.githubError}`
          : 'Token do GitHub não configurado. Configure GITHUB_TOKEN no arquivo .env.local';
        
        setError(
          `Processo "${processName}" foi salvo localmente, mas não foi enviado para o GitHub.\n\n` +
          `${errorMsg}\n\n` +
          `Verifique a configuração do token do GitHub.`
        );
        setLoading(false);
        return;
      }

      setMessage(
        `Processo "${processName}" inserido com sucesso e sincronizado com GitHub! ` +
        (result.elementsExtracted > 0
          ? `${result.elementsExtracted} elementos extraídos automaticamente.`
          : '') +
        ' Redirecionando para a página de processos...'
      );

      // Limpar formulário
      setRootFiles([]);
      setMainFolders([]);
      setShowPreview(false);
      setBpmnXml(null);
      setNewFolderName('');
      setCreatingFolder(null);

      // Resetar inputs
      const fileInputs = document.querySelectorAll('input[type="file"]');
      fileInputs.forEach((input: any) => {
        input.value = '';
      });

      // Redirecionar para a página de processos após 2 segundos
      setTimeout(() => {
        window.location.href = `${basePath}/processos`;
      }, 2000);
    } catch (err: any) {
      console.error('Erro ao inserir processo:', err);
      if (err?.name === 'AbortError') {
        setError('Timeout ao enviar arquivos. Tente novamente em alguns instantes.');
      } else {
        setError(err?.message || 'Erro ao inserir processo');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        .bpmn-preview * {
          cursor: default !important;
        }
        .bpmn-preview svg {
          cursor: default !important;
          shape-rendering: geometricPrecision;
          text-rendering: geometricPrecision;
        }
        .bpmn-preview .djs-element {
          cursor: default !important;
        }
        .bpmn-preview .djs-container {
          cursor: default !important;
        }
        .bpmn-preview .djs-overlay {
          font-family: Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
      `}} />
      <Header />
      <main className="pt-20 min-h-screen bg-gray-50">
        <div className="container py-16">
          <div className="max-w-4xl mx-auto">
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

              <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: theme.colors.text }}>
                Inserir Novo Processo
              </h1>
              <p className="text-xl mb-4" style={{ color: '#606770' }}>
                Faça upload de processos para o repositório GitHub
              </p>
              <a
                href="https://github.com/4isaque4/vale-shope-processos/tree/main"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 hover:shadow-md"
                style={{ 
                  backgroundColor: theme.colors.primary,
                  color: 'white'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.primary;
                }}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Ver repositório no GitHub</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            {/* Mensagens */}
            {message && (
              <div className="flex items-start gap-3 p-4 mb-6 rounded-lg border-2" style={{ backgroundColor: '#E6F2F8', borderColor: theme.colors.primary }}>
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: theme.colors.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium whitespace-pre-line" style={{ color: theme.colors.text }}>{message}</p>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 p-4 mb-6 rounded-lg border-2" style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.accent }}>
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: theme.colors.accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm font-medium whitespace-pre-line" style={{ color: theme.colors.text }}>{error}</p>
              </div>
            )}

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-8" style={{ borderColor: '#e5e7eb' }}>
              {/* Preview do Diagrama */}
              {showPreview && (
                <div className="mb-6 border-2 rounded-lg overflow-hidden" style={{ borderColor: theme.colors.border }}>
                  <div className="px-4 py-2" style={{ backgroundColor: theme.colors.primary }}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">
                        Preview do Diagrama
                      </h3>
                      <div className="flex items-center gap-2">
                        {/* Controles de Zoom */}
                        <button
                          type="button"
                          onClick={handleZoomOut}
                          className="p-1.5 rounded hover:bg-white/20 transition-colors"
                          title="Diminuir zoom"
                        >
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={handleZoomReset}
                          className="px-2 py-1 text-xs font-semibold rounded hover:bg-white/20 transition-colors text-white"
                          title="Ajustar ao tamanho"
                        >
                          {Math.round(zoomLevel * 100)}%
                        </button>
                        <button
                          type="button"
                          onClick={handleZoomIn}
                          className="p-1.5 rounded hover:bg-white/20 transition-colors"
                          title="Aumentar zoom"
                        >
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                          </svg>
                        </button>
                        <div className="w-px h-4 bg-white/30 mx-1"></div>
                        <button
                          type="button"
                          onClick={() => setShowPreview(false)}
                          className="p-1.5 rounded hover:bg-white/20 transition-colors text-white"
                          title="Fechar preview"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div
                    ref={previewRef}
                    style={{
                      height: '600px',
                      minHeight: '600px',
                      width: '100%',
                      backgroundColor: '#fff',
                      position: 'relative',
                      cursor: 'default'
                    }}
                    className="bpmn-preview"
                  />
                </div>
              )}

              {/* Estrutura de Organização */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2" style={{ color: theme.colors.text }}>
                  Organização de Arquivos
                </label>
                <p className="text-sm mb-4" style={{ color: '#606770' }}>
                  Organize seus arquivos como preferir: coloque diretamente na raiz, crie pastas principais ou organize em subpastas. Arraste arquivos entre pastas para reorganizar.
                </p>

                {/* Área de Drop para Raiz */}
                <div
                  className="mb-4 p-4 border-2 border-dashed rounded-lg transition-colors"
                  style={{
                    borderColor: draggedFile ? theme.colors.primary : '#e5e7eb',
                    backgroundColor: draggedFile ? `${theme.colors.primary}10` : 'transparent'
                  }}
                  onDragOver={handleDragOver}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(null);
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Folder className="w-5 h-5" style={{ color: theme.colors.primary }} />
                    <span className="font-semibold" style={{ color: theme.colors.primary }}>
                      Raiz (Arquivos sem pasta)
                    </span>
                  </div>

                  {/* Input para adicionar arquivos na raiz */}
                  <input
                    type="file"
                    multiple
                    onChange={(e) => addRootFiles(Array.from(e.target.files || []))}
                    className="hidden"
                    id="file-root"
                  />
                  <label
                    htmlFor="file-root"
                    className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-all text-sm mb-3"
                    style={{
                      borderColor: '#e5e7eb',
                      backgroundColor: 'white',
                      color: '#606770'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.primary;
                      e.currentTarget.style.color = theme.colors.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.color = '#606770';
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    <span className="font-medium">
                      {rootFiles.length > 0 ? `${rootFiles.length} arquivo(s)` : 'Adicionar arquivos na raiz'}
                    </span>
                  </label>

                  {/* Lista de arquivos na raiz */}
                  {rootFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {rootFiles.map((file, idx) => (
                        <div
                          key={idx}
                          draggable
                          onDragStart={(e) => handleDragStart(e, file, null)}
                          className="flex items-center gap-2 p-2 bg-white border rounded-lg cursor-move transition-all text-sm"
                          style={{ borderColor: '#e5e7eb' }}
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
                          <span className="flex-1 truncate" style={{ color: theme.colors.text }} title={file.name}>
                            {file.name}
                          </span>
                          <span className="text-xs" style={{ color: '#606770' }}>
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                          <button
                            type="button"
                            onClick={() => removeRootFile(file.name)}
                            className="p-1 rounded transition-all"
                            style={{ color: '#606770' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#F2F2F2';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Renderizar Pastas Principais */}
                {(() => {
                  const renderFolder = (folder: FolderConfig, level: number = 0): JSX.Element => {
                    const indent = level * 24;
                    
                    return (
                      <div key={folder.id} className="mb-4" style={{ marginLeft: `${indent}px` }}>
                        <div
                          className="border rounded-lg p-5 transition-colors"
                          style={{
                            borderColor: draggedFile ? theme.colors.primary : '#d1d5db',
                            backgroundColor: draggedFile ? `${theme.colors.primary}10` : 'white'
                          }}
                          onDragOver={handleDragOver}
                          onDrop={(e) => {
                            e.preventDefault();
                            handleDrop(folder.id);
                          }}
                        >
                          {/* Cabeçalho da Pasta */}
                          <div className="flex gap-2 mb-3 items-center">
                            <Folder className="w-5 h-5" style={{ color: theme.colors.primary }} />
                            <input
                              type="text"
                              value={folder.name}
                              onChange={(e) => updateFolderName(folder.id, e.target.value)}
                              placeholder="Nome da pasta"
                              className="flex-1 px-3 py-1.5 text-sm border rounded-lg outline-none transition-all"
                              style={{ borderColor: '#e5e7eb', backgroundColor: '#fff' }}
                              onFocus={(e) => {
                                e.target.style.borderColor = theme.colors.primary;
                                e.target.style.boxShadow = `0 0 0 2px ${theme.colors.primary}20`;
                              }}
                              onBlur={(e) => {
                                e.target.style.borderColor = '#e5e7eb';
                                e.target.style.boxShadow = 'none';
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setCreatingFolder(folder.id)}
                              className="p-1.5 rounded-lg transition-all"
                              style={{ color: theme.colors.primary }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = `${theme.colors.primary}15`;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              title="Criar subpasta"
                            >
                              <FolderPlus className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeFolder(folder.id)}
                              className="p-1.5 rounded-lg transition-all"
                              style={{ color: '#606770' }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#F2F2F2';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              title="Remover pasta"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Criar subpasta */}
                          {creatingFolder === folder.id && (
                            <div className="mb-3 p-3 bg-gray-50 border rounded-lg">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={newFolderName}
                                  onChange={(e) => setNewFolderName(e.target.value)}
                                  placeholder="Nome da subpasta"
                                  className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none"
                                  style={{ borderColor: theme.colors.primary }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      createFolder(folder.id);
                                    } else if (e.key === 'Escape') {
                                      setCreatingFolder(null);
                                      setNewFolderName('');
                                    }
                                  }}
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => createFolder(folder.id)}
                                  className="px-3 py-1 text-white rounded text-sm"
                                  style={{ backgroundColor: theme.colors.primary }}
                                >
                                  Criar
                                </button>
                                <button
                                  type="button"
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

                          {/* Input para adicionar arquivos */}
                          <div className="mb-3">
                            <input
                              type="file"
                              multiple
                              onChange={(e) => addFilesToFolder(folder.id, Array.from(e.target.files || []))}
                              className="hidden"
                              id={`file-${folder.id}`}
                            />
                            <label
                              htmlFor={`file-${folder.id}`}
                              className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-all text-sm"
                              style={{
                                borderColor: '#e5e7eb',
                                backgroundColor: 'white',
                                color: '#606770'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = theme.colors.primary;
                                e.currentTarget.style.color = theme.colors.primary;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#e5e7eb';
                                e.currentTarget.style.color = '#606770';
                              }}
                            >
                              <Plus className="w-4 h-4" />
                              <span className="font-medium">
                                {folder.files.length > 0 ? `${folder.files.length} arquivo(s)` : 'Adicionar arquivos'}
                              </span>
                            </label>
                          </div>

                          {/* Lista de arquivos */}
                          {folder.files.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {folder.files.map((file, idx) => (
                                <div
                                  key={idx}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, file, folder.id)}
                                  className="flex items-center gap-2 p-2 bg-gray-50 border rounded-lg cursor-move transition-all text-sm"
                                  style={{ borderColor: '#e5e7eb' }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = theme.colors.primary;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = '#e5e7eb';
                                  }}
                                >
                                  <GripVertical className="w-4 h-4" style={{ color: theme.colors.primary }} />
                                  <FileText className="w-4 h-4" style={{ color: theme.colors.primary }} />
                                  <span className="flex-1 truncate" style={{ color: theme.colors.text }} title={file.name}>
                                    {file.name}
                                  </span>
                                  <span className="text-xs" style={{ color: '#606770' }}>
                                    ({(file.size / 1024).toFixed(1)} KB)
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeFileFromFolder(folder.id, file.name)}
                                    className="p-1 rounded transition-all"
                                    style={{ color: '#606770' }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = 'white';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'transparent';
                                    }}
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Renderizar subpastas recursivamente */}
                          {folder.subfolders.length > 0 && (
                            <div className="mt-4 space-y-2">
                              {folder.subfolders.map(subfolder => renderFolder(subfolder, level + 1))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div className="space-y-4">
                      {mainFolders.map(folder => renderFolder(folder, 0))}
                    </div>
                  );
                })()}

                {/* Botão para criar pasta principal */}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setCreatingFolder(null)}
                    className="flex items-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg transition-colors"
                    style={{
                      borderColor: theme.colors.primary,
                      backgroundColor: 'transparent',
                      color: theme.colors.primary
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = `${theme.colors.primary}10`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Criar Pasta Principal</span>
                  </button>
                </div>

                {/* Criar pasta principal */}
                {creatingFolder === null && (
                  <div className="mt-4 p-3 bg-gray-50 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Nome da pasta principal"
                        className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none"
                        style={{ borderColor: theme.colors.primary }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            createFolder(null);
                          } else if (e.key === 'Escape') {
                            setCreatingFolder(null);
                            setNewFolderName('');
                          }
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => createFolder(null)}
                        className="px-3 py-1 text-white rounded text-sm"
                        style={{ backgroundColor: theme.colors.primary }}
                      >
                        Criar
                      </button>
                      <button
                        type="button"
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

              {/* Botões */}
              <div className="flex justify-center gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 text-white rounded-lg font-medium transition-all duration-200 inline-flex items-center gap-2"
                  style={{
                    backgroundColor: loading ? '#d1d5db' : theme.colors.primary,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: loading ? 'none' : `0 2px 8px ${theme.colors.primary}33`
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
                      e.currentTarget.style.boxShadow = `0 4px 12px ${theme.colors.primary}4D`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = theme.colors.primary;
                      e.currentTarget.style.boxShadow = `0 2px 8px ${theme.colors.primary}33`;
                    }
                  }}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Inserir Processo
                    </>
                  )}
                </button>

                <Link
                  href="/processos"
                  className="px-8 py-3 rounded-lg font-medium transition-all duration-200 text-center inline-flex items-center gap-2"
                  style={{
                    backgroundColor: 'transparent',
                    color: '#606770',
                    border: '1px solid #e5e7eb'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#F2F2F2';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancelar
                </Link>
              </div>
            </form>

            {/* Informações */}
            <div className="mt-8 bg-white border rounded-lg p-6" style={{ borderColor: '#e5e7eb' }}>
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5" style={{ color: theme.colors.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold" style={{ color: theme.colors.text }}>Como funciona</h3>
              </div>
              <ol className="space-y-2 list-decimal list-inside text-sm" style={{ color: '#606770' }}>
                <li><strong>Arquivos na Raiz:</strong> Adicione arquivos diretamente sem criar pastas</li>
                <li><strong>Pastas Principais:</strong> Crie quantas pastas principais quiser para organizar seus processos</li>
                <li><strong>Subpastas:</strong> Organize ainda mais criando subpastas dentro de qualquer pasta</li>
                <li><strong>Drag and Drop:</strong> Arraste arquivos entre pastas para reorganizar facilmente</li>
                <li><strong>Tipos de Arquivo:</strong> Aceita .bpm, .bpmn, .pdf, .doc, .xlsx, etc.</li>
                <li><strong>Preview:</strong> Arquivos .bpmn mostram preview automático do diagrama</li>
              </ol>
            </div>

            {/* Estilos para o preview */}
            <style jsx>{`
            .bpmn-preview :global(.djs-container) {
              background-color: #ffffff !important;
            }
            .bpmn-preview :global(.bjs-powered-by) {
              display: none !important;
            }
          `}</style>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
