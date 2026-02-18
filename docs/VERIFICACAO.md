# Checklist de verificação manual

Use este checklist quando alterar funcionalidades do viewer BPMN ou do modal de detalhe, para garantir que o comportamento principal continua correto.

## Pré-requisitos

- Processo com BPMN que tenha **anotações de texto** (caixas de texto ligadas por linha pontilhada a tarefas), ex.: “Fluxo de Contratos - Credenciada”.

## Fluxo principal

1. **Carregar processo**
   - Abrir a aplicação e navegar até a lista de processos.
   - Abrir um processo que tenha diagrama BPMN com anotações.
   - **Esperado:** diagrama carrega, sem erro na tela.

2. **Texto formatado e associações no modal**
   - Dar **duplo clique** em uma tarefa que tenha uma anotação ligada por linha pontilhada (ex.: “Cadastrar Dados Preliminares do Negócio”, “Selecionar Funil”).
   - **Esperado:** modal de detalhe abre.
   - **Esperado:** a seção **“Texto formatado (BPMN)”** exibe o texto da anotação.
   - **Esperado:** a seção **“Textos de associação (BPMN)”** exibe pelo menos um item quando houver associação.

3. **Tarefa sem anotação**
   - Fechar o modal e dar duplo clique em uma tarefa que **não** tenha anotação ligada.
   - **Esperado:** modal abre; “Texto formatado (BPMN)” e “Textos de associação (BPMN)” podem estar vazios ou com conteúdo de documentação, sem erro.

## Quando rodar

- Após mudanças em `BpmnViewer.tsx`, `lib/bpmn-text-extract.ts` ou na API que serve o XML do BPMN.
- Antes de considerar concluída uma tarefa relacionada a texto formatado / associações.

## Testes automáticos

Além deste checklist, os testes em `apps/web/__tests__/` validam a extração de texto e associações. Sempre que possível, rode:

```bash
cd apps/web && npm test
```
