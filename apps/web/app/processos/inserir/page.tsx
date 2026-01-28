'use client';
import { useState } from 'react';
import { Header, Footer } from '@/components';
import Link from 'next/link';

export default function InserirProcessoPage() {
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  const [formData, setFormData] = useState({
    nomeProcesso: '',
    arquivoBpmn: null as File | null,
    subdiagramas: [] as File[],
    documentos: [] as File[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensagem('');
    setErro('');

    try {
      // Validações
      if (!formData.nomeProcesso.trim()) {
        throw new Error('Nome do processo é obrigatório');
      }

      if (!formData.arquivoBpmn) {
        throw new Error('Arquivo BPMN principal é obrigatório');
      }

      // Criar FormData para envio
      const data = new FormData();
      data.append('nomeProcesso', formData.nomeProcesso);
      data.append('bpmn', formData.arquivoBpmn);

      // Adicionar subdiagramas
      formData.subdiagramas.forEach((arquivo) => {
        data.append('subdiagramas', arquivo);
      });

      // Adicionar documentos POP/IT
      formData.documentos.forEach((arquivo) => {
        data.append('documentos', arquivo);
      });

      // Enviar para API
      const response = await fetch('/api/upload-processo', {
        method: 'POST',
        body: data,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao fazer upload');
      }

      setMensagem(
        `✅ Processo "${formData.nomeProcesso}" inserido com sucesso! ` +
        `Total de arquivos: ${result.totalArquivos}`
      );

      // Limpar formulário
      setFormData({
        nomeProcesso: '',
        arquivoBpmn: null,
        subdiagramas: [],
        documentos: [],
      });

      // Resetar inputs de arquivo
      const fileInputs = document.querySelectorAll('input[type="file"]');
      fileInputs.forEach((input: any) => {
        input.value = '';
      });
    } catch (error: any) {
      console.error('Erro ao inserir processo:', error);
      setErro(error.message || 'Erro ao inserir processo');
    } finally {
      setLoading(false);
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

            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Inserir Novo Processo
            </h1>
            <p className="text-xl text-gray-600">
              Faça upload de processos BPMN para o repositório GitHub e eles aparecerão automaticamente no site
            </p>
          </div>

          {/* Mensagens */}
          {mensagem && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-green-800 font-medium">{mensagem}</p>
            </div>
          )}

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800 font-medium">❌ {erro}</p>
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8">
            {/* Nome do Processo */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nome do Processo *
              </label>
              <input
                type="text"
                value={formData.nomeProcesso}
                onChange={(e) => setFormData({ ...formData, nomeProcesso: e.target.value })}
                placeholder="Ex: Comercial-v2.0, RH-v1.0"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Este será o nome da pasta no GitHub. Use formato: Nome-v1.0
              </p>
            </div>

            {/* Arquivo BPMN Principal */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Arquivo BPMN Principal *
              </label>
              <input
                type="file"
                accept=".bpmn"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setFormData({ ...formData, arquivoBpmn: file });
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Arquivo .bpmn do diagrama principal do processo
              </p>
            </div>

            {/* Subdiagramas (Opcional) */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Subdiagramas (Opcional)
              </label>
              <input
                type="file"
                accept=".bpmn"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setFormData({ ...formData, subdiagramas: files });
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
              />
              <p className="text-sm text-gray-500 mt-1">
                Arquivos .bpmn de subprocessos. Serão salvos em /subdiagramas/
              </p>
            </div>

            {/* Documentos POP/IT (Opcional) */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Documentos POP/IT (Opcional)
              </label>
              <input
                type="file"
                accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setFormData({ ...formData, documentos: files });
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
              />
              <p className="text-sm text-gray-500 mt-1">
                Documentos PDF, DOCX, XLSX, etc. Serão organizados em /pop-it/
              </p>
            </div>

            {/* Preview dos arquivos selecionados */}
            {(formData.arquivoBpmn || formData.subdiagramas.length > 0 || formData.documentos.length > 0) && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Arquivos Selecionados:</h3>
                <ul className="space-y-1 text-sm text-gray-600">
                  {formData.arquivoBpmn && (
                    <li>📄 BPMN Principal: {formData.arquivoBpmn.name}</li>
                  )}
                  {formData.subdiagramas.length > 0 && (
                    <li>📁 Subdiagramas: {formData.subdiagramas.length} arquivo(s)</li>
                  )}
                  {formData.documentos.length > 0 && (
                    <li>📎 Documentos: {formData.documentos.length} arquivo(s)</li>
                  )}
                </ul>
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-lg font-semibold transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? '⏳ Enviando...' : '🚀 Inserir Processo'}
              </button>

              <Link
                href="/processos"
                className="px-8 py-4 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition-all duration-300 text-center"
              >
                Cancelar
              </Link>
            </div>
          </form>

          {/* Informações */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-blue-900 mb-3">ℹ️ Como funciona:</h3>
            <ol className="space-y-2 text-blue-800">
              <li>1. Preencha o nome do processo</li>
              <li>2. Selecione o arquivo BPMN principal (obrigatório)</li>
              <li>3. Adicione subdiagramas se houver (opcional)</li>
              <li>4. Adicione documentos POP/IT se houver (opcional)</li>
              <li>5. Clique em "Inserir Processo"</li>
              <li>6. ✅ O processo será enviado para o GitHub e aparecerá automaticamente no site!</li>
            </ol>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
