# Prompt para Codex: Subpastas e upload no Organizar Processos

Copie o texto abaixo e use no Codex para implementar as melhorias.

---

## Contexto do projeto

- Aplicação **Quaddra** (Next.js), com área **Vale Shop** que usa o repositório GitHub `4isaque4/vale-shope-processos` para processos BPMN.
- A tela **Processos** (e Vale Shop > Processos) tem um botão **Organizar** que abre o modal **Organizar Processos** (`ProcessOrganizationModal.tsx`). Nesse modal o usuário vê a hierarquia de pastas e processos vinda do GitHub, pode arrastar processos entre pastas, e tem ícones para **criar**, **renomear** e **deletar** pastas.
- A criação de pastas chama a API **POST /api/manage-folder** com `action: 'create'`, `newName` e `parentPath`. O upload de processos usa **POST /api/upload-processo** (FormData com `processName`, `clientType`, `folderStructure`, arquivos em `folder_<caminho>`).

## Problemas atuais

1. **Subpastas não são criadas no GitHub**  
   Ao clicar em “Criar subpasta” ou “Nova pasta principal” no modal Organizar, a API `manage-folder` só cria a pasta **localmente** (em `apps/api/storage/bpmn/`) e retorna sucesso. No GitHub, pastas vazias não existem (o Git não versiona diretórios vazios). Por isso a nova pasta **não aparece no repositório** até que alguém faça upload de um arquivo nela. O usuário espera que a subpasta exista de fato no repositório.

2. **API manage-folder não usa o repositório do Vale Shop**  
   A rota `/api/manage-folder` usa um único repositório (env `GITHUB_REPO_PROCESSOS` ou `GITHUB_REPO_QUADDRA`). O modal Organizar recebe `clientType` (quaddra | valeshop) mas **não envia** esse parâmetro para a API. Quando o usuário está em Vale Shop, as ações de pasta devem atuar no repositório do Vale Shop (ex.: `vale-shope-processos`).

3. **Não há upload direto no Organizar**  
   Não existe no modal “Organizar Processos” nenhuma forma de **enviar arquivos .bpmn diretamente para uma pasta**. O upload hoje só existe na tela “Inserir Processo”. O usuário quer poder escolher uma pasta no Organizar e fazer upload de arquivo(s) para essa pasta, sem sair do modal.

## O que implementar

### 1. Criar subpastas no GitHub ao criar pasta no Organizar

- Na API **POST /api/manage-folder**, no `case 'create'`:
  - Aceitar parâmetro opcional **`clientType`** (`'quaddra' | 'valeshop'`) no body e escolher o repositório (ex.: valeshop → `GITHUB_REPO_VALESHOP` ou `vale-shope-processos`), do mesmo jeito que em `/api/upload-processo` e `/api/delete-processo`.
  - Depois de criar a pasta localmente (se aplicável), **criar a pasta no GitHub** fazendo um commit que adicione um arquivo dentro da nova pasta (por exemplo `.gitkeep` ou um `.bpmn` placeholder mínimo), para que a pasta apareça na árvore do repositório. Reutilizar a lógica de getRef → getCommit → createBlob → createTree → createCommit → updateRef, como em `upload-processo/route.ts`, e tratar “Update is not a fast forward” com retry (refetch ref e tentar de novo).
- No **ProcessOrganizationModal**, em todas as chamadas a **/api/manage-folder** (create, rename, delete), enviar no body o **`clientType`** que o modal já recebe como prop.

### 2. Upload direto em pasta no modal Organizar

- No **ProcessOrganizationModal**:
  - Para cada pasta exibida (exceto “Raiz” virtual), adicionar um botão ou ação **“Enviar arquivo(s)”** / “Upload aqui” (por exemplo ao lado dos ícones de editar/deletar/criar subpasta).
  - Ao acionar:
    - Abrir um `<input type="file" multiple accept=".bpmn" />` (pode ser estilizado como botão).
    - Ao selecionar um ou mais arquivos .bpmn, montar um `FormData` compatível com **POST /api/upload-processo**: `processName` (pode ser o nome da pasta ou do primeiro arquivo), `clientType`, `folderStructure` com um item `{ path: <caminho completo da pasta>, fileCount: N }`, e anexar os arquivos em `folder_<caminho normalizado>` (mesmo padrão da tela Inserir Processo).
    - Chamar **POST /api/upload-processo** e, em caso de sucesso, exibir mensagem de sucesso e chamar `onUpdate()` para recarregar a lista; em caso de erro, exibir a mensagem retornada.
  - Opcional: desabilitar o botão ou mostrar loading durante o upload.

### 3. Resumo de arquivos a alterar

- **`apps/web/app/api/manage-folder/route.ts`**:  
  - Ler `clientType` do body e definir repositório (valeshop vs quaddra).  
  - No `case 'create'`, após criar a pasta localmente, criar um commit no GitHub que adicione a nova pasta com um arquivo (ex.: `.gitkeep` ou placeholder) e atualizar a ref da branch (com retry em caso de 422 “not a fast forward”).

- **`apps/web/components/ProcessOrganizationModal.tsx`**:  
  - Incluir `clientType` em todas as requisições para `/api/manage-folder`.  
  - Por pasta (em cada bloco de pasta no `renderFolder`), adicionar botão “Enviar arquivo(s)” que abre input de arquivo, monta o FormData e chama `POST /api/upload-processo` com o `folderPath` da pasta, depois chama `onUpdate()` em sucesso.

Com isso, as subpastas passam a ser criadas no repositório e o usuário pode fazer upload direto nas pastas pelo modal Organizar.
