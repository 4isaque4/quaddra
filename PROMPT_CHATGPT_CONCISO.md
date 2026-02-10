# Prompt Conciso para ChatGPT

Sou desenvolvedor de uma aplicação Next.js que gerencia processos BPMN armazenados no GitHub. Estou enfrentando problemas críticos de robustez e preciso de uma análise completa do projeto.

## Problemas Críticos

1. **Busca de Arquivos**: Arquivos não são encontrados corretamente, aparecem duplicados na listagem, e não há sincronização adequada entre GitHub e armazenamento local.

2. **Deleção**: Processos não são completamente removidos do GitHub, continuam aparecendo na lista, e pastas vazias não são limpas.

3. **Movimentação**: Ao mover um arquivo BPMN, toda a pasta é movida em vez de apenas o arquivo, criando estruturas duplicadas como `PastaDestino/PastaOrigem/arquivo.bpmn` em vez de `PastaDestino/arquivo.bpmn`.

4. **Cache**: Dados antigos aparecem mesmo após mudanças no GitHub, e a lista não atualiza após operações.

## Arquivos Principais

- `apps/web/app/api/delete-processo/route.ts` - Deleção
- `apps/web/app/api/move-processo/route.ts` - Movimentação  
- `apps/web/app/api/bpmn/[slug]/route.ts` - Busca de BPMN
- `apps/web/app/processos/page.tsx` - Listagem
- `apps/web/app/processos/[slug]/page.tsx` - Página individual

## O que Preciso

1. **Análise completa** do projeto identificando todos os pontos de falha
2. **Correções específicas** para os problemas mencionados
3. **Melhorias de robustez**: validações, tratamento de erros, logs, retry logic
4. **Refatoração**: unificar funções duplicadas (como `normalizeSlug`), criar utilitários reutilizáveis
5. **Sincronização robusta** GitHub ↔ Local com GitHub como fonte da verdade

## Comportamento Esperado

- **Mover arquivo**: `PastaA/arquivo.bpmn` → `PastaB/arquivo.bpmn` (não `PastaB/PastaA/arquivo.bpmn`)
- **Deletar**: Remover arquivo + pasta se vazia + invalidar cache
- **Buscar**: Verificar GitHub primeiro, depois local
- **Após operações**: Invalidar cache e atualizar UI automaticamente

## Tecnologias

- Next.js 14.2.5 (App Router)
- Octokit (GitHub API)
- TypeScript
- Repositório: `vale-shope-processos` no GitHub

Por favor, forneça código corrigido, explicações das mudanças, e um checklist de validação. O projeto precisa estar robusto e confiável para produção.
