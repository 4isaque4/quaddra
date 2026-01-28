'use client';
import React, { useState, useEffect, useRef } from 'react';
import Draggable from 'react-draggable';
import Notification from './Notification';
import ConfirmDialog from './ConfirmDialog';

type ProcessSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  processSlug: string;
  originalName: string;
  originalFileName: string;
};

type Document = {
  name: string;
  size: number;
  modified: string;
  path: string;
};

export default function ProcessSettingsModal({
  isOpen,
  onClose,
  processSlug,
  originalName,
  originalFileName
}: ProcessSettingsModalProps) {
  const [customName, setCustomName] = useState('');
  const [showFileRename, setShowFileRename] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notificacao, setNotificacao] = useState<{ tipo: 'sucesso' | 'erro' | 'aviso'; mensagem: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ titulo: string; mensagem: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Carregar nome customizado do localStorage
      try {
        const storageKey = `process_custom_names`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const names = JSON.parse(stored);
          setCustomName(names[processSlug] || '');
        } else {
          setCustomName('');
        }
      } catch (e) {
        console.warn('Erro ao carregar nome customizado:', e);
      }
      setNewFileName(originalFileName);
      setShowFileRename(false);
      
      // Carregar documentos
      loadDocuments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, processSlug, originalFileName]);

  const loadDocuments = async () => {
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(processSlug)}`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/documents/${encodeURIComponent(processSlug)}`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        setNotificacao({ tipo: 'sucesso', mensagem: 'Documento enviado com sucesso!' });
        loadDocuments(); // Recarregar lista
        if (fileInputRef.current) {
          fileInputRef.current.value = ''; // Limpar input
        }
      } else {
        const data = await response.json();
        setNotificacao({ tipo: 'erro', mensagem: `Erro ao enviar documento: ${data.error || 'Erro desconhecido'}` });
      }
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      setNotificacao({ tipo: 'erro', mensagem: 'Erro ao enviar documento' });
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const handleSaveCustomName = () => {
    try {
      const storageKey = `process_custom_names`;
      const stored = localStorage.getItem(storageKey);
      const names = stored ? JSON.parse(stored) : {};
      
      if (customName.trim() === '') {
        // Remover nome customizado se estiver vazio
        delete names[processSlug];
      } else {
        names[processSlug] = customName;
      }
      
      localStorage.setItem(storageKey, JSON.stringify(names));
      console.log('[Config] Nome customizado salvo:', customName);
      
      // Recarregar página para aplicar o novo nome
      window.location.reload();
    } catch (e) {
      console.error('[Erro] Erro ao salvar nome customizado:', e);
      setNotificacao({ tipo: 'erro', mensagem: 'Erro ao salvar nome customizado' });
    }
  };

  const handleSaveFileName = () => {
    if (newFileName === originalFileName) {
      setNotificacao({ tipo: 'aviso', mensagem: 'O nome do arquivo não foi alterado' });
      return;
    }
    
    if (!newFileName.endsWith('.bpmn')) {
      setNotificacao({ tipo: 'aviso', mensagem: 'O nome do arquivo deve terminar com .bpmn' });
      return;
    }

    setConfirmDialog({
      titulo: 'Confirmar Renomeação',
      mensagem: 'Esta ação irá renomear o arquivo físico no servidor. Tem certeza?',
      onConfirm: executeRename
    });
  };

  const executeRename = async () => {
    setConfirmDialog(null);

    try {
      // Construir o caminho relativo do arquivo
      const response = await fetch('/api/rename-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oldPath: processSlug.replace(/-/g, '/') + '.bpmn', // Converter slug de volta para path
          newName: newFileName
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setNotificacao({ tipo: 'sucesso', mensagem: 'Arquivo renomeado com sucesso! Redirecionando...' });
        
        // Recarregar página com novo slug após 2 segundos
        setTimeout(() => {
          const newSlug = data.newPath.replace(/\.bpmn$/i, '').replace(/\//g, '-').toLowerCase();
          window.location.href = `/processos/${encodeURIComponent(newSlug)}`;
        }, 2000);
      } else {
        setNotificacao({ tipo: 'erro', mensagem: `Erro ao renomear arquivo: ${data.error || 'Erro desconhecido'}` });
      }
    } catch (error) {
      console.error('Erro ao renomear arquivo:', error);
      setNotificacao({ tipo: 'erro', mensagem: 'Erro ao renomear arquivo' });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Notificações */}
      {notificacao && (
        <Notification
          tipo={notificacao.tipo}
          mensagem={notificacao.mensagem}
          onClose={() => setNotificacao(null)}
        />
      )}

      {/* Dialog de Confirmação */}
      {confirmDialog && (
        <ConfirmDialog
          titulo={confirmDialog.titulo}
          mensagem={confirmDialog.mensagem}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
          tipo="danger"
        />
      )}

      <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[100] p-4">
      <Draggable handle=".drag-handle" bounds="parent">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header arrastável */}
          <div className="drag-handle flex justify-between items-center p-5 border-b border-gray-200 bg-gradient-to-r from-orange-400 to-orange-500 text-white cursor-move">
            <h2 className="text-xl font-semibold">
              Configurações do Processo
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-white hover:bg-white hover:bg-opacity-20 rounded-lg text-2xl transition-all duration-200"
              title="Fechar"
            >
              ×
            </button>
          </div>

          {/* Conteúdo */}
          <div className="p-6 overflow-y-auto flex-1">
            <div className="space-y-6">
              {/* Nome de Exibição (Customizado) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome de Exibição (apenas para você)
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Este nome será exibido apenas no seu navegador e não afeta o arquivo original
                </p>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={originalName}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  onClick={handleSaveCustomName}
                  className="mt-3 px-4 py-2 bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-lg hover:from-orange-500 hover:to-orange-600 transition-all duration-200 shadow-sm hover:shadow-md font-medium"
                >
                  Salvar Nome Customizado
                </button>
              </div>

              <hr className="border-gray-200" />

              {/* Nome do Arquivo Original */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Arquivo Original
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  <strong>Atenção:</strong> Alterar este nome irá renomear o arquivo físico no servidor
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={originalFileName}
                    disabled
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                  />
                  <button
                    onClick={() => setShowFileRename(!showFileRename)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all duration-200 font-medium"
                  >
                    {showFileRename ? 'Cancelar' : 'Renomear Arquivo'}
                  </button>
                </div>
                
                {showFileRename && (
                  <div className="mt-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800 mb-3 font-medium">
                      ATENÇÃO: Esta ação irá renomear o arquivo físico. Tem certeza?
                    </p>
                    <input
                      type="text"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      className="w-full px-4 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 mb-3"
                    />
                    <button
                      onClick={handleSaveFileName}
                      className="px-4 py-2 bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-lg hover:from-orange-500 hover:to-orange-600 transition-all duration-200 font-medium"
                    >
                      Confirmar Renomeação
                    </button>
                  </div>
                )}
              </div>

              <hr className="border-gray-200" />

              {/* Informações do Processo */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Informações do Processo</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span className="font-medium">Slug:</span>
                    <span className="text-gray-800 font-mono">{processSlug}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Nome Original:</span>
                    <span className="text-gray-800">{originalName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Arquivo:</span>
                    <span className="text-gray-800 font-mono">{originalFileName}</span>
                  </div>
                </div>
              </div>

              {/* Documentos Associados */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Documentos Associados</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Anexe POPs, ITs, planilhas e outros documentos relacionados a este processo. 
                  Os arquivos são salvos na pasta <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">docs/</code> do processo no servidor.
                </p>
                
                {/* Botão de Upload */}
                <div className="mb-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.png,.jpg,.jpeg"
                  />
                  <button
                    className="w-full px-4 py-2 bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-lg hover:from-orange-500 hover:to-orange-600 transition-all duration-200 shadow-sm hover:shadow-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? 'Enviando...' : 'Fazer Upload de Documento'}
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    Formatos aceitos: PDF, DOCX, DOC, XLSX, XLS, TXT, PNG, JPG
                  </p>
                </div>

                {/* Lista de Documentos */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  {documents.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center">Nenhum documento encontrado</p>
                  ) : (
                    <div className="space-y-2">
                      {documents.map((doc, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(doc.size)} • {new Date(doc.modified).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <a
                            href={doc.path}
                            download
                            className="ml-3 px-3 py-1 bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded hover:from-orange-500 hover:to-orange-600 transition-colors text-sm font-medium"
                          >
                            Download
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gradient-to-r from-gray-700 to-gray-800 text-white rounded-lg hover:from-gray-800 hover:to-gray-900 transition-all duration-200 shadow-sm hover:shadow-md font-medium"
            >
              Fechar
            </button>
          </div>
        </div>
      </Draggable>
    </div>
    </>
  );
}
