# Contexto completo para Codex: Organizar Processos, subpastas e upload

Este documento reúne **tudo o que já foi adicionado e alterado** no projeto em relação a: upload de processos, hierarquia de pastas, modal Organizar, criação de pastas e regras de commit. Use como referência para implementar as funcionalidades que ainda faltam (criar subpastas no GitHub e upload direto no modal).

---

## 1. Variáveis e helpers compartilhados (process-storage)

**Arquivo:** `apps/web/lib/process-storage.ts`

- **Exportados usados em várias APIs:**
  - `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_BRANCH`
  - `GITHUB_REPO_QUADDRA`, `GITHUB_REPO_VALESHOP` (ambos podem ser `'vale-shope-processos'`)
  - `octokit` (instância do Octokit ou null se sem token)
  - `withRetry<T>(operation, label, attempts?)` — executa uma Promise até 3 vezes em caso de falha
- **Funções:** `normalizeSlug`, `listGithubBpmnFiles(repo)`, `listLocalBpmnFiles()`, `syncLocalDelete(path)`, etc.

---

## 2. API de upload de processos

**Arquivo:** `apps/web/app/api/upload-processo/route.ts`

**Já implementado:**

- **Body (FormData):**
  - `processName` (obrigatório)
  - `clientType`: `'quaddra'` | `'valeshop'` → define repositório (`repo = clientType === 'valeshop' ? GITHUB_REPO_VALESHOP : GITHUB_REPO_QUADDRA`)
  - `folderStructure`: JSON array `[{ path, name, fileCount }]` (caminho normalizado, ex: `"Fluxo Operação Cartão/Repasse Credenciada"`)
  - Arquivos: múltiplos com chave `folder_<caminho normalizado>` (ex: `folder_Fluxo Operação Cartão/Repasse Credenciada`)
  - `forceUpload`: `'1'` | `'true'` | `'yes'` para ignorar a verificação “iguais ao repo” e sempre fazer commit
- **Fluxo:**
  - Sanitização de nomes (`sanitizeSegment`, `sanitizeRelativePath`); só aceita `.bpmn`
  - Monta `uploadEntries[]` com `githubPath` e `contentBase64`
  - Cria blobs no GitHub; busca árvore atual (getRef + getTree recursive)
  - Compara path + SHA de cada arquivo com o que está no repo → se **todos iguais** e **não** forceUpload: retorna `{ success: true, noCommit: true, message: '...' }` **sem** commit
  - Caso contrário: loop de até 3 tentativas: getRef → getCommit → createTree(base_tree + treeItems) → createCommit → updateRef; se der 422 “not a fast forward”, refaz com a ref atual
  - Tratamento de 404: se getRef/getTree falhar com 404, retorna erro amigável “Repositório ou branch não encontrado”
- **Respostas de sucesso:**
  - Com commit: `{ success: true, githubSynced: true, uploadedPaths }`
  - Sem commit (iguais): `{ success: true, noCommit: true, githubSynced: false, message: '...' }`

**Trecho relevante (escolha de repo e forceUpload):**

```ts
const clientType = ((formData.get('clientType') as string | null) || 'quaddra').toLowerCase();
const repo = clientType === 'valeshop' ? GITHUB_REPO_VALESHOP : GITHUB_REPO_QUADDRA;
const forceUpload = ['1', 'true', 'yes'].includes(
  String(formData.get('forceUpload') ?? formData.get('forcarEnvio') ?? '').toLowerCase(),
);
```

**Trecho do loop de commit com retry em fast-forward:**

```ts
for (let attempt = 1; attempt <= maxUpdateAttempts; attempt += 1) {
  const { data: refData } = await withRetry(
    () => octokit!.git.getRef({ owner: GITHUB_OWNER, repo, ref: `heads/${GITHUB_BRANCH}` }),
    `upload:getRef:${repo}`,
  );
  const baseSha = refData.object.sha;
  const { data: commitData } = await withRetry(
    () => octokit!.git.getCommit({ owner: GITHUB_OWNER, repo, commit_sha: baseSha }),
    `upload:getCommit:${repo}`,
  );
  const { data: newTree } = await withRetry(
    () => octokit!.git.createTree({
      owner: GITHUB_OWNER,
      repo,
      base_tree: commitData.tree.sha,
      tree: treeItems,
    }),
    `upload:createTree:${repo}`,
  );
  const { data: newCommit } = await withRetry(
    () => octokit!.git.createCommit({
      owner: GITHUB_OWNER,
      repo,
      message: commitMessage,
      tree: newTree.sha,
      parents: [baseSha],
    }),
    `upload:createCommit:${repo}`,
  );
  try {
    await octokit!.git.updateRef({
      owner: GITHUB_OWNER,
      repo,
      ref: `heads/${GITHUB_BRANCH}`,
      sha: newCommit.sha,
    });
    break;
  } catch (err: any) {
    const isNotFastForward =
      err?.status === 422 &&
      (err?.message?.includes('fast forward') || err?.response?.data?.message?.includes('fast forward'));
    if (isNotFastForward && attempt < maxUpdateAttempts) continue;
    throw err;
  }
}
```

---

## 3. API de gerenciamento de pastas

**Arquivo:** `apps/web/app/api/manage-folder/route.ts`

**Estado atual:**

- **Body (JSON):** `action`, `folderPath` (obrigatório exceto em create), `newName`, `parentPath` (para create).
- **Repositório:** usa uma única constante `GITHUB_REPO = process.env.GITHUB_REPO_PROCESSOS || process.env.GITHUB_REPO_QUADDRA || 'vale-shope-processos'` — **não** recebe `clientType`.
- **Ação `create`:**
  - Valida `newName`; monta `newFolderPath = parentPath ? `${parentPath}/${newName}` : newName`.
  - Verifica no GitHub se já existe pasta com esse path (getRef → getTree recursive).
  - Cria a pasta **só localmente** em `apps/api/storage/bpmn/` (se existir).
  - Retorna `{ success: true, message: 'Pasta criada com sucesso', path: newFolderPath }` **sem** criar nada no GitHub (comentário no código: “No GitHub, pastas são criadas automaticamente quando arquivos são adicionados”).
- **Ações `rename` e `delete`:** usam o mesmo `GITHUB_REPO`; rename faz commit no GitHub; delete só verifica se pasta está vazia e remove localmente.

**O que falta (para Codex):**

- Aceitar `clientType` no body e definir `repo` como em upload-processo (valeshop → GITHUB_REPO_VALESHOP, senão GITHUB_REPO_QUADDRA). Usar esse `repo` em todas as chamadas ao Octokit.
- No `case 'create'`, após criar localmente, **criar a pasta no GitHub** com um commit que adicione um arquivo dentro da nova pasta (ex.: `.gitkeep` ou conteúdo mínimo), usando a mesma sequência getRef → getCommit → createBlob → createTree → createCommit → updateRef e retry em 422 “not a fast forward”.

---

## 4. Modal Organizar Processos

**Arquivo:** `apps/web/components/ProcessOrganizationModal.tsx`

**Já implementado:**

- **Props:** `isOpen`, `onClose`, `processos: ProcessoItem[]`, `onUpdate`, **`clientType?: 'quaddra' | 'valeshop'`** (default `'quaddra'`).
- **Estado:** `folderStructure` (árvore de `FolderNode`: name, path, processes, subfolders), `editingFolder`, `newFolderName`, `creatingFolder` (path da pasta onde está criando subpasta), `notificacao`.
- **Construção da árvore:** a partir de `processos[].file` (path completo do arquivo), monta pastas aninhadas; cada processo vai para a pasta cujo path é `pathParts.slice(0, -1).join('/')`.
- **Render:** para cada pasta: cabeçalho com nome, ícones de editar/deletar e “criar subpasta” (FolderPlus). Se `creatingFolder === folder.path`, mostra formulário **inline** (nome da nova pasta + Criar + Cancelar). Depois lista **subpastas** e em seguida **processos** da pasta (para deixar claro “pasta X contém processo Y”).
- **Chamadas à API:**
  - **Criar pasta:** `POST /api/manage-folder` com `{ action: 'create', folderPath: '', newName, parentPath }` — **não envia `clientType`**.
  - **Renomear:** `POST /api/manage-folder` com `{ action: 'rename', folderPath, newName }` — **não envia `clientType`**.
  - **Deletar:** `POST /api/manage-folder` com `{ action: 'delete', folderPath }` — **não envia `clientType`**.
  - **Mover processo:** `POST /api/move-processo` com `{ processSlug, targetFolderPath, clientType }` — **já envia clientType**.
- **Bloco “Nova pasta principal”:** ao final do conteúdo, um card com botão “Nova pasta principal”; ao clicar, aparece formulário (nome + Criar + Cancelar) que chama create com `parentPath: null`.

**O que falta (para Codex):**

- Incluir **`clientType`** em todas as requisições a `/api/manage-folder`.
- Por pasta (no `renderFolder`), adicionar botão **“Enviar arquivo(s)”** / “Upload aqui” que:
  - Abre um `<input type="file" multiple accept=".bpmn" />`.
  - Ao selecionar arquivos, monta o FormData como na tela Inserir (usar o mesmo formato: `processName`, `clientType`, `folderStructure: [{ path: folder.path, name: folder.path, fileCount: files.length }]`, arquivos em `folder_<folder.path>`).
  - Chama `POST /api/upload-processo` e em sucesso chama `onUpdate()` e mostra notificação; em erro mostra mensagem da API.

**Exemplo de como a tela Inserir monta o FormData (para replicar no modal):**

```ts
// buildUploadFormData em apps/web/app/processos/inserir/page.tsx
formData.append('processName', processName);
formData.append('clientType', clientType);
if (forceUpload) formData.append('forceUpload', '1');
const normalizedPath = sanitizeRelativePath(folderPath) || 'root';
formData.append(
  'folderStructure',
  JSON.stringify([{ path: normalizedPath, name: normalizedPath, fileCount: files.length }]),
);
files.forEach((file) => {
  formData.append(`folder_${normalizedPath}`, file);
});
```

No modal, `folderPath` da pasta é `folder.path` (ex.: `"Fluxo Operação Cartão/Repasse Credenciada"`). Para “Raiz” pode usar um processName genérico e path vazio ou `'root'` conforme a API espera.

---

## 5. Página de listagem de processos (hierarquia)

**Arquivo:** `apps/web/app/processos/ProcessosPageClient.tsx` (usado por `apps/web/app/processos/page.tsx` e `apps/web/app/vale-shop/processos/page.tsx`)

**Já implementado:**

- **Fonte dos dados:** `processosIniciais` (cada item tem `file`, `slug`, `nome`, `categoria`, **`folderPath`**). Em Vale Shop vem de `listGithubBpmnFiles(GITHUB_REPO_VALESHOP)`; em Processos, de `listGithubBpmnFiles(GITHUB_REPO_QUADDRA)`.
- **Agrupamento em dois níveis:**
  - `gruposHierarquicos: { [categoria: string]: Subgrupo[] }` onde `Subgrupo = { subpastaNome: string; processos: ProcessoItem[] }`.
  - Para cada processo: `categoria = pathParts[0]` (ex.: Fluxo Operação Cartão); `subpastaNome = parts.length > 1 ? parts.slice(1).join('/') : 'Raiz'` (ex.: Repasse Credenciada, Faturamento Cliente 1).
- **Exibição:** por categoria (título), depois por subpasta (subtítulo com borda lateral); dentro de cada subpasta, grid de cards (Abrir + Deletar). Ordem: categorias em reverse; dentro de cada subpasta, processos em reverse.
- **Busca:** filtro por nome, categoria ou **folderPath**.

---

## 6. Página Inserir Processo

**Arquivo:** `apps/web/app/processos/inserir/page.tsx`

**Relevante para o Codex:**

- **buildUploadFormData:** recebe `processName`, `clientType`, `folderPath`, `files`, `forceUpload?` e monta o FormData exatamente como a API upload-processo espera (ver trecho acima).
- **Upload em lotes:** para cada pasta da estrutura, chama uma vez `buildUploadFormData` e `POST /api/upload-processo`; se a resposta for `noCommit`, não interrompe — continua para as próximas pastas.
- **Checkbox “Forçar envio”:** envia `forceUpload: '1'` no FormData quando marcado.

Para o “upload direto” no Organizar, o Codex pode criar uma função semelhante no modal (ou reutilizar a lógica) com `folderPath` = path da pasta selecionada e `processName` = nome da pasta ou do primeiro arquivo.

---

## 7. Documentação de regras de upload

**Arquivo:** `docs/ESTRUTURA_PASTAS_PROCESSOS.md` (seção 6)

- Regras descritas: commit só quando houver mudança; upload em lotes; retry em fast-forward; 404 para repo/branch inexistente; apenas .bpmn; sanitização de nomes.
- **Arquivo:** `docs/PROMPT_ORGANIZAR_SUBPASTAS_E_UPLOAD.md` — prompt focado no que o Codex deve implementar (criar subpastas no GitHub, clientType em manage-folder, upload no modal).

---

## 8. Resumo do que o Codex deve implementar

1. **`apps/web/app/api/manage-folder/route.ts`**
   - Ler `clientType` do body e definir `repo` (valeshop → GITHUB_REPO_VALESHOP, senão GITHUB_REPO_QUADDRA). Usar `repo` em todas as chamadas ao GitHub.
   - No `case 'create'`, após criar a pasta localmente, criar um commit no GitHub que adicione um arquivo na nova pasta (ex.: `.gitkeep`) para a pasta aparecer no repositório. Reutilizar a lógica de getRef → getCommit → createBlob (conteúdo do arquivo) → createTree → createCommit → updateRef. Tratar 422 “not a fast forward” com retry (refetch ref e tentar de novo), como em upload-processo.

2. **`apps/web/components/ProcessOrganizationModal.tsx`**
   - Em todas as chamadas a `POST /api/manage-folder`, incluir **`clientType`** no body (valor da prop `clientType`).
   - Em cada pasta no `renderFolder`, adicionar um botão “Enviar arquivo(s)” (ou ícone de upload) que:
     - Abre input file múltiplo `.bpmn`.
     - Monta FormData no mesmo formato de `buildUploadFormData` (processName, clientType, folderStructure com path da pasta, arquivos em `folder_<path>`).
     - Chama `POST /api/upload-processo` e em sucesso chama `onUpdate()` e mostra notificação; em erro mostra a mensagem retornada.

Com isso, as subpastas passam a existir no GitHub ao serem criadas no Organizar e o usuário pode fazer upload de .bpmn direto em qualquer pasta pelo modal.
