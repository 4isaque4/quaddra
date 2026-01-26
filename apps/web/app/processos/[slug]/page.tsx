import { notFound } from 'next/navigation'
import ProcessoPageClientGitHub from './ProcessoPageClientGitHub'

type ProcessoGitHub = {
  slug: string
  nome: string
  pasta: string
  arquivo: string
  subdiagramas: string[]
  documentos: Record<string, string[]>
  bpmnUrl: string
  categoria: string
}

async function getProcessoFromGitHub(slug: string): Promise<ProcessoGitHub | null> {
  try {
    // Buscar todos os processos do GitHub
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/github-processos`, {
      cache: 'no-store', // Sempre buscar dados frescos
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    if (!data.success || !data.processos) {
      return null
    }

    // Encontrar o processo pelo slug
    const processo = data.processos.find((p: ProcessoGitHub) => p.slug === slug)

    return processo || null
  } catch (error) {
    console.error('Erro ao buscar processo do GitHub:', error)
    return null
  }
}

export default async function ProcessoPage({ params }: { params: { slug: string } }) {
  const processo = await getProcessoFromGitHub(params.slug)

  if (!processo) {
    notFound()
  }

  return <ProcessoPageClientGitHub processo={processo} />
}
