'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header, Footer } from '@/components';
import ProcessCard from '@/components/ProcessCard';

type ProcessoGitHub = {
  slug: string;
  nome: string;
  pasta: string;
  arquivo: string;
  subdiagramas: string[];
  documentos: Record<string, string[]>;
  bpmnUrl: string;
  categoria: string;
};

type ProcessoGrupo = {
  categoria: string;
  processos: ProcessoGitHub[];
};

export default function ProcessosPageClient() {
  const [grupos, setGrupos] = useState<ProcessoGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function carregarProcessos() {
      try {
        setLoading(true);
        const response = await fetch('/api/github-processos');
        
        if (!response.ok) {
          throw new Error('Erro ao buscar processos');
        }

        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Erro desconhecido');
        }

        // Agrupar por categoria
        const processosAgrupados: { [key: string]: ProcessoGitHub[] } = {};
        
        data.processos.forEach((processo: ProcessoGitHub) => {
          const categoria = processo.categoria || 'Outros';
          if (!processosAgrupados[categoria]) {
            processosAgrupados[categoria] = [];
          }
          processosAgrupados[categoria].push(processo);
        });

        // Converter para array e ordenar
        const gruposArray = Object.keys(processosAgrupados)
          .sort()
          .map((categoria) => ({
            categoria,
            processos: processosAgrupados[categoria].sort((a, b) => 
              a.nome.localeCompare(b.nome)
            ),
          }));

        setGrupos(gruposArray);
        setError(null);
      } catch (err: any) {
        console.error('Erro ao carregar processos:', err);
        setError(err.message || 'Erro ao carregar processos');
      } finally {
        setLoading(false);
      }
    }

    carregarProcessos();
  }, []);

  return (
    <>
      <Header />
      <main className="pt-20 min-h-screen bg-gray-50">
        <div className="container py-16">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Processos BPMN
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Visualize e analise os processos de negócio da Quaddra
            </p>
          </div>

          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              <p className="mt-4 text-gray-600">Carregando processos...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <p className="text-red-800 font-semibold mb-2">Erro ao carregar processos</p>
              <p className="text-red-600">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Tentar Novamente
              </button>
            </div>
          )}

          {!loading && !error && grupos.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">Nenhum processo encontrado</p>
            </div>
          )}

          {!loading && !error && grupos.map((grupo) => (
            <div key={grupo.categoria} className="mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 border-b-2 border-orange-500 pb-2">
                {grupo.categoria}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {grupo.processos.map((processo) => (
                  <ProcessCard
                    key={processo.slug}
                    slug={processo.slug}
                    nome={processo.nome}
                  />
                ))}
              </div>
            </div>
          ))}

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
    </>
  );
}
