'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'

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
  const pathname = usePathname()
  const { theme } = useTheme()
  const basePath = pathname?.startsWith('/vale-shop') ? '/vale-shop' : ''

  const handleDiagramaChange = (novoSlug: string) => {
    router.push(`${basePath}/processos/${novoSlug}`)
  }

  return (
    <div className="mb-6">
      <label className="block text-sm font-semibold mb-2" style={{ color: theme.colors.text }}>
        Alternar Diagrama:
      </label>
      <select
        value={processoAtual.slug}
        onChange={(e) => handleDiagramaChange(e.target.value)}
        className="px-4 py-2 border rounded-lg bg-white transition-all w-full max-w-md"
        style={{ 
          borderColor: '#d1d5db',
          color: theme.colors.text
        }}
        onFocus={(e) => {
          e.target.style.borderColor = theme.colors.primary;
          e.target.style.boxShadow = `0 0 0 2px ${theme.colors.primary}20`;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = '#d1d5db';
          e.target.style.boxShadow = 'none';
        }}
      >
        <option value={processoAtual.slug}>{processoAtual.nome}</option>
        {outrosDiagramas.map((diagrama) => (
          <option key={diagrama.slug} value={diagrama.slug}>
            {diagrama.nome}
          </option>
        ))}
      </select>
      <p className="text-xs mt-2" style={{ color: theme.colors.textSecondary }}>
        {outrosDiagramas.length + 1} diagrama{outrosDiagramas.length > 0 ? 's' : ''} disponível{outrosDiagramas.length > 0 ? 'eis' : ''} neste processo
      </p>
    </div>
  )
}







