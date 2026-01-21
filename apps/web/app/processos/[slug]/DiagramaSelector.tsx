'use client'

import { useRouter } from 'next/navigation'

interface ProcessoItem {
  file: string
  slug: string
  nome: string
  bpmnUrl: string
  descriptionsUrl: string
}

interface DiagramaSelectorProps {
  processoAtual: ProcessoItem
  outrosDiagramas: ProcessoItem[]
}

export default function DiagramaSelector({ processoAtual, outrosDiagramas }: DiagramaSelectorProps) {
  const router = useRouter()

  const handleDiagramaChange = (novoSlug: string) => {
    router.push(`/processos/${novoSlug}`)
  }

  return (
    <div className="mb-6">
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Alternar Diagrama:
      </label>
      <select
        value={processoAtual.slug}
        onChange={(e) => handleDiagramaChange(e.target.value)}
        className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all w-full max-w-md"
      >
        <option value={processoAtual.slug}>{processoAtual.nome}</option>
        {outrosDiagramas.map((diagrama) => (
          <option key={diagrama.slug} value={diagrama.slug}>
            {diagrama.nome}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-500 mt-2">
        {outrosDiagramas.length + 1} diagrama{outrosDiagramas.length > 0 ? 's' : ''} disponível{outrosDiagramas.length > 0 ? 'eis' : ''} neste processo
      </p>
    </div>
  )
}







