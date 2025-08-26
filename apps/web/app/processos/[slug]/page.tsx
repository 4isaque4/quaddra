import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Header, Footer } from '@/components'
import BpmnViewer from '@/components/BpmnViewer'

const processos = {
  'comercial-v2': {
    nome: 'Comercial v2.0',
    descricao: 'Processo Comercial (Funil de Vendas)',
    arquivo: 'Comercial v2.0.bpmn',
    bpmnUrl: '/api/bpmn/comercial',
    descriptionsUrl: '/api/descriptions'
  },
  'comissao-vendas': {
    nome: 'Subprocesso Comissão Vendas',
    descricao: 'Processo de comissões para vendas',
    arquivo: 'subprocesso Comissão Vendas v1.0.bpmn',
    bpmnUrl: '/api/bpmn/comissao-vendas',
    descriptionsUrl: '/api/descriptions'
  }
}

export default function ProcessoPage({ params }: { params: { slug: string } }) {
  const processo = processos[params.slug as keyof typeof processos]

  if (!processo) {
    notFound()
  }

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
              {processo.nome}
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              {processo.descricao}
            </p>
            <div className="text-sm text-gray-500">
              Arquivo: {processo.arquivo}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Visualização do Processo
            </h2>
            <BpmnViewer 
              bpmnUrl={processo.bpmnUrl}
              descriptionsUrl={processo.descriptionsUrl}
            />
          </div>

          <div className="text-center mt-12">
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
