import Link from 'next/link'
import { Header, Footer } from '@/components'
import { FileText } from 'lucide-react'
import { readdirSync, existsSync, statSync } from 'fs'
import { join, relative } from 'path'

function normalizeSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .replace(/\s+/g, '-')
    .replace(/\//g, '-')
    .toLowerCase()
}

function getAllBpmnFiles(dir: string, baseDir: string, fileList: Array<{ path: string, name: string }> = []): Array<{ path: string, name: string }> {
  const files = readdirSync(dir)
  
  files.forEach(file => {
    const filePath = join(dir, file)
    const stat = statSync(filePath)
    
    if (stat.isDirectory()) {
      getAllBpmnFiles(filePath, baseDir, fileList)
    } else if (file.toLowerCase().endsWith('.bpmn')) {
      const relativePath = relative(baseDir, filePath).replace(/\\/g, '/')
      fileList.push({
        path: relativePath,
        name: file
      })
    }
  })
  
  return fileList
}

interface ProcessoItem {
  file: string
  slug: string
  nome: string
  bpmnUrl: string
  descriptionsUrl: string
}

interface ProcessoGrupo {
  categoria: string
  processos: ProcessoItem[]
}

function getProcessos(): ProcessoGrupo[] {
  try {
    const bpmnDir = join(process.cwd(), '..', 'api', 'storage', 'bpmn')
    
    if (!existsSync(bpmnDir)) {
      return []
    }
    
    const files = getAllBpmnFiles(bpmnDir, bpmnDir)
    
    // Agrupar por pasta/categoria
    const grupos: { [key: string]: ProcessoItem[] } = {}
    
    files.forEach(({ path, name }) => {
      const slug = normalizeSlug(path.replace(/\.bpmn$/i, ''))
      const pathParts = path.split('/')
      
      // Determinar categoria (pasta ou "Raiz")
      let categoria = 'Raiz'
      if (pathParts.length > 1) {
        categoria = pathParts[0] // Nome da pasta
      }
      
      if (!grupos[categoria]) {
        grupos[categoria] = []
      }
      
      grupos[categoria].push({
        file: path,
        slug,
        nome: name.replace(/\.bpmn$/i, ''),
        bpmnUrl: `/api/bpmn/${encodeURIComponent(slug)}`,
        descriptionsUrl: '/api/descriptions'
      })
    })
    
    // Converter para array e ordenar
    return Object.keys(grupos)
      .sort()
      .map(categoria => ({
        categoria,
        processos: grupos[categoria].sort((a, b) => a.nome.localeCompare(b.nome))
      }))
  } catch (error) {
    console.error('Erro ao buscar processos:', error)
    return []
  }
}

export default function ProcessosPage() {
  const grupos = getProcessos()

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

          {grupos.map((grupo) => (
            <div key={grupo.categoria} className="mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 border-b-2 border-orange-500 pb-2">
                {grupo.categoria}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {grupo.processos.map((processo) => (
                  <div key={processo.slug} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:transform hover:-translate-y-2">
                    <div className="p-6">
                      <div className="flex justify-center mb-3">
                        <FileText className="w-10 h-10 text-orange-500" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">
                        {processo.nome}
                      </h3>
                      <Link 
                        href={`/processos/${processo.slug}`}
                        className="inline-block w-full text-center bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-300 mt-4"
                      >
                        Visualizar
                      </Link>
                    </div>
                  </div>
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
  )
}
