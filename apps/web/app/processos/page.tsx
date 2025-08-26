import Link from 'next/link'
import { Header, Footer } from '@/components'

export default function ProcessosPage() {
  const processos = [
    {
      slug: 'comercial-v2',
      nome: 'Comercial v2.0',
      descricao: 'Processo Comercial (Funil de Vendas)',
      arquivo: 'Comercial v2.0.bpmn'
    },
    {
      slug: 'comissao-vendas',
      nome: 'Subprocesso Comissão Vendas',
      descricao: 'Processo de comissões para vendas',
      arquivo: 'subprocesso Comissão Vendas v1.0.bpmn'
    }
  ]

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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {processos.map((processo) => (
              <div key={processo.slug} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:transform hover:-translate-y-2">
                <div className="p-8">
                  <div className="text-4xl mb-4">📊</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    {processo.nome}
                  </h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    {processo.descricao}
                  </p>
                  <div className="text-sm text-gray-500 mb-6">
                    Arquivo: {processo.arquivo}
                  </div>
                  <Link 
                    href={`/processos/${processo.slug}`}
                    className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300"
                  >
                    Visualizar Processo
                  </Link>
                </div>
              </div>
            ))}
          </div>

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
  )
}
