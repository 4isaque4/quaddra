# Prompt para Análise e Correção do Sistema de Gerenciamento de Processos BPMN

## Contexto do Projeto

Estou trabalhando em uma aplicação Next.js que gerencia processos BPMN armazenados no GitHub. A aplicação permite:
- Upload de processos BPMN para o GitHub
- Listagem de processos do GitHub
- Visualização de processos individuais
- Movimentação de processos entre pastas
- Deleção de processos
- Upload de documentos relacionados (POPs, ITs) para pastas customizadas

**Estrutura do Projeto:**
- Frontend: Next.js 14 (App Router)
- Backend: API Routes do Next.js
- Armazenamento: GitHub (repositório `vale-shope-processos`)
- Armazenamento Local: `apps/api/storage/bpmn/` (sincronização com GitHub)

**Tecnologias:**
- Next.js 14.2.5
- Octokit (GitHub API)
- TypeScript
- React

## Problemas Identificados

### 1. Problema de Busca e Identificação de Arquivos

**Sintoma:**
- Arquivos não são encontrados corretamente ao buscar por slug
- Duplicação de processos na listagem
- Arquivos aparecem mesmo após serem deletados
- Inconsistência entre arquivos locais e GitHub

**Código Relevante:**
- `apps/web/app/processos/page.tsx` - Função `getProcessosFromGitHub()`
- `apps/web/app/processos/[slug]/page.tsx` - Função `findProcesso()`
- `apps/web/app/api/bpmn/[slug]/route.ts` - Endpoint de busca de BPMN

**Problemas Específicos:**
1. Normalização de slugs inconsistente entre diferentes partes do código
2. Cache do GitHub API retornando dados antigos
3. Busca local não encontra arquivos que existem apenas no GitHub
4. Duplicação de processos com mesmo slug na listagem

### 2. Problema de Deleção de Processos

**Sintoma:**
- Processos não são removidos completamente do GitHub
- Processos continuam aparecendo na lista após deleção
- Pastas vazias não são removidas após deleção de todos os arquivos
- Deleção local funciona, mas GitHub não sincroniza

**Código Relevante:**
- `apps/web/app/api/delete-processo/route.ts` - Endpoint de deleção

**Problemas Específicos:**
1. Lógica de deleção não remove todos os arquivos relacionados (subpastas, documentos)
2. Não verifica se pasta ficou vazia após deleção
3. Cache não é invalidado após deleção
4. Erro ao deletar quando arquivo existe apenas no GitHub

### 3. Problema de Movimentação de Processos

**Sintoma:**
- Ao mover arquivo BPMN, toda a pasta é movida em vez de apenas o arquivo
- Criação de pastas duplicadas durante movimentação
- Estrutura de pastas incorreta após movimentação
- Arquivo original não é removido após mover

**Código Relevante:**
- `apps/web/app/api/move-processo/route.ts` - Endpoint de movimentação

**Problemas Específicos:**
1. Lógica move todos os arquivos da pasta em vez de apenas o arquivo específico
2. Cria estrutura `targetFolder/processFolderName/file.bpmn` em vez de `targetFolder/file.bpmn`
3. Não remove arquivo original corretamente
4. Não limpa pastas vazias após movimentação

### 4. Problema de Cache e Sincronização

**Sintoma:**
- Dados antigos aparecem mesmo após mudanças no GitHub
- Lista não atualiza após operações (upload, delete, move)
- Inconsistência entre estado local e GitHub

**Problemas Específicos:**
1. GitHub API retorna dados em cache mesmo com headers `Cache-Control: no-cache`
2. Next.js cache não é invalidado após operações
3. Estado do cliente não sincroniza com servidor após mudanças

## Arquivos Principais para Análise

### APIs (Backend)
1. `apps/web/app/api/upload-processo/route.ts` - Upload de processos
2. `apps/web/app/api/delete-processo/route.ts` - Deleção de processos
3. `apps/web/app/api/move-processo/route.ts` - Movimentação de processos
4. `apps/web/app/api/bpmn/[slug]/route.ts` - Busca de arquivo BPMN
5. `apps/web/app/api/documents/[slug]/route.ts` - Gerenciamento de documentos

### Páginas (Frontend)
1. `apps/web/app/processos/page.tsx` - Listagem de processos
2. `apps/web/app/processos/[slug]/page.tsx` - Página individual do processo
3. `apps/web/app/vale-shop/processos/page.tsx` - Listagem para ValeShop
4. `apps/web/app/vale-shop/processos/[slug]/page.tsx` - Página individual ValeShop

### Componentes
1. `apps/web/components/ProcessOrganizationModal.tsx` - Modal de organização
2. `apps/web/components/ProcessSettingsModal.tsx` - Configurações do processo
3. `apps/web/components/BpmnViewer.tsx` - Visualizador BPMN

## Funções Críticas que Precisam de Revisão

### Normalização de Slugs
```typescript
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
```
**Problema:** Esta função é duplicada em vários arquivos e pode ter variações sutis.

### Busca de Processos no GitHub
- Função `getProcessosFromGitHub()` em `page.tsx`
- Função `findProcesso()` em `[slug]/page.tsx`
- Endpoint `GET /api/bpmn/[slug]`

**Problema:** Lógica de busca inconsistente, não trata casos onde arquivo existe apenas no GitHub.

### Operações no GitHub
- Criação de commits e atualização de refs
- Criação de blobs e trees
- Remoção de arquivos e pastas vazias

**Problema:** Não há tratamento robusto de erros, não verifica se operação foi bem-sucedida.

## Requisitos para a Solução

### 1. Robustez e Confiabilidade
- Todas as operações devem verificar se foram bem-sucedidas
- Tratamento de erros adequado em todas as funções
- Logs detalhados para debugging
- Validação de dados antes de operações

### 2. Sincronização GitHub ↔ Local
- Sempre verificar GitHub primeiro (fonte da verdade)
- Sincronizar local após operações bem-sucedidas
- Invalidar cache após operações
- Tratar casos onde arquivo existe apenas em um local

### 3. Consistência de Dados
- Normalização de slugs unificada e consistente
- Remoção de duplicatas na listagem
- Verificação de integridade após operações
- Limpeza de pastas vazias automaticamente

### 4. Performance e Cache
- Cache adequado para leitura (evitar chamadas desnecessárias)
- Invalidação de cache após escrita
- Headers HTTP corretos para evitar cache stale
- Revalidação periódica de dados

### 5. Experiência do Usuário
- Feedback claro de sucesso/erro
- Loading states durante operações
- Atualização automática da lista após operações
- Mensagens de erro descritivas

## Tarefas Solicitadas

Por favor, analise o projeto completo e forneça:

1. **Análise Detalhada:**
   - Identifique todos os pontos de falha
   - Liste inconsistências no código
   - Documente problemas de arquitetura

2. **Correções Específicas:**
   - Corrija a lógica de busca de arquivos
   - Corrija a lógica de deleção completa
   - Corrija a lógica de movimentação (mover apenas arquivo, não pasta)
   - Implemente sincronização robusta GitHub ↔ Local

3. **Melhorias de Robustez:**
   - Adicione validações em todas as operações
   - Implemente tratamento de erros robusto
   - Adicione logs detalhados
   - Implemente retry logic para operações críticas

4. **Refatoração Sugerida:**
   - Unifique funções duplicadas (normalizeSlug, etc.)
   - Crie utilitários reutilizáveis
   - Melhore estrutura de código
   - Documente funções complexas

5. **Testes e Validação:**
   - Sugira casos de teste críticos
   - Valide cenários edge cases
   - Verifique consistência de dados

## Informações Adicionais

**Estrutura de Pastas no GitHub:**
```
vale-shope-processos/
├── ProcessoNome1/
│   ├── arquivo.bpmn
│   ├── subdiagramas/
│   └── pop-it/
├── ProcessoNome2/
│   └── arquivo.bpmn
└── arquivo-raiz.bpmn
```

**Variáveis de Ambiente:**
- `GITHUB_TOKEN` - Token de autenticação
- `GITHUB_OWNER` - Proprietário do repositório (4isaque4)
- `GITHUB_REPO_QUADDRA` - Repositório para Quaddra
- `GITHUB_REPO_VALESHOP` - Repositório para ValeShop
- `GITHUB_BRANCH` - Branch (main)

**Comportamento Esperado:**
- Ao mover arquivo de `PastaA/arquivo.bpmn` para `PastaB`: resultado deve ser `PastaB/arquivo.bpmn` (não `PastaB/PastaA/arquivo.bpmn`)
- Ao deletar processo: remover arquivo e pasta se vazia
- Ao buscar processo: verificar GitHub primeiro, depois local
- Após qualquer operação: invalidar cache e atualizar UI

## Formato da Resposta Esperada

Por favor, forneça:
1. Lista de problemas identificados com prioridade
2. Código corrigido para cada arquivo problemático
3. Explicação das mudanças realizadas
4. Sugestões de melhorias adicionais
5. Checklist de validação para testar as correções

Obrigado pela análise detalhada!
