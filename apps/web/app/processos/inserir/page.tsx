'use client';
import { useState, useEffect, useRef } from 'react';
import { Header, Footer } from '@/components';
import Link from 'next/link';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import { useTheme } from '@/contexts/ThemeContext';
import { usePathname } from 'next/navigation';

// Tipo para pasta personalizada
type FolderConfig = {
  id: string;
  name: string;
  files: File[];
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

  // Dados do formulário
  const [folders, setFolders] = useState<FolderConfig[]>([
    { id: 'folder-1', name: '', files: [] } // Pasta raiz do processo
  ]);

  // Preview do primeiro arquivo da primeira pasta (arquivo principal)
  const handleFirstFolderFileChange = async (files: File[]) => {
    if (files.length === 0) return;

    const firstFile = files[0];
    setError('');
    setMessage('');

    console.log('[PREVIEW] Arquivo selecionado:', firstFile.name);

    // Se for .bpmn, mostrar preview direto
    if (firstFile.name.endsWith('.bpmn')) {
      try {
        console.log('[PREVIEW] Lendo arquivo BPMN...');
        const reader = new FileReader();
        reader.onload = async (e) => {
          const xml = e.target?.result as string;
          console.log('[PREVIEW] XML lido, tamanho:', xml.length, 'caracteres');
          await renderPreview(xml);
        };
        reader.onerror = (err) => {
          console.error('[PREVIEW] Erro ao ler arquivo:', err);
          setError('Erro ao ler arquivo BPMN');
        };
        reader.readAsText(firstFile);
      } catch (err) {
        console.error('[PREVIEW] Erro ao processar arquivo:', err);
        setError('Erro ao processar arquivo BPMN');
      }
    } else if (firstFile.name.endsWith('.bpm')) {
      setMessage('Arquivo .bpm selecionado. O Bizagi usa formato XPDL internamente. Para visualização do diagrama, exporte o arquivo como BPMN 2.0 no Bizagi Modeler e faça upload do arquivo .bpmn gerado.');
      setShowPreview(false);
      setBpmnXml(null);
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
          await viewerRef.current.importXML(bpmnXml);

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
          setError(`Erro ao renderizar diagrama: ${err.message}`);
          setShowPreview(false);
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

  // Adicionar pasta
  const addFolder = () => {
    setFolders([...folders, {
      id: `folder-${Date.now()}`,
      name: '',
      files: []
    }]);
  };

  // Remover pasta
  const removeFolder = (id: string) => {
    setFolders(folders.filter(f => f.id !== id));
  };

  // Atualizar nome da pasta
  const updateFolderName = (id: string, name: string) => {
    setFolders(folders.map(f =>
      f.id === id ? { ...f, name } : f
    ));
  };

  // Remover arquivo individual
  const removeFile = (folderId: string, fileName: string) => {
    setFolders(folders.map(f => {
      if (f.id === folderId) {
        return { ...f, files: f.files.filter(file => file.name !== fileName) };
      }
      return f;
    }));
  };

  // Atualizar arquivos da pasta (adiciona aos existentes)
  const updateFolderFiles = (id: string, newFiles: File[]) => {
    const folder = folders.find(f => f.id === id);
    const isFirstFolder = id === 'folder-1';
    const wasEmpty = folder ? folder.files.length === 0 : true;

    setFolders(folders.map(f => {
      if (f.id === id) {
        // Adicionar novos arquivos aos existentes, evitando duplicatas
        const existingFileNames = f.files.map(file => file.name);
        const filesToAdd = newFiles.filter(file => !existingFileNames.includes(file.name));
        return { ...f, files: [...f.files, ...filesToAdd] };
      }
      return f;
    }));

    // Se for a primeira pasta e estava vazia, tentar preview do primeiro arquivo
    if (isFirstFolder && wasEmpty && newFiles.length > 0) {
      handleFirstFolderFileChange(newFiles);
    }
  };

  // Submit do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      // Validações
      if (folders.length === 0) {
        throw new Error('Adicione pelo menos uma pasta com arquivos');
      }

      // A primeira pasta deve ter nome e arquivos (é a pasta raiz)
      if (!folders[0].name.trim()) {
        throw new Error('A pasta raiz (Pasta 1) deve ter um nome');
      }

      if (folders[0].files.length === 0) {
        throw new Error('A Pasta 1 deve conter pelo menos um arquivo');
      }

      // Validar nomes de pastas
      for (const folder of folders) {
        if (!folder.name.trim()) {
          throw new Error('Todas as pastas devem ter um nome');
        }
        if (folder.files.length === 0) {
          throw new Error(`A pasta "${folder.name}" não tem arquivos`);
        }
      }

      // Extrair arquivo principal (primeiro arquivo da primeira pasta)
      const mainFile = folders[0].files[0];

      // Criar FormData - primeira pasta é o nome do processo
      const processName = folders[0].name;
      const formData = new FormData();
      formData.append('processName', processName);
      formData.append('mainFile', mainFile);
      formData.append('mainFileName', mainFile.name);
      
      // Adicionar tipo de cliente (valeshop ou quaddra)
      const clientType = basePath.includes('vale-shop') ? 'valeshop' : 'quaddra';
      formData.append('clientType', clientType);

      // Adicionar BPMN XML se disponível (para parsing)
      if (bpmnXml) {
        formData.append('bpmnXml', bpmnXml);
      }

      // Adicionar estrutura de pastas
      const folderStructure = folders.map(f => ({
        name: f.name,
        fileCount: f.files.length
      }));
      formData.append('folderStructure', JSON.stringify(folderStructure));

      // Adicionar arquivos de cada pasta
      folders.forEach(folder => {
        folder.files.forEach(file => {
          formData.append(`folder_${folder.name}`, file);
        });
      });

      // Enviar para API
      const response = await fetch('/api/upload-processo', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao fazer upload');
      }

      setMessage(
        `Processo "${processName}" inserido com sucesso! ` +
        (result.elementsExtracted > 0
          ? `${result.elementsExtracted} elementos extraídos automaticamente.`
          : '')
      );

      // Limpar formulário
      setFolders([{ id: 'folder-1', name: '', files: [] }]);
      setShowPreview(false);
      setBpmnXml(null);

      // Resetar inputs
      const fileInputs = document.querySelectorAll('input[type="file"]');
      fileInputs.forEach((input: any) => {
        input.value = '';
      });
    } catch (err: any) {
      console.error('Erro ao inserir processo:', err);
      setError(err.message || 'Erro ao inserir processo');
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
                onMouseEnter={(e) => e.currentTarget.style.color = theme.colors.secondary}
                onMouseLeave={(e) => e.currentTarget.style.color = theme.colors.primary}
              >
                ← Voltar aos Processos
              </Link>

              <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: theme.colors.text }}>
                Inserir Novo Processo
              </h1>
              <p className="text-xl" style={{ color: '#606770' }}>
                Faça upload de processos para o repositório GitHub
              </p>
            </div>

            {/* Mensagens */}
            {message && (
              <div className="flex items-start gap-3 p-4 mb-6 rounded-lg border" style={{ backgroundColor: '#FFF9F5', borderColor: '#F2CAA7' }}>
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: theme.colors.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm" style={{ color: theme.colors.text }}>{message}</p>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 p-4 mb-6 rounded-lg border" style={{ backgroundColor: '#FAFAFA', borderColor: '#e5e7eb' }}>
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: theme.colors.text }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm" style={{ color: theme.colors.text }}>{error}</p>
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

              {/* Estrutura de Pastas */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2" style={{ color: theme.colors.text }}>
                  Organização de Arquivos
                </label>
                <p className="text-sm mb-4" style={{ color: '#606770' }}>
                  A Pasta 1 será a pasta raiz no GitHub (ex: &quot;Comercial&quot;). Adicione qualquer tipo de arquivo (.bpm, .bpmn, .pdf, .doc, .xlsx, etc.) direto nela ou crie subpastas adicionais.
                </p>

                <div className="space-y-4">
                  {folders.map((folder, index) => (
                    <div key={folder.id} className="border rounded-lg p-5" style={{ borderColor: '#d1d5db', backgroundColor: 'white' }}>
                      <div className="flex gap-2 mb-3 items-center">
                        <div className="flex-shrink-0 w-6 h-6 text-white rounded-full flex items-center justify-center text-xs font-semibold" style={{ backgroundColor: theme.colors.primary }}>
                          {index + 1}
                        </div>
                        <input
                          type="text"
                          value={folder.name}
                          onChange={(e) => updateFolderName(folder.id, e.target.value)}
                          placeholder={index === 0 ? "Nome da pasta raiz (ex: Comercial)" : `Nome da pasta ${index + 1}`}
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
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => removeFolder(folder.id)}
                            className="p-1.5 text-sm rounded-lg transition-all"
                            style={{ color: '#606770' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#F2F2F2';
                              e.currentTarget.style.color = theme.colors.text;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#606770';
                            }}
                            title="Remover pasta"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>

                      <div className="relative">
                        <input
                          type="file"
                          multiple
                          onChange={(e) => updateFolderFiles(folder.id, Array.from(e.target.files || []))}
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
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <span className="font-medium">
                            {folder.files.length > 0 ? `${folder.files.length} arquivo(s)` : 'Selecionar arquivos'}
                          </span>
                        </label>

                        {folder.files.length === 0 && (
                          <p className="text-xs mt-2 text-center" style={{ color: '#606770' }}>
                            {index === 0
                              ? 'Adicione arquivos (.bpm, .bpmn, .pdf, .doc, etc.)'
                              : 'Adicione qualquer tipo de arquivo'}
                          </p>
                        )}

                        {/* Lista de arquivos adicionados */}
                        {folder.files.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {folder.files.map((file, fileIndex) => (
                              <div
                                key={fileIndex}
                                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm"
                                style={{ backgroundColor: '#F2F2F2', borderColor: '#e5e7eb' }}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#606770' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <span className="truncate" style={{ color: theme.colors.text }} title={file.name}>
                                    {file.name}
                                  </span>
                                  <span className="text-xs flex-shrink-0" style={{ color: '#606770' }}>
                                    ({(file.size / 1024).toFixed(1)} KB)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeFile(folder.id, file.name)}
                                  className="p-1 rounded transition-all flex-shrink-0"
                                  style={{ color: '#606770' }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'white';
                                    e.currentTarget.style.color = '#2D3340';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = '#606770';
                                  }}
                                  title="Remover arquivo"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addFolder}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium text-sm"
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid #e5e7eb',
                      color: '#606770'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.border;
                      e.currentTarget.style.color = theme.colors.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.color = '#606770';
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Adicionar Pasta
                  </button>
                </div>

                {folders.length > 0 && folders[0].name && folders[0].files.length > 0 && (
                  <div className="mt-6 border rounded-lg p-4" style={{ backgroundColor: 'white', borderColor: '#e5e7eb' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-4 h-4" style={{ color: theme.colors.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <p className="text-sm font-medium" style={{ color: theme.colors.text }}>Estrutura:</p>
                    </div>
                    <pre className="text-xs font-mono pl-2" style={{ color: '#606770' }}>
                      {`${folders[0].name}/
${folders.slice(1).map(f => `├── ${f.name || 'pasta'}/
│   └── ${f.files.length} arquivo(s)`).join('\n')}${folders.length === 1 ? `└── ${folders[0].files.length} arquivo(s)` : ''}`}
                    </pre>
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
                <li>A Pasta 1 será a pasta raiz do seu processo (ex: &quot;Comercial&quot;)</li>
                <li>Adicione qualquer tipo de arquivo: .bpm, .bpmn, .pdf, .doc, .xlsx, etc.</li>
                <li>Você pode ter arquivos direto na raiz ou organizados em subpastas</li>
                <li>Para visualização: use arquivos .bpmn exportados do Bizagi Modeler</li>
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
