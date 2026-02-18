import { NextResponse } from 'next/server'
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'fs'
import { join } from 'path'
import {
  GITHUB_BRANCH,
  GITHUB_OWNER,
  GITHUB_REPO_QUADDRA,
  GITHUB_REPO_VALESHOP,
  GITHUB_TOKEN,
  octokit,
  withRetry,
} from '@/lib/process-storage'

type ClientType = 'quaddra' | 'valeshop'

type ManageFolderPayload = {
  action?: 'create' | 'rename' | 'delete' | 'move'
  folderPath?: string
  newName?: string
  parentPath?: string | null
  targetParentPath?: string | null
  clientType?: ClientType
}

function sanitizePath(value: string | null | undefined): string {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/g, '')
    .replace(/\/+/g, '/')
    .replace(/\/+$/g, '')
}

function resolveRepo(clientType?: string): string {
  return String(clientType || '').toLowerCase() === 'valeshop' ? GITHUB_REPO_VALESHOP : GITHUB_REPO_QUADDRA
}

function isNotFastForward(err: any): boolean {
  return (
    err?.status === 422
    && (String(err?.message || '').includes('fast forward')
      || String(err?.response?.data?.message || '').includes('fast forward'))
  )
}

async function createFolderInGithub(repo: string, folderPath: string) {
  const keepPath = `${folderPath}/.gitkeep`
  const keepContent = `# pasta criada automaticamente: ${folderPath}\n`
  const maxUpdateAttempts = 3

  for (let attempt = 1; attempt <= maxUpdateAttempts; attempt += 1) {
    const { data: refData } = await withRetry(
      () => octokit!.git.getRef({ owner: GITHUB_OWNER, repo, ref: `heads/${GITHUB_BRANCH}` }),
      `manage-folder:create:getRef:${repo}`,
    )

    const baseSha = refData.object.sha

    const { data: commitData } = await withRetry(
      () => octokit!.git.getCommit({ owner: GITHUB_OWNER, repo, commit_sha: baseSha }),
      `manage-folder:create:getCommit:${repo}`,
    )

    const { data: blobData } = await withRetry(
      () =>
        octokit!.git.createBlob({
          owner: GITHUB_OWNER,
          repo,
          content: keepContent,
          encoding: 'utf-8',
        }),
      `manage-folder:create:createBlob:${repo}`,
    )

    const { data: newTree } = await withRetry(
      () =>
        octokit!.git.createTree({
          owner: GITHUB_OWNER,
          repo,
          base_tree: commitData.tree.sha,
          tree: [
            {
              path: keepPath,
              mode: '100644',
              type: 'blob',
              sha: blobData.sha,
            },
          ],
        }),
      `manage-folder:create:createTree:${repo}`,
    )

    const { data: newCommit } = await withRetry(
      () =>
        octokit!.git.createCommit({
          owner: GITHUB_OWNER,
          repo,
          message: `chore: criar pasta ${folderPath}`,
          tree: newTree.sha,
          parents: [baseSha],
        }),
      `manage-folder:create:createCommit:${repo}`,
    )

    try {
      await octokit!.git.updateRef({
        owner: GITHUB_OWNER,
        repo,
        ref: `heads/${GITHUB_BRANCH}`,
        sha: newCommit.sha,
      })
      return
    } catch (err: any) {
      if (isNotFastForward(err) && attempt < maxUpdateAttempts) continue
      throw err
    }
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ManageFolderPayload
    const action = payload.action
    const folderPath = sanitizePath(payload.folderPath)
    const parentPath = sanitizePath(payload.parentPath)
    const newName = String(payload.newName || '').trim()
    const repo = resolveRepo(payload.clientType)

    if (!action) {
      return NextResponse.json({ error: 'Ação é obrigatória' }, { status: 400 })
    }

    if (action !== 'create' && action !== 'move' && !folderPath) {
      return NextResponse.json({ error: 'Caminho da pasta é obrigatório para esta ação' }, { status: 400 })
    }
    if (action === 'move' && !folderPath) {
      return NextResponse.json({ error: 'Caminho da pasta é obrigatório para mover' }, { status: 400 })
    }

    if (!GITHUB_TOKEN || !octokit) {
      return NextResponse.json({ error: 'GITHUB_TOKEN não configurado' }, { status: 500 })
    }
    const api = octokit

    const bpmnDir = join(process.cwd(), '..', 'api', 'storage', 'bpmn')
    const fullFolderPath = folderPath ? join(bpmnDir, folderPath) : null

    switch (action) {
      case 'create': {
        if (!newName) {
          return NextResponse.json({ error: 'Nome da pasta é obrigatório para criar' }, { status: 400 })
        }

        const cleanNewName = sanitizePath(newName).split('/').pop() || ''
        if (!cleanNewName) {
          return NextResponse.json({ error: 'Nome de pasta inválido' }, { status: 400 })
        }

        const newFolderPath = parentPath ? `${parentPath}/${cleanNewName}` : cleanNewName

        try {
          const { data: refData } = await withRetry(
            () => api.git.getRef({ owner: GITHUB_OWNER, repo, ref: `heads/${GITHUB_BRANCH}` }),
            `manage-folder:create:checkRef:${repo}`,
          )

          const { data: currentTree } = await withRetry(
            () =>
              api.git.getTree({
                owner: GITHUB_OWNER,
                repo,
                tree_sha: refData.object.sha,
                recursive: 'true',
              }),
            `manage-folder:create:checkTree:${repo}`,
          )

          const folderExists = (currentTree.tree || []).some(
            (item) => item.path && (item.path === newFolderPath || item.path.startsWith(`${newFolderPath}/`)),
          )

          if (folderExists) {
            return NextResponse.json({ error: 'Pasta já existe' }, { status: 400 })
          }
        } catch (error: any) {
          if (error?.status === 404) {
            return NextResponse.json({ error: 'Repositório ou branch não encontrado' }, { status: 404 })
          }
          return NextResponse.json({ error: 'Erro ao validar pasta no GitHub', details: error?.message }, { status: 500 })
        }

        if (existsSync(bpmnDir)) {
          const localParentDir = parentPath ? join(bpmnDir, parentPath) : bpmnDir
          const localNewFolderPath = join(localParentDir, cleanNewName)
          if (!existsSync(localNewFolderPath)) {
            mkdirSync(localNewFolderPath, { recursive: true })
          }
        }

        await createFolderInGithub(repo, newFolderPath)

        return NextResponse.json({
          success: true,
          githubSynced: true,
          message: 'Pasta criada com sucesso',
          path: newFolderPath,
          repo,
        })
      }

      case 'rename': {
        if (!newName) {
          return NextResponse.json({ error: 'Novo nome da pasta é obrigatório' }, { status: 400 })
        }

        const { data: refData } = await withRetry(
          () => api.git.getRef({ owner: GITHUB_OWNER, repo, ref: `heads/${GITHUB_BRANCH}` }),
          `manage-folder:rename:getRef:${repo}`,
        )

        const { data: commitData } = await withRetry(
          () => api.git.getCommit({ owner: GITHUB_OWNER, repo, commit_sha: refData.object.sha }),
          `manage-folder:rename:getCommit:${repo}`,
        )

        const { data: currentTree } = await withRetry(
          () => api.git.getTree({ owner: GITHUB_OWNER, repo, tree_sha: commitData.tree.sha, recursive: 'true' }),
          `manage-folder:rename:getTree:${repo}`,
        )

        const hasFolder = (currentTree.tree || []).some((item) => item.path?.startsWith(`${folderPath}/`))
        if (!hasFolder) {
          return NextResponse.json({ error: 'Pasta não encontrada no GitHub' }, { status: 404 })
        }

        const parentDir = folderPath.includes('/') ? folderPath.substring(0, folderPath.lastIndexOf('/')) : ''
        const targetFolderPath = parentDir ? `${parentDir}/${newName}` : newName
        const targetExists = (currentTree.tree || []).some(
          (item) => item.path && (item.path === targetFolderPath || item.path.startsWith(`${targetFolderPath}/`)),
        )

        if (targetExists) {
          return NextResponse.json({ error: 'Já existe uma pasta com este nome' }, { status: 400 })
        }

        if (fullFolderPath && existsSync(fullFolderPath)) {
          const localParent = join(fullFolderPath, '..')
          const localTarget = join(localParent, newName)
          if (!existsSync(localTarget)) {
            renameSync(fullFolderPath, localTarget)
          }
        }

        const filesToMove = (currentTree.tree || []).filter(
          (item) => item.type === 'blob' && item.path && item.path.startsWith(`${folderPath}/`),
        )

        const maxUpdateAttempts = 3
        for (let attempt = 1; attempt <= maxUpdateAttempts; attempt += 1) {
          const { data: latestRef } = await withRetry(
            () => api.git.getRef({ owner: GITHUB_OWNER, repo, ref: `heads/${GITHUB_BRANCH}` }),
            `manage-folder:rename:loopRef:${repo}`,
          )
          const latestSha = latestRef.object.sha

          const { data: latestCommit } = await withRetry(
            () => api.git.getCommit({ owner: GITHUB_OWNER, repo, commit_sha: latestSha }),
            `manage-folder:rename:loopCommit:${repo}`,
          )

          const treeItems: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string | null }> = []
          for (const file of filesToMove) {
            const oldPath = file.path!
            const relative = oldPath.slice(folderPath.length + 1)
            const newPath = `${targetFolderPath}/${relative}`

            const { data: fileData } = await withRetry(
              () => api.repos.getContent({ owner: GITHUB_OWNER, repo, path: oldPath, ref: GITHUB_BRANCH }),
              `manage-folder:rename:getContent:${repo}`,
            )

            if (!('content' in fileData) || !fileData.content) continue
            const content = Buffer.from(fileData.content, 'base64').toString('utf-8')

            const { data: blob } = await withRetry(
              () => api.git.createBlob({ owner: GITHUB_OWNER, repo, content, encoding: 'utf-8' }),
              `manage-folder:rename:createBlob:${repo}`,
            )

            treeItems.push({ path: newPath, mode: '100644', type: 'blob', sha: blob.sha })
          }

          for (const file of filesToMove) {
            treeItems.push({ path: file.path!, mode: '100644', type: 'blob', sha: null })
          }

          const { data: newTree } = await withRetry(
            () =>
              api.git.createTree({
                owner: GITHUB_OWNER,
                repo,
                base_tree: latestCommit.tree.sha,
                tree: treeItems,
              }),
            `manage-folder:rename:createTree:${repo}`,
          )

          const { data: newCommit } = await withRetry(
            () =>
              api.git.createCommit({
                owner: GITHUB_OWNER,
                repo,
                message: `chore: renomear pasta ${folderPath} para ${newName}`,
                tree: newTree.sha,
                parents: [latestSha],
              }),
            `manage-folder:rename:createCommit:${repo}`,
          )

          try {
            await api.git.updateRef({ owner: GITHUB_OWNER, repo, ref: `heads/${GITHUB_BRANCH}`, sha: newCommit.sha })
            break
          } catch (err: any) {
            if (isNotFastForward(err) && attempt < maxUpdateAttempts) continue
            throw err
          }
        }

        return NextResponse.json({
          success: true,
          message: 'Pasta renomeada com sucesso',
          newPath: targetFolderPath,
          repo,
        })
      }

      case 'move': {
        const rawTarget = payload.targetParentPath
        const targetParentPath = rawTarget === null || rawTarget === undefined
          ? null
          : sanitizePath(rawTarget)

        if (targetParentPath === folderPath) {
          return NextResponse.json(
            { error: 'Não é possível mover uma pasta para si mesma' },
            { status: 400 },
          )
        }
        if (targetParentPath && (targetParentPath === folderPath || targetParentPath.startsWith(`${folderPath}/`))) {
          return NextResponse.json(
            { error: 'Não é possível mover uma pasta para dentro de uma subpasta sua' },
            { status: 400 },
          )
        }

        const folderName = folderPath.split('/').pop() || folderPath
        const newPath = targetParentPath ? `${targetParentPath}/${folderName}` : folderName

        const { data: refData } = await withRetry(
          () => api.git.getRef({ owner: GITHUB_OWNER, repo, ref: `heads/${GITHUB_BRANCH}` }),
          `manage-folder:move:getRef:${repo}`,
        )

        const { data: currentTree } = await withRetry(
          () => api.git.getTree({ owner: GITHUB_OWNER, repo, tree_sha: refData.object.sha, recursive: 'true' }),
          `manage-folder:move:getTree:${repo}`,
        )

        const hasFolder = (currentTree.tree || []).some((item) => item.path?.startsWith(`${folderPath}/`))
        if (!hasFolder) {
          return NextResponse.json({ error: 'Pasta não encontrada no GitHub' }, { status: 404 })
        }

        const filesToMove = (currentTree.tree || []).filter(
          (item) => item.type === 'blob' && item.path && item.path.startsWith(`${folderPath}/`),
        )

        const maxUpdateAttempts = 3
        for (let attempt = 1; attempt <= maxUpdateAttempts; attempt += 1) {
          const { data: latestRef } = await withRetry(
            () => api.git.getRef({ owner: GITHUB_OWNER, repo, ref: `heads/${GITHUB_BRANCH}` }),
            `manage-folder:move:loopRef:${repo}`,
          )
          const latestSha = latestRef.object.sha

          const { data: latestCommit } = await withRetry(
            () => api.git.getCommit({ owner: GITHUB_OWNER, repo, commit_sha: latestSha }),
            `manage-folder:move:loopCommit:${repo}`,
          )

          const treeItems: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string | null }> = []
          for (const file of filesToMove) {
            const oldPath = file.path!
            const relative = oldPath.slice(folderPath.length + 1)
            const newFilePath = `${newPath}/${relative}`

            const { data: fileData } = await withRetry(
              () => api.repos.getContent({ owner: GITHUB_OWNER, repo, path: oldPath, ref: GITHUB_BRANCH }),
              `manage-folder:move:getContent:${repo}`,
            )

            if (!('content' in fileData) || !fileData.content) continue
            const content = Buffer.from(fileData.content, 'base64').toString('utf-8')

            const { data: blob } = await withRetry(
              () => api.git.createBlob({ owner: GITHUB_OWNER, repo, content, encoding: 'utf-8' }),
              `manage-folder:move:createBlob:${repo}`,
            )

            treeItems.push({ path: newFilePath, mode: '100644', type: 'blob', sha: blob.sha })
          }

          for (const file of filesToMove) {
            treeItems.push({ path: file.path!, mode: '100644', type: 'blob', sha: null })
          }

          const { data: newTree } = await withRetry(
            () =>
              api.git.createTree({
                owner: GITHUB_OWNER,
                repo,
                base_tree: latestCommit.tree.sha,
                tree: treeItems,
              }),
            `manage-folder:move:createTree:${repo}`,
          )

          const { data: newCommit } = await withRetry(
            () =>
              api.git.createCommit({
                owner: GITHUB_OWNER,
                repo,
                message: `chore: mover pasta ${folderPath} para ${newPath}`,
                tree: newTree.sha,
                parents: [latestSha],
              }),
            `manage-folder:move:createCommit:${repo}`,
          )

          try {
            await api.git.updateRef({ owner: GITHUB_OWNER, repo, ref: `heads/${GITHUB_BRANCH}`, sha: newCommit.sha })
            break
          } catch (err: any) {
            if (isNotFastForward(err) && attempt < maxUpdateAttempts) continue
            throw err
          }
        }

        if (fullFolderPath && existsSync(fullFolderPath)) {
          const newFullPath = join(bpmnDir, newPath)
          const parentDir = newPath.includes('/') ? join(bpmnDir, newPath.split('/').slice(0, -1).join('/')) : bpmnDir
          mkdirSync(parentDir, { recursive: true })
          renameSync(fullFolderPath, newFullPath)
        }

        return NextResponse.json({
          success: true,
          message: targetParentPath ? `Pasta movida para ${targetParentPath}` : 'Pasta movida para a raiz',
          newPath,
          repo,
        })
      }

      case 'delete': {
        const { data: refData } = await withRetry(
          () => api.git.getRef({ owner: GITHUB_OWNER, repo, ref: `heads/${GITHUB_BRANCH}` }),
          `manage-folder:delete:getRef:${repo}`,
        )

        const { data: currentTree } = await withRetry(
          () => api.git.getTree({ owner: GITHUB_OWNER, repo, tree_sha: refData.object.sha, recursive: 'true' }),
          `manage-folder:delete:getTree:${repo}`,
        )

        const folderFiles = (currentTree.tree || []).filter((item) => item.path?.startsWith(`${folderPath}/`))
        const meaningfulFiles = folderFiles.filter((item) => item.path && !item.path.endsWith('/.gitkeep'))

        if (meaningfulFiles.length > 0) {
          return NextResponse.json(
            { error: 'Pasta não está vazia. Remova os processos antes de deletar a pasta.' },
            { status: 400 },
          )
        }

        const gitkeep = folderFiles.find((item) => item.path === `${folderPath}/.gitkeep`)
        if (gitkeep) {
          const maxUpdateAttempts = 3
          for (let attempt = 1; attempt <= maxUpdateAttempts; attempt += 1) {
            const { data: latestRef } = await withRetry(
              () => api.git.getRef({ owner: GITHUB_OWNER, repo, ref: `heads/${GITHUB_BRANCH}` }),
              `manage-folder:delete:loopRef:${repo}`,
            )
            const latestSha = latestRef.object.sha

            const { data: latestCommit } = await withRetry(
              () => api.git.getCommit({ owner: GITHUB_OWNER, repo, commit_sha: latestSha }),
              `manage-folder:delete:loopCommit:${repo}`,
            )

            const { data: newTree } = await withRetry(
              () =>
                api.git.createTree({
                  owner: GITHUB_OWNER,
                  repo,
                  base_tree: latestCommit.tree.sha,
                  tree: [{ path: `${folderPath}/.gitkeep`, mode: '100644', type: 'blob', sha: null }],
                }),
              `manage-folder:delete:createTree:${repo}`,
            )

            const { data: newCommit } = await withRetry(
              () =>
                api.git.createCommit({
                  owner: GITHUB_OWNER,
                  repo,
                  message: `chore: deletar pasta ${folderPath}`,
                  tree: newTree.sha,
                  parents: [latestSha],
                }),
              `manage-folder:delete:createCommit:${repo}`,
            )

            try {
              await api.git.updateRef({ owner: GITHUB_OWNER, repo, ref: `heads/${GITHUB_BRANCH}`, sha: newCommit.sha })
              break
            } catch (err: any) {
              if (isNotFastForward(err) && attempt < maxUpdateAttempts) continue
              throw err
            }
          }
        }

        if (fullFolderPath && existsSync(fullFolderPath)) {
          const contents = readdirSync(fullFolderPath)
          if (contents.length === 0) {
            rmSync(fullFolderPath, { recursive: true, force: true })
          }
        }

        return NextResponse.json({ success: true, message: 'Pasta deletada com sucesso', repo })
      }

      default:
        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('[FOLDER] Erro:', error)
    return NextResponse.json({ error: 'Erro ao gerenciar pasta', details: error?.message }, { status: 500 })
  }
}
