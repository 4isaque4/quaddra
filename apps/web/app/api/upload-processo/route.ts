import { NextResponse } from 'next/server'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import {
  GITHUB_BRANCH,
  GITHUB_OWNER,
  GITHUB_REPO_QUADDRA,
  GITHUB_REPO_VALESHOP,
  octokit,
  withRetry,
} from '@/lib/process-storage'

type FolderConfig = {
  name: string
  fileCount: number
}

type UploadEntry = {
  localPath: string
  githubPath: string
  contentBase64: string
}

export const runtime = 'nodejs'
export const maxDuration = 60

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .replace(/\\/g, '/')
    .replace(/[<>:"|?*]/g, '-')
    .replace(/\s+/g, ' ')
}

function sanitizeRelativePath(value: string): string {
  const cleaned = value
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => sanitizeSegment(part))
    .filter((part) => part && part !== '.' && part !== '..')
    .join('/')

  return cleaned.replace(/^\/+|\/+$/g, '')
}

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ success: false, error: message, details }, { status })
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const processNameRaw = (formData.get('processName') as string | null) || ''
    const processName = sanitizeSegment(processNameRaw)
    const mainFile = formData.get('mainFile') as File | null
    const clientType = ((formData.get('clientType') as string | null) || 'quaddra').toLowerCase()
    const repo = clientType === 'valeshop' ? GITHUB_REPO_VALESHOP : GITHUB_REPO_QUADDRA

    if (!processName) return jsonError('Nome do processo é obrigatório', 400)
    if (!mainFile) return jsonError('Arquivo principal é obrigatório', 400)

    const folderStructureRaw = formData.get('folderStructure') as string | null
    let folderStructure: FolderConfig[] = []

    if (folderStructureRaw) {
      try {
        const parsed = JSON.parse(folderStructureRaw)
        if (Array.isArray(parsed)) {
          folderStructure = parsed
            .map((item) => ({
              name: sanitizeRelativePath(String(item?.name || '')),
              fileCount: Number(item?.fileCount || 0),
            }))
            .filter((item) => item.name || item.fileCount > 0)
        }
      } catch (error: any) {
        return jsonError('Estrutura de pastas inválida', 400, error?.message)
      }
    }

    const storageRoot = join(process.cwd(), '..', 'api', 'storage', 'bpmn')
    if (!existsSync(storageRoot)) mkdirSync(storageRoot, { recursive: true })

    const uploadEntries: UploadEntry[] = []
    const duplicateGuard = new Set<string>()

    for (const folder of folderStructure) {
      const folderName = folder.name || 'root'
      const files = formData.getAll(`folder_${folderName}`) as File[]
      if (!files.length) continue

      for (const file of files) {
        const safeFileName = sanitizeSegment(file.name)
        if (!safeFileName.toLowerCase().endsWith('.bpmn')) {
          console.warn('[UPLOAD] arquivo ignorado (não BPMN):', safeFileName)
          continue
        }

        const fileBuffer = Buffer.from(await file.arrayBuffer())
        const targetFolder = folderName === 'root' ? sanitizeRelativePath(processName) : sanitizeRelativePath(folderName)
        const githubPath = `${targetFolder}/${safeFileName}`.replace(/\/+/g, '/')

        if (!targetFolder) return jsonError('Nome de pasta inválido detectado no upload', 400)
        if (duplicateGuard.has(githubPath)) {
          return jsonError(`Arquivo duplicado no payload: ${githubPath}`, 400)
        }
        duplicateGuard.add(githubPath)

        const localPath = join(storageRoot, ...githubPath.split('/'))
        mkdirSync(dirname(localPath), { recursive: true })
        writeFileSync(localPath, fileBuffer)

        uploadEntries.push({
          localPath,
          githubPath,
          contentBase64: fileBuffer.toString('base64'),
        })
      }
    }

    if (!uploadEntries.length) {
      return jsonError('Nenhum arquivo BPMN válido foi enviado', 400)
    }

    if (!octokit) {
      return NextResponse.json({
        success: true,
        message: 'Arquivos salvos localmente. GitHub não configurado.',
        processName,
        totalArquivos: uploadEntries.length,
        githubSynced: false,
        githubError: 'GITHUB_TOKEN não configurado',
      })
    }

    const { data: refData } = await withRetry(
      () => octokit!.git.getRef({ owner: GITHUB_OWNER, repo, ref: `heads/${GITHUB_BRANCH}` }),
      `upload:getRef:${repo}`,
    )

    const { data: commitData } = await withRetry(
      () => octokit!.git.getCommit({ owner: GITHUB_OWNER, repo, commit_sha: refData.object.sha }),
      `upload:getCommit:${repo}`,
    )

    const treeItems = await Promise.all(
      uploadEntries.map(async (entry) => {
        const { data: blob } = await withRetry(
          () =>
            octokit!.git.createBlob({
              owner: GITHUB_OWNER,
              repo,
              content: entry.contentBase64,
              encoding: 'base64',
            }),
          `upload:createBlob:${repo}:${entry.githubPath}`,
        )

        return {
          path: entry.githubPath,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.sha,
        }
      }),
    )

    const { data: newTree } = await withRetry(
      () =>
        octokit!.git.createTree({
          owner: GITHUB_OWNER,
          repo,
          base_tree: commitData.tree.sha,
          tree: treeItems,
        }),
      `upload:createTree:${repo}`,
    )

    const { data: newCommit } = await withRetry(
      () =>
        octokit!.git.createCommit({
          owner: GITHUB_OWNER,
          repo,
          message: `feat: upload de processo ${processName} (${uploadEntries.length} arquivo(s))`,
          tree: newTree.sha,
          parents: [refData.object.sha],
        }),
      `upload:createCommit:${repo}`,
    )

    await withRetry(
      () =>
        octokit!.git.updateRef({
          owner: GITHUB_OWNER,
          repo,
          ref: `heads/${GITHUB_BRANCH}`,
          sha: newCommit.sha,
        }),
      `upload:updateRef:${repo}`,
    )

    return NextResponse.json(
      {
        success: true,
        message: 'Processo inserido e sincronizado com GitHub',
        processName,
        totalArquivos: uploadEntries.length,
        githubSynced: true,
        uploadedPaths: uploadEntries.map((entry) => entry.githubPath),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      },
    )
  } catch (error: any) {
    console.error('[UPLOAD] erro fatal:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao fazer upload do processo',
        details: error?.message || 'erro desconhecido',
      },
      { status: 500 },
    )
  }
}
