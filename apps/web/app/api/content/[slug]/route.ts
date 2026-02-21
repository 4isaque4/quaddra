import { NextResponse } from 'next/server'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

function normalizeSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .replace(/\s+/g, '-')
    .replace(/\//g, '-')
    .toLowerCase()
}

function slugCollapseDashes(s: string): string {
  return s.replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function slugCompact(s: string): string {
  return slugCollapseDashes(s).replace(/[^a-z0-9]/g, '')
}

function getAllContentFiles(dir: string, baseDir: string, fileList: Array<{ path: string, name: string }> = []) {
  const files = readdirSync(dir)

  files.forEach((file) => {
    const filePath = join(dir, file)
    const stat = statSync(filePath)

    if (stat.isDirectory()) {
      getAllContentFiles(filePath, baseDir, fileList)
    } else if (file.toLowerCase().endsWith('.json')) {
      const relativePath = relative(baseDir, filePath).replace(/\\/g, '/')
      fileList.push({ path: relativePath, name: file })
    }
  })

  return fileList
}

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const normalizedSlug = normalizeSlug(decodeURIComponent(params.slug))
    const contentDir = join(process.cwd(), '..', 'api', 'storage', 'content')

    if (!existsSync(contentDir)) {
      return NextResponse.json({ error: 'Diretório de conteúdo não encontrado' }, { status: 404 })
    }

    const files = getAllContentFiles(contentDir, contentDir)

    const collapsedSlug = slugCollapseDashes(normalizedSlug)
    const compactSlug = slugCompact(normalizedSlug)
    const matchingFile = files.find(({ path }) => {
      const fileSlug = normalizeSlug(path.replace(/\.json$/i, ''))
      const collapsedFileSlug = slugCollapseDashes(fileSlug)
      const compactFileSlug = slugCompact(fileSlug)
      return (
        fileSlug === normalizedSlug ||
        collapsedFileSlug === collapsedSlug ||
        compactFileSlug === compactSlug ||
        compactFileSlug.endsWith(compactSlug) ||
        compactSlug.endsWith(compactFileSlug)
      )
    })

    if (!matchingFile) {
      return NextResponse.json(
        { elements: {}, _meta: { found: false, slug: normalizedSlug } },
        { headers: { 'Cache-Control': 'public, max-age=300' } },
      )
    }

    const filePath = join(contentDir, ...matchingFile.path.split('/'))
    const fileContent = readFileSync(filePath, 'utf8')

    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Erro ao ler conteúdo do processo:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
