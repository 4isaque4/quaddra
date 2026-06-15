# Testes – apps/web

## Estrutura

- **`fixtures/`** – XML e dados reutilizáveis (ex.: trechos BPMN Bizagi).
- **`lib/`** – Testes unitários de módulos em `lib/` (ex.: extração de texto BPMN).

## Comandos

Na pasta `apps/web`:

```bash
npm test           # executa todos os testes
npm run test:watch # modo watch (re-executa ao salvar)
npm run test:coverage  # gera relatório de cobertura em coverage/
```

Pelo monorepo (na raiz):

```bash
npm run test -w apps/web
```

## O que é testado

- **`lib/bpmn-text-extract.test.ts`** – `extractBpmnTextFromXml`:
  - Extração de texto de `textAnnotation` (incl. Bizagi com `extensionElements`).
  - Associações nas duas direções: `sourceRef`/`targetRef` com anotação e elemento.
  - Texto multilinha em `<text>...</text>`.
  - Fallback de `documentation` em `userTask`/`serviceTask`.
  - Comportamento com XML vazio ou inválido.

## Adicionar novos testes

1. Coloque fixtures em `__tests__/fixtures/`.
2. Crie `__tests__/<pasta>/<nome>.test.ts` espelhando a estrutura do código (ex.: `lib/foo.ts` → `__tests__/lib/foo.test.ts`).
3. Use `@/` para imports (configurado em `jest.config.js`).
