# Quaddra Monorepo (web + api)

Monorepo minimalista usando **npm workspaces**.

- `apps/web`: Next.js 14 (App Router) + TypeScript + Tailwind + bpmn-js
- `apps/api`: Fastify 4 + TypeScript + xml2js (serve BPMN e descrições)
- `tools/extract-descriptions.js`: CLI para gerar `descriptions.advanced.json` e `descriptions.flat.json` a partir de **todos** os `.bpmn` em `apps/api/storage/bpmn/`.

## Requisitos
- Node 20+ (ou 22+)
- npm 9+

## Instalação
```bash
npm install
```

## Desenvolvimento
Em dois serviços simultâneos (web 3000, api 4000):

```bash
npm run dev
```

## Como usar com BPMN
1. Coloque seus arquivos `.bpmn` em `apps/api/storage/bpmn/`.
2. Gere as descrições:
   ```bash
   npm run extract
   ```
3. Abra **http://localhost:3000/processos** e selecione um processo.

> A API expõe:
> - `GET http://localhost:4000/api/processes` → lista processos (inferidos dos `.bpmn` encontrados)
> - `GET http://localhost:4000/api/processes/:slug/bpmn` → entrega o XML BPMN
> - `GET http://localhost:4000/api/processes/:slug/descriptions` → entrega o JSON de descrições (construído pelo extractor)
